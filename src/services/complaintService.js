// ===========================================================
// Complaint Service — student complaint creation + viewing
// ===========================================================
// Phase 4A (create) and Phase 4B (view) are the only phases this
// service implements. It does NOT do assignment, status updates,
// or any other lifecycle action.
//
// Responsibilities:
//   * Validate that the authenticated user has a students row.
//   * Resolve the category name to category_id.
//   * Insert the complaint and its initial history row in ONE
//     transaction (create).
//   * List/get a student's complaints, with ownership enforced
//     by SQL — never by post-filtering in JS.
//
// What this service deliberately does NOT do:
//   * Read student_id, category, title, description, status, or
//     priority from the request body — they come from the
//     controller after validation.
//   * Trust any identifier from req.body / req.query /
//     req.params — student_id is derived from req.user.userId,
//     which authenticate() set from the verified JWT.
//   * Surface raw SQL error messages to the controller — the
//     errorHandler logs them; we throw ApiError.
// ===========================================================

const pool = require('../config/db');
const ApiError = require('../utils/apiError');

// Resolve a students.student_id from users.user_id. Returns null
// if the user has no corresponding students row (e.g. a warden
// or worker — but authorize('STUDENT') should have already
// filtered those, so this is a defensive check).
async function findStudentIdByUserId(userId) {
    const [rows] = await pool.query(
        'SELECT student_id FROM students WHERE user_id = ? LIMIT 1',
        [userId]
    );
    return rows.length > 0 ? rows[0].student_id : null;
}

// Resolve category_id from category_name. Returns null if the
// category does not exist.
async function findCategoryIdByName(categoryName) {
    const [rows] = await pool.query(
        'SELECT category_id FROM complaint_categories WHERE category_name = ? LIMIT 1',
        [categoryName]
    );
    return rows.length > 0 ? rows[0].category_id : null;
}

// Create a complaint. The caller (controller) has already
// validated that title / description / category are non-empty
// and within length limits. We trim them here to canonicalize
// the stored values.
//
// Returns { complaintId, status, priority } on success.
async function createComplaint({ userId, category, title, description }) {
    if (!Number.isInteger(userId) || userId <= 0) {
        // Defensive — req.user.userId is set by authenticate, so
        // this branch should be unreachable.
        throw new ApiError(401, 'Authentication required');
    }

    // 1. Resolve student_id. Distinguishing "no students row" from
    //    "category missing" matters: the spec asks for 404 in both
    //    cases, but with different messages so we can debug.
    const studentId = await findStudentIdByUserId(userId);
    if (!studentId) {
        throw new ApiError(404, 'Student profile not found');
    }

    // 2. Resolve category_id.
    const categoryId = await findCategoryIdByName(category);
    if (!categoryId) {
        throw new ApiError(404, 'Category not found');
    }

    // 3. Trim canonical inputs. We do this AFTER validation so the
    //    validator can give precise length errors, but BEFORE
    //    insert so we never store leading/trailing whitespace.
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    // 4. Atomic insert. complaint first, then history. The
    //    history INSERT references the new complaint's id, so
    //    the order is fixed.
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [complaintResult] = await conn.query(
            `INSERT INTO complaints
                (student_id, category_id, title, priority, status, description)
             VALUES (?, ?, ?, 'LOW', 'PENDING', ?)`,
            [studentId, categoryId, cleanTitle, cleanDescription]
        );

        const complaintId = complaintResult.insertId;
        if (!complaintId) {
            // mysql2 always returns insertId for AUTO_INCREMENT
            // INSERTs, but we check defensively.
            await conn.rollback();
            throw new ApiError(500, 'Failed to create complaint');
        }

        const [historyResult] = await conn.query(
            `INSERT INTO complaint_history
                (complaint_id, changed_by, old_status, new_status, note)
             VALUES (?, ?, NULL, 'PENDING', ?)`,
            [complaintId, userId, 'Complaint created by student']
        );

        if (historyResult.affectedRows !== 1) {
            // History insert did not affect exactly one row — that
            // means something went wrong at the DB level. Roll
            // back so the complaint insert doesn't survive alone.
            await conn.rollback();
            throw new ApiError(500, 'Failed to create complaint history');
        }

        await conn.commit();

        return {
            complaintId,
            status: 'PENDING',
            priority: 'LOW',
        };
    } catch (err) {
        // Best-effort rollback if we haven't already. The
        // errorHandler will surface the right status code from
        // the ApiError; raw SQL errors get logged and turned
        // into 500s by the central handler.
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        // Re-throw ApiErrors as-is; wrap everything else.
        if (err instanceof ApiError) throw err;
        console.error('[complaintService.createComplaint] unexpected error:', err.message);
        throw new ApiError(500, 'Internal server error');
    } finally {
        conn.release();
    }
}

