// ===========================================================
// Worker Complaint Service — Phase 4E
// ===========================================================
// Implements the worker-side status lifecycle:
//   ASSIGNED   -> IN_PROGRESS
//   IN_PROGRESS -> RESOLVED
//
// Identity rule:
//   req.user.userId (JWT-derived) is the ONLY source of truth
//   for which worker is acting. worker_id from the body / query
//   / params / headers is NEVER consulted.
//
// Ownership rule:
//   A worker may only act on a complaint that is CURRENTLY
//   assigned to them (assignments.is_active = TRUE). Hostel
//   membership is NOT enough — the complaint must actually be
//   assigned to THIS worker.
//
// Transition rule:
//   Only the two transitions listed above are accepted. Anything
//   else (PENDING->IN_PROGRESS, ASSIGNED->RESOLVED, same-status,
//   backward, CLOSED, etc.) is rejected with 409.
//
// All three writes happen inside ONE transaction:
//   1. SELECT ... FOR UPDATE the complaints row, gated by
//      active assignment for this worker
//   2. UPDATE complaints.status
//   3. INSERT complaint_history
// Any failure rolls back the entire transaction.
// ===========================================================

const pool = require('../config/db');
const ApiError = require('../utils/apiError');

// Phase 4E only allows workers to push a complaint forward in
// the lifecycle. They cannot undo, reassign, close, or reset.
const ALLOWED_REQUESTED_STATUSES = new Set(['IN_PROGRESS', 'RESOLVED']);

// The only transitions Phase 4E permits. Source is the CURRENT
// status of the complaint, target is what the client asked for.
const VALID_TRANSITIONS = new Map([
    ['ASSIGNED->IN_PROGRESS', true],
    ['IN_PROGRESS->RESOLVED', true],
]);

// Length cap for a worker-supplied note. Matches the spec.
const NOTE_MAX = 1000;

// Default history note when the worker doesn't supply one.
// Plain English; matches the style of the seed-driven history
// notes ("Complaint created by student", "Complaint assigned to
// worker").
const DEFAULT_NOTE = 'Complaint status updated';

// Normalize a status string sent by the client: trim + uppercase.
// Returns null for non-strings / empty after trim.
function normalizeStatus(raw) {
    if (typeof raw !== 'string') return null;
    const upper = raw.trim().toUpperCase();
    return upper.length > 0 ? upper : null;
}

// Shape the final success response. Kept identical to the
// example in the spec.
function shapeSuccessResponse(complaintId, status) {
    return {
        complaintId,
        status,
    };
}

