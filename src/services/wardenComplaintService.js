// ===========================================================
// Warden Complaint Service — Phases 4C + 4D
// ===========================================================
// Warden-side complaint viewing (4C) and assignment (4D).
//
// Scope:
//   * List complaints belonging to the warden's hostel.
//   * Get one complaint (only if it belongs to the warden's
//     hostel) plus its history.
//   * Update the priority of a complaint (only if it belongs to
//     the warden's hostel).
//   * Assign a PENDING complaint to a same-hostel worker whose
//     specialization matches the complaint category (4D).
//
// What this service deliberately does NOT do:
//   * Worker complaint viewing APIs (worker dashboard).
//   * Worker status updates (IN_PROGRESS / RESOLVED / CLOSED).
//   * Priority history (complaint_history tracks status only).
//   * Trust any hostel_id from req.body / req.query /
//     req.params / req.headers. The hostel is ALWAYS derived
//     from the JWT-derived userId via the wardens table.
//   * Trust client-supplied worker hostel_id or specialization —
//     both come from the workers table.
//   * Filter in JavaScript after fetching. The hostel gate
//     lives in the SQL WHERE clause.
// ===========================================================

const pool = require('../config/db');
const ApiError = require('../utils/apiError');

const ALLOWED_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Normalize a priority value sent by the client: trim, uppercase,
// and validate against the allowed enum. Returns the canonical
// upper-case value on success.
function normalizePriority(raw) {
    if (typeof raw !== 'string') return null;
    const upper = raw.trim().toUpperCase();
    return ALLOWED_PRIORITIES.has(upper) ? upper : null;
}

// Look up the hostel assigned to a warden by their user_id.
// Returns null if the user has no wardens row.
async function findHostelIdByUserId(userId) {
    const [rows] = await pool.query(
        'SELECT hostel_id FROM wardens WHERE user_id = ? LIMIT 1',
        [userId]
    );
    return rows.length > 0 ? rows[0].hostel_id : null;
}

// Shape a row from the list/get query into the response payload.
// Hides DB column names and exposes only the fields the spec
// asks for.
function shapeComplaintRow(row) {
    return {
        complaintId:        row.complaint_id,
        studentName:        row.student_name,
        roomNumber:         row.room_number,
        hostelName:         row.hostel_name        || null,
        category:           row.category_name,
        title:              row.title,
        description:        row.description,
        priority:           row.priority,
        status:             row.status,
        createdAt:          row.created_at,
        assignedWorkerName: row.assigned_worker_name || null,
    };
}