// ===========================================================
// Phase 4B — student complaint viewing
// ===========================================================
// All three of these functions enforce ownership by joining
// `complaints` with `students` and filtering on s.user_id = ?
// (the JWT-derived user id). We never fetch a row by id alone
// and then check ownership in JavaScript — the SQL WHERE clause
// is the only authorization gate.
// ===========================================================

// Helper: shape a raw complaints JOIN row into the response
// payload shape used by both list and detail endpoints.
function shapeComplaintRow(row) {
    return {
        complaintId:        row.complaint_id,
        category:           row.category_name,
        title:              row.title,
        description:        row.description,
        priority:           row.priority,
        status:             row.status,
        createdAt:          row.created_at,
        roomNumber:         row.room_number         || null,
        hostelName:         row.hostel_name         || null,
        assignedWorkerName: row.assigned_worker_name || null,
    };
}

// List every complaint that belongs to the authenticated
// student, newest first. Returns [] when the student has none —
// empty is not an error here.
//
// Ownership is enforced by SQL: the join with `students` and
// the s.user_id = ? predicate mean we cannot accidentally return
// another student's rows, even if a future caller passes a
// wrong userId by mistake.
async function findMyComplaints(userId) {
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
             cc.category_name,
             r.room_number,
             h.hostel_name,
             wk.name       AS assigned_worker_name
         FROM complaints c
         JOIN students s
             ON c.student_id = s.student_id
         JOIN rooms r
             ON r.room_id = s.room_id
         JOIN hostels h
             ON h.hostel_id = r.hostel_id
         JOIN complaint_categories cc
             ON c.category_id = cc.category_id
         LEFT JOIN assignments a
             ON a.complaint_id = c.complaint_id
            AND a.is_active = TRUE
         LEFT JOIN workers wk
             ON wk.worker_id = a.worker_id
         WHERE s.user_id = ?
         ORDER BY c.created_at DESC, c.complaint_id DESC`,
        [userId]
    );

    return rows.map(shapeComplaintRow);
}

// Look up one complaint by id, but ONLY if it belongs to the
// authenticated student. Returns null otherwise.
//
// We deliberately do not distinguish between "id does not
// exist" and "id exists but belongs to another student" — both
// yield null and the controller maps that to 404. This avoids
// leaking the existence of other students' complaints.
async function findMyComplaintById(userId, complaintId) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        // Controller should have rejected this already; defence
        // in depth.
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
             cc.category_name,
             r.room_number,
             h.hostel_name,
             wk.name       AS assigned_worker_name
         FROM complaints c
         JOIN students s
             ON c.student_id = s.student_id
         JOIN rooms r
             ON r.room_id = s.room_id
         JOIN hostels h
             ON h.hostel_id = r.hostel_id
         JOIN complaint_categories cc
             ON c.category_id = cc.category_id
         LEFT JOIN assignments a
             ON a.complaint_id = c.complaint_id
            AND a.is_active = TRUE
         LEFT JOIN workers wk
             ON wk.worker_id = a.worker_id
         WHERE c.complaint_id = ?
           AND s.user_id = ?
         LIMIT 1`,
        [complaintId, userId]
    );

    return rows.length > 0 ? shapeComplaintRow(rows[0]) : null;
}