// Worker status update — the only Phase 4E write path.
//
//   userId        : integer, JWT-derived
//   complaintId   : integer, already validated by controller
//   rawStatus     : string, raw from req.body
//   rawNote       : string | undefined, raw from req.body
//
// Throws ApiError:
//   400 - invalid input (defence in depth — controller validates)
//   401 - missing/invalid userId
//   404 - complaint does not exist OR is not currently assigned
//         to this worker
//   409 - the requested transition is not allowed
async function updateComplaintStatusByWorker(userId, complaintId, rawStatus, rawNote) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }

    // Normalize status. We re-validate here as defence in depth.
    const requestedStatus = normalizeStatus(rawStatus);
    if (requestedStatus === null) {
        throw new ApiError(400, 'Invalid status');
    }
    if (!ALLOWED_REQUESTED_STATUSES.has(requestedStatus)) {
        throw new ApiError(400, 'Invalid status');
    }

    // Resolve the worker-supplied note. We deliberately normalize
    // BEFORE the DB transaction so a malformed note short-circuits
    // the transaction.
    let note;
    if (rawNote === undefined || rawNote === null) {
        note = DEFAULT_NOTE;
    } else if (typeof rawNote !== 'string') {
        throw new ApiError(400, 'note must be a string');
    } else {
        const trimmed = rawNote.trim();
        if (trimmed.length === 0) {
            // Whitespace-only counts as missing — no point storing
            // a row with an empty note when we have a sensible
            // default.
            throw new ApiError(400, 'note must not be empty');
        }
        if (trimmed.length > NOTE_MAX) {
            throw new ApiError(400, `note must be at most ${NOTE_MAX} characters`);
        }
        note = trimmed;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- 1. Lock the complaint row. We need two pieces of
        //        information in one shot:
        //          a. the complaint's CURRENT status, AND
        //          b. whether an ACTIVE assignment for THIS
        //             worker exists for it.
        //        Because the spec lists PENDING -> IN_PROGRESS /
        //        PENDING -> RESOLVED as 409 (invalid transition)
        //        rather than 404, we have to be able to see the
        //        complaint's status even when there's no active
        //        assignment yet.
        //
        //        We do this with a single SELECT ... FOR UPDATE
        //        that LEFT JOINs assignments filtered by
        //        (worker_id = THIS worker AND is_active = TRUE).
        //        If no active assignment exists, the join yields
        //        NULL columns; we then decide:
        //          - worker doesn't exist           -> 404
        //          - complaint doesn't exist        -> 404
        //          - complaint exists, not assigned to THIS
        //            worker, status = PENDING        -> 409
        //            (the spec wants PENDING transitions to be
        //            "Invalid complaint status transition")
        //          - complaint exists, not assigned to THIS
        //            worker, status != PENDING      -> 404
        //            (worker has no relationship with this
        //            complaint in any direction)
        //
        //        SELECT ... FOR UPDATE on the complaints row
        //        gives us exclusive row-level lock until commit,
        //        so a second concurrent update can't squeeze in
        //        between our SELECT and UPDATE. ---
        const [rows] = await conn.query(
            `SELECT
                 c.complaint_id,
                 c.status,
                 w.worker_id     AS worker_id,
                 w.hostel_id     AS worker_hostel_id,
                 r.hostel_id     AS complaint_hostel_id,
                 a.assignment_id AS active_assignment_id
             FROM complaints c
             JOIN students s   ON s.student_id = c.student_id
             JOIN rooms r      ON r.room_id = s.room_id
             JOIN workers w    ON w.user_id = ?
             LEFT JOIN assignments a
                 ON a.complaint_id = c.complaint_id
                AND a.worker_id    = w.worker_id
                AND a.is_active    = TRUE
             WHERE c.complaint_id = ?
             LIMIT 1
             FOR UPDATE`,
            [userId, complaintId]
        );
        if (rows.length === 0 || rows[0].worker_hostel_id !== rows[0].complaint_hostel_id) {
            await conn.rollback();
            // Complaint doesn't exist, worker profile doesn't exist,
            // or complaint belongs to an unrelated hostel. Always return 404
            // so workers cannot probe complaints in other hostels.
            throw new ApiError(404, 'Complaint not found');
        }
        const currentStatus = rows[0].status;
        const activeAssignmentId = rows[0].active_assignment_id;

        if (activeAssignmentId === null || activeAssignmentId === undefined) {
            // Complaint is in the worker's hostel but this worker is not assigned.
            // If it is PENDING (unassigned), surface 409 transition error for local hostel;
            // for any other status, surface 404 (assigned to someone else).
            if (currentStatus === 'PENDING') {
                await conn.rollback();
                throw new ApiError(409, 'Invalid complaint status transition');
            }
            await conn.rollback();
            throw new ApiError(404, 'Complaint not found');
        }

        // --- 2. Validate the transition. ---
        const key = `${currentStatus}->${requestedStatus}`;
        if (!VALID_TRANSITIONS.has(key)) {
            await conn.rollback();
            throw new ApiError(409, 'Invalid complaint status transition');
        }

        // --- 3. UPDATE complaints.status ---
        // The FOR UPDATE on the SELECT guarantees no one else
        // changed c.status since we read it. The WHERE clause
        // pins the source status as an extra safety belt: if the
        // lock somehow leaks (it cannot with InnoDB + autocommit
        // off, but defence in depth is cheap), the UPDATE
        // affects zero rows and we roll back.
        const [updateResult] = await conn.query(
            `UPDATE complaints
             SET status = ?
             WHERE complaint_id = ?
               AND status = ?`,
            [requestedStatus, complaintId, currentStatus]
        );
        if (updateResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(409, 'Invalid complaint status transition');
        }

        // --- 4. INSERT complaint_history ---
        // changed_by is users.user_id (FK on complaint_history).
        const [historyResult] = await conn.query(
            `INSERT INTO complaint_history
                 (complaint_id, changed_by, old_status, new_status, note)
             VALUES (?, ?, ?, ?, ?)`,
            [complaintId, userId, currentStatus, requestedStatus, note]
        );
        if (historyResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(500, 'Failed to record status history');
        }

        await conn.commit();

        return shapeSuccessResponse(complaintId, requestedStatus);
    } catch (err) {
        // Best-effort rollback if anything threw after beginTransaction.
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        if (err instanceof ApiError) throw err;
        console.error('[workerComplaintService.updateComplaintStatusByWorker] unexpected error:', err.message);
        throw new ApiError(500, 'Internal server error');
    } finally {
        conn.release();
    }
}

// Shape a row from the worker assigned complaints query into the response payload.
function shapeAssignedComplaintRow(row) {
    return {
        complaintId: row.complaint_id,
        studentName: row.student_name,
        roomNumber:  row.room_number,
        hostelName:  row.hostel_name,
        category:    row.category_name,
        title:       row.title,
        description: row.description,
        priority:    row.priority,
        status:      row.status,
        assignedAt:  row.assigned_at,
        createdAt:   row.created_at,
    };
}

// List all complaints actively assigned to the authenticated worker.
// Gated by the worker's user_id and assignments.is_active = TRUE.
async function listAssignedComplaints(userId) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }

    const [rows] = await pool.query(
        `SELECT
             c.complaint_id,
             c.title,
             c.description,
             c.priority,
             c.status,
             c.created_at,
             s.name         AS student_name,
             r.room_number  AS room_number,
             h.hostel_name  AS hostel_name,
             cc.category_name,
             a.assigned_at
         FROM complaints c
         JOIN assignments a           ON a.complaint_id = c.complaint_id
         JOIN workers w               ON w.worker_id = a.worker_id
         JOIN students s              ON s.student_id = c.student_id
         JOIN rooms r                 ON r.room_id = s.room_id
         JOIN hostels h               ON h.hostel_id = r.hostel_id
         JOIN complaint_categories cc ON cc.category_id = c.category_id
         WHERE w.user_id = ?
           AND a.is_active = TRUE
         ORDER BY c.created_at DESC, c.complaint_id DESC`,
        [userId]
    );

    return rows.map(shapeAssignedComplaintRow);
}

module.exports = {
    listAssignedComplaints,
    updateComplaintStatusByWorker,
    normalizeStatus,
    ALLOWED_REQUESTED_STATUSES,
    VALID_TRANSITIONS,
    NOTE_MAX,
    DEFAULT_NOTE,
};