// List every complaint that belongs to the warden's hostel.
// The warden must already exist (caller checked hostel_id).
// Returns [] when the hostel has no complaints.
async function listHostelComplaints(hostelId) {
    if (!Number.isInteger(hostelId) || hostelId <= 0) {
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
             s.name        AS student_name,
             r.room_number AS room_number,
             h.hostel_name AS hostel_name,
             cc.category_name,
             wk.name       AS assigned_worker_name
         FROM complaints c
         JOIN students s
             ON c.student_id = s.student_id
         JOIN rooms r
             ON s.room_id = r.room_id
         JOIN hostels h
             ON h.hostel_id = r.hostel_id
         JOIN complaint_categories cc
             ON c.category_id = cc.category_id
         LEFT JOIN assignments a
             ON a.complaint_id = c.complaint_id
            AND a.is_active = TRUE
         LEFT JOIN workers wk
             ON wk.worker_id = a.worker_id
         WHERE r.hostel_id = ?
         ORDER BY c.created_at DESC, c.complaint_id DESC`,
        [hostelId]
    );
    return rows.map(shapeComplaintRow);
}

// Fetch ONE complaint by id, but only if it belongs to the
// warden's hostel. Hostel membership is enforced in SQL by
// joining through students -> rooms -> wardens.hostel_id and
// filtering on w.user_id = ?. Returns null otherwise.
//
// We do NOT distinguish "id does not exist" from "id exists but
// belongs to another hostel" — both yield null and the
// controller maps that to 404. This avoids leaking which
// complaint IDs exist in other hostels.
async function findHostelComplaintById(userId, complaintId) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }
    const [rows] = await pool.query(
        `SELECT
             c.complaint_id,
             c.title,
             c.description,
             c.priority,
             c.status,
             c.created_at,
             s.name        AS student_name,
             r.room_number AS room_number,
             h.hostel_name AS hostel_name,
             cc.category_name,
             wk.name       AS assigned_worker_name
         FROM complaints c
         JOIN students s
             ON c.student_id = s.student_id
         JOIN rooms r
             ON s.room_id = r.room_id
         JOIN hostels h
             ON h.hostel_id = r.hostel_id
         JOIN complaint_categories cc
             ON c.category_id = cc.category_id
         JOIN wardens w
             ON w.hostel_id = r.hostel_id
         LEFT JOIN assignments a
             ON a.complaint_id = c.complaint_id
            AND a.is_active = TRUE
         LEFT JOIN workers wk
             ON wk.worker_id = a.worker_id
         WHERE c.complaint_id = ?
           AND w.user_id = ?
         LIMIT 1`,
        [complaintId, userId]
    );
    return rows.length > 0 ? shapeComplaintRow(rows[0]) : null;
}

// History for one complaint. Like the student-side version, this
// only runs AFTER the ownership-checked detail fetch succeeds,
// so we never return history for a row the caller cannot see.
// We do NOT expose changed_by per Phase 4C spec.
async function findComplaintHistoryForWarden(complaintId) {
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }
    const [rows] = await pool.query(
        `SELECT history_id, old_status, new_status, note, changed_at
         FROM complaint_history
         WHERE complaint_id = ?
         ORDER BY changed_at ASC, history_id ASC`,
        [complaintId]
    );
    return rows.map(r => ({
        historyId: r.history_id,
        oldStatus: r.old_status,
        newStatus: r.new_status,
        note:      r.note,
        changedAt: r.changed_at,
    }));
}

// Update the priority of a complaint, but ONLY if it belongs to
// the warden's hostel. Hostel membership is enforced in SQL by
// the JOIN chain students -> rooms -> wardens.hostel_id with
// w.user_id = ? as a WHERE predicate.
//
// Per spec this is a single UPDATE — no transaction needed.
// We do NOT touch complaint_history because the existing schema
// tracks status changes, not priority changes.
//
// Returns true if exactly one row was updated, false otherwise.
async function updateHostelComplaintPriority(userId, complaintId, newPriority) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }
    if (!ALLOWED_PRIORITIES.has(newPriority)) {
        throw new ApiError(400, 'Invalid priority');
    }

    const [result] = await pool.query(
        `UPDATE complaints c
         JOIN students s
             ON c.student_id = s.student_id
         JOIN rooms r
             ON s.room_id = r.room_id
         JOIN wardens w
             ON w.hostel_id = r.hostel_id
         SET c.priority = ?
         WHERE c.complaint_id = ?
           AND w.user_id = ?`,
        [newPriority, complaintId, userId]
    );
    return result.affectedRows === 1;
}

// ===========================================================
// Phase 4D — Worker assignment
// ===========================================================
// A warden may assign a PENDING complaint to a worker IF AND
// ONLY IF:
//   * the complaint is in the warden's hostel,
//   * the complaint's status is currently 'PENDING',
//   * the worker exists,
//   * the worker belongs to the SAME hostel as the complaint,
//   * the worker's specialization matches the complaint's
//     category_name.
//
// All three writes (assignment INSERT, complaint UPDATE,
// history INSERT) happen inside ONE transaction. If any step
// fails, the whole thing rolls back.
//
// Status transition: PENDING -> ASSIGNED.
// History note: 'Complaint assigned to worker'.
// assigned_by: wardens.warden_id (NOT users.user_id) — the
// assignments.assigned_by FK points at wardens.
// ===========================================================

// Category names that have NO matching worker specialization in
// the current seed. For these, assignment is a business error
// rather than a successful "assign to nobody" — we never invent
// workers for them.
const UNASSIGNABLE_CATEGORIES = new Set(['Water', 'Other']);

// Assign a complaint to a worker. Throws ApiError with the
// exact status code described in the Phase 4D spec:
//
//   400 - invalid input (defence in depth; controller validates)
//   401 - missing/invalid userId
//   404 - warden profile missing
//       - complaint not found / not in warden's hostel
//       - worker does not exist
//   409 - complaint not in PENDING state
//       - worker belongs to a different hostel
//       - worker specialization mismatch
//       - complaint's category has no matching worker
//         specialization in the current seed (Water / Other)
async function assignComplaintToWorker(userId, complaintId, workerId) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }
    if (!Number.isInteger(workerId) || workerId <= 0) {
        throw new ApiError(400, 'Invalid worker id');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- 1. Resolve warden's warden_id and hostel_id ---
        // assignments.assigned_by is a FK to wardens.warden_id, so
        // we need the warden row, not just the user_id.
        const [wardenRows] = await conn.query(
            'SELECT warden_id, hostel_id FROM wardens WHERE user_id = ? LIMIT 1',
            [userId]
        );
        if (wardenRows.length === 0) {
            await conn.rollback();
            throw new ApiError(404, 'Warden profile not found');
        }
        const wardenId = wardenRows[0].warden_id;
        const wardenHostelId = wardenRows[0].hostel_id;

        // --- 2. Load the complaint + room + category, gated by
        //        warden's hostel. Returns null if the complaint
        //        does not exist OR belongs to another hostel —
        //        same response either way. ---
        const [complaintRows] = await conn.query(
            `SELECT
                 c.complaint_id,
                 c.status,
                 c.priority,
                 cc.category_name
             FROM complaints c
             JOIN students s               ON c.student_id = s.student_id
             JOIN rooms r                  ON s.room_id = r.room_id
             JOIN complaint_categories cc  ON c.category_id = cc.category_id
             WHERE c.complaint_id = ?
               AND r.hostel_id = ?
             LIMIT 1`,
            [complaintId, wardenHostelId]
        );
        if (complaintRows.length === 0) {
            await conn.rollback();
            throw new ApiError(404, 'Complaint not found');
        }
        const complaint = complaintRows[0];

        // --- 3. Only PENDING complaints can be assigned. ---
        if (complaint.status !== 'PENDING') {
            await conn.rollback();
            throw new ApiError(409, 'Complaint cannot be assigned in its current status');
        }

        // --- 4. Load worker. The worker MUST exist, MUST be in
        //        the SAME hostel as the complaint, and MUST have
        //        a specialization matching the complaint category. ---
        const [workerRows] = await conn.query(
            `SELECT worker_id, hostel_id, specialization
             FROM workers
             WHERE worker_id = ?
             LIMIT 1`,
            [workerId]
        );
        if (workerRows.length === 0) {
            await conn.rollback();
            throw new ApiError(404, 'Worker not found');
        }
        const worker = workerRows[0];

        // --- 5. Same-hostel check ---
        if (worker.hostel_id !== wardenHostelId) {
            await conn.rollback();
            throw new ApiError(409, 'Worker does not belong to this hostel');
        }

        // --- 6. Specialization match ---
        // The complaint category is what the student reported.
        // Workers specialize per category. Phase 4D only has
        // workers for the 5 main categories; Water / Other have
        // no matching worker in the seed.
        if (UNASSIGNABLE_CATEGORIES.has(complaint.category_name)) {
            await conn.rollback();
            throw new ApiError(409, `No worker available for category "${complaint.category_name}"`);
        }
        if (worker.specialization !== complaint.category_name) {
            await conn.rollback();
            throw new ApiError(409, 'Worker specialization does not match complaint category');
        }

        // --- 7. INSERT assignment ---
        const [assignResult] = await conn.query(
            `INSERT INTO assignments (complaint_id, worker_id, assigned_by, is_active)
             VALUES (?, ?, ?, TRUE)`,
            [complaintId, workerId, wardenId]
        );
        if (assignResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(500, 'Failed to create assignment');
        }

        // --- 8. UPDATE complaint status PENDING -> ASSIGNED ---
        const [updateResult] = await conn.query(
            `UPDATE complaints
             SET status = 'ASSIGNED'
             WHERE complaint_id = ?
               AND status = 'PENDING'`,
            [complaintId]
        );
        if (updateResult.affectedRows !== 1) {
            // Defence in depth: if the status moved between our
            // SELECT and our UPDATE, abort and roll back the
            // assignment INSERT too.
            await conn.rollback();
            throw new ApiError(409, 'Complaint cannot be assigned in its current status');
        }

        // --- 9. INSERT history row ---
        // changed_by references users.user_id (FK on the
        // complaint_history table).
        const [historyResult] = await conn.query(
            `INSERT INTO complaint_history
                 (complaint_id, changed_by, old_status, new_status, note)
             VALUES (?, ?, 'PENDING', 'ASSIGNED', ?)`,
            [complaintId, userId, 'Complaint assigned to worker']
        );
        if (historyResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(500, 'Failed to record assignment history');
        }

        await conn.commit();

        return {
            complaintId,
            workerId,
            status: 'ASSIGNED',
        };
    } catch (err) {
        // Best-effort rollback if we haven't already.
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        // Re-throw ApiErrors; surface everything else as 500.
        if (err instanceof ApiError) throw err;
        console.error('[wardenComplaintService.assignComplaintToWorker] unexpected error:', err.message);
        throw new ApiError(500, 'Internal server error');
    } finally {
        conn.release();
    }
}

module.exports = {
    findHostelIdByUserId,
    listHostelComplaints,
    findHostelComplaintById,
    findComplaintHistoryForWarden,
    updateHostelComplaintPriority,
    assignComplaintToWorker,
    normalizePriority,
    ALLOWED_PRIORITIES,
};