// Return the history rows for one complaint, oldest first.
// Caller MUST have already established that the complaint
// belongs to the authenticated student (via findMyComplaintById)
// — we do not re-check ownership here, because by the time this
// runs the complaint id has already been validated to belong to
// the caller.
//
// Per spec we do NOT expose changed_by user IDs in this phase.
async function findComplaintHistory(complaintId) {
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }

    const [rows] = await pool.query(
        `SELECT
             h.history_id,
             h.old_status,
             h.new_status,
             h.note,
             h.changed_at
         FROM complaint_history h
         WHERE h.complaint_id = ?
         ORDER BY h.changed_at ASC, h.history_id ASC`,
        [complaintId]
    );

    return rows.map(r => ({
        historyId:  r.history_id,
        oldStatus:  r.old_status,
        newStatus:  r.new_status,
        note:       r.note,
        changedAt:  r.changed_at,
    }));
}

// ===========================================================
// Phase 4F — Student closure and reopening
// ===========================================================
// Two endpoints let a student act on a complaint that has been
// fully resolved:
//
//   RESOLVED -> CLOSED   (close)    — student accepts the fix
//   RESOLVED -> PENDING  (reopen)   — student rejects / reopens
//
// Reopening hands the complaint back to the PENDING pool so
// the warden assignment flow (Phase 4D) can run again. To
// prevent the previously-assigned worker from quietly acting
// on the freshly-PENDING complaint through a stale assignment,
// the reopen transaction also deactivates any existing active
// assignment row for this complaint. Phase 4D creates fresh
// assignments with is_active = TRUE; nothing about the schema
// or the assignment model changes here.
//
// Identity / security:
//   * student_id is NEVER read from the request. It is derived
//     from req.user.userId via a JOIN students.s.user_id = ?.
//   * Ownership is enforced in SQL (WHERE s.user_id = ?); a
//     complaint that exists but belongs to another student
//     yields 0 rows and the controller maps that to 404.
//   * The status transition is validated AFTER the row lock,
//     so a concurrent worker status update cannot sneak in.
//
// Throws ApiError:
//   400 - invalid input (defence in depth; controller validates)
//   401 - missing/invalid userId
//   404 - complaint does not exist OR belongs to another student
//   409 - invalid transition for the complaint's current status
// ===========================================================

const STUDENT_NOTE_MAX = 1000;
const STUDENT_DEFAULT_CLOSE_NOTE  = 'Complaint closed by student';
const STUDENT_DEFAULT_REOPEN_NOTE = 'Complaint reopened by student';

// Validate + normalize a student-supplied note. Mirrors the
// worker note validator so both endpoints behave identically.
function normalizeStudentNote(rawNote, defaultNote) {
    if (rawNote === undefined || rawNote === null) {
        return { ok: true, note: defaultNote };
    }
    if (typeof rawNote !== 'string') {
        return { ok: false, error: 'note must be a string' };
    }
    const trimmed = rawNote.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: 'note must not be empty' };
    }
    if (trimmed.length > STUDENT_NOTE_MAX) {
        return { ok: false, error: `note must be at most ${STUDENT_NOTE_MAX} characters` };
    }
    return { ok: true, note: trimmed };
}

// Generic driver for the two Phase 4F transitions. We keep the
// status-transition table local to this file rather than
// sharing it with the worker service, because the two roles
// govern different halves of the lifecycle.
//
//   expectedCurrent  : the only status from which this transition
//                      is allowed (e.g. 'RESOLVED' for close)
//   targetStatus     : where the complaint moves to
//   defaultNote      : fallback history note when the client
//                      doesn't supply one
//   successMessage   : surfaced via the controller's response
async function runStudentStatusTransition({
    userId, complaintId, rawNote,
    expectedCurrent, targetStatus, defaultNote,
    deactivateActiveAssignment = false,
}) {
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    if (!Number.isInteger(complaintId) || complaintId <= 0) {
        throw new ApiError(400, 'Invalid complaint id');
    }

    const noteResult = normalizeStudentNote(rawNote, defaultNote);
    if (!noteResult.ok) {
        throw new ApiError(400, noteResult.error);
    }
    const note = noteResult.note;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- 1. Lock the complaint row, gated by ownership
        //        (students.user_id = ?). The JOIN through students
        //        means "no row" covers both "complaint doesn't
        //        exist" and "complaint belongs to another student"
        //        with the same 404 response, so we never leak
        //        another student's complaint id. ---
        const [rows] = await conn.query(
            `SELECT
                 c.complaint_id,
                 c.status
             FROM complaints c
             JOIN students s
                 ON c.student_id = s.student_id
             WHERE c.complaint_id = ?
               AND s.user_id = ?
             LIMIT 1
             FOR UPDATE`,
            [complaintId, userId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            throw new ApiError(404, 'Complaint not found');
        }
        const currentStatus = rows[0].status;

        // --- 2. Validate the transition ---
        if (currentStatus !== expectedCurrent) {
            await conn.rollback();
            throw new ApiError(
                409,
                targetStatus === 'CLOSED'
                    ? 'Complaint cannot be closed in its current status'
                    : 'Complaint cannot be reopened in its current status',
            );
        }

        // --- 3. (Reopen only) Deactivate any active assignment
        //        so the previous worker cannot quietly drive the
        //        freshly-PENDING complaint through Phase 4E.
        //        Phase 4D will create a fresh assignment when the
        //        warden re-assigns it. ---
        if (deactivateActiveAssignment) {
            // We do NOT inspect affectedRows — it's allowed (and
            // expected on a never-assigned complaint) that this
            // updates zero rows. The deactivation is idempotent
            // for our purposes: the goal is "no active assignment
            // for this complaint", and this UPDATE brings the
            // table into that state whether or not any rows
            // matched.
            await conn.query(
                `UPDATE assignments
                 SET is_active = FALSE
                 WHERE complaint_id = ?
                   AND is_active = TRUE`,
                [complaintId]
            );
        }

        // --- 4. UPDATE complaints.status, pinned to the current
        //        status as defence in depth. ---
        const [updateResult] = await conn.query(
            `UPDATE complaints
             SET status = ?
             WHERE complaint_id = ?
               AND status = ?`,
            [targetStatus, complaintId, expectedCurrent]
        );
        if (updateResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(409, 'Complaint cannot be transitioned in its current status');
        }

        // --- 5. INSERT complaint_history ---
        const [historyResult] = await conn.query(
            `INSERT INTO complaint_history
                 (complaint_id, changed_by, old_status, new_status, note)
             VALUES (?, ?, ?, ?, ?)`,
            [complaintId, userId, expectedCurrent, targetStatus, note]
        );
        if (historyResult.affectedRows !== 1) {
            await conn.rollback();
            throw new ApiError(500, 'Failed to record status history');
        }

        await conn.commit();

        return {
            complaintId,
            status: targetStatus,
        };
    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        if (err instanceof ApiError) throw err;
        console.error('[complaintService.runStudentStatusTransition] unexpected error:', err.message);
        throw new ApiError(500, 'Internal server error');
    } finally {
        conn.release();
    }
}

// Student-driven close: RESOLVED -> CLOSED.
async function closeComplaintByStudent(userId, complaintId, rawNote) {
    return runStudentStatusTransition({
        userId,
        complaintId,
        rawNote,
        expectedCurrent: 'RESOLVED',
        targetStatus: 'CLOSED',
        defaultNote: STUDENT_DEFAULT_CLOSE_NOTE,
        // Closing does not touch assignments — a CLOSED
        // complaint has no further transitions in Phase 4F, so
        // an old (still-active) assignment is harmless and can
        // be left for auditing.
        deactivateActiveAssignment: false,
    });
}

// Student-driven reopen: RESOLVED -> PENDING.
async function reopenComplaintByStudent(userId, complaintId, rawNote) {
    return runStudentStatusTransition({
        userId,
        complaintId,
        rawNote,
        expectedCurrent: 'CLOSED',
        targetStatus: 'PENDING',
        defaultNote: STUDENT_DEFAULT_REOPEN_NOTE,
        // Reopen MUST deactivate the old assignment. Without
        // this, the previous worker could call
        // PATCH /api/worker/complaints/:id/status and Phase 4E
        // would see is_active = TRUE for that worker — even
        // though the student just rejected the resolution. We
        // wipe is_active back to FALSE here; Phase 4D will set
        // it back to TRUE when the warden re-assigns.
        deactivateActiveAssignment: true,
    });
}

module.exports = {
    createComplaint,
    findMyComplaints,
    findMyComplaintById,
    findComplaintHistory,
    closeComplaintByStudent,
    reopenComplaintByStudent,
};