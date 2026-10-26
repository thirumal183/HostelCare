// ===========================================================
// Student Complaint Controller — HTTP layer for /api/student/complaints
// ===========================================================
// Phase 4F: PATCH /:id/close and PATCH /:id/reopen — student-driven
// terminal transitions on a complaint that has reached RESOLVED.
//
// Role enforcement happens in the route layer via authenticate +
// authorize('STUDENT'); the controller does NOT re-check role.
//
// Identity rule: req.user.userId is the ONLY source of truth
// for who is acting. The body / query / params / headers are
// NEVER consulted for student_id or user_id.
// ===========================================================

const complaintService = require('../services/complaintService');
const ApiError = require('../utils/apiError');

// Resolve req.user.userId into a positive integer or fail with 401.
// Defence in depth — authenticate() should have already enforced
// this, but we never trust the wire.
function requireUserId(req) {
    const userId = req.user && req.user.userId;
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    return userId;
}

// Validate that :id is a positive integer literal. Rejects "abc",
// "0", "-1", "1.5", "12abc", " 12 ", etc.
function requirePositiveIntParam(rawValue, label) {
    if (rawValue === undefined || rawValue === null) {
        throw new ApiError(400, `${label} is required`);
    }
    if (typeof rawValue !== 'string') {
        throw new ApiError(400, `${label} must be a positive integer`);
    }
    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
        throw new ApiError(400, `${label} is required`);
    }
    if (!/^\d+$/.test(trimmed)) {
        throw new ApiError(400, `${label} must be a positive integer`);
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, `${label} must be a positive integer`);
    }
    return n;
}

// Validate the optional `note` field at the edge. The service does
// the same check, but rejecting here means we never open a DB
// transaction for a request that was already malformed.
function validateOptionalNoteField(rawValue) {
    if (rawValue === undefined || rawValue === null) return null;
    if (typeof rawValue !== 'string') return 'note must be a string';
    return null;
}

// PATCH /api/student/complaints/:id/close
// Body: { note? }
// Transition: RESOLVED -> CLOSED
exports.close = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const body = req.body || {};
        const noteErr = validateOptionalNoteField(body.note);
        if (noteErr) throw new ApiError(400, noteErr);

        const result = await complaintService.closeComplaintByStudent(
            userId, complaintId, body.note,
        );
        return res.status(200).json({
            success: true,
            message: 'Complaint closed successfully',
            data: result,
        });
    } catch (err) {
        console.error('[studentComplaintController.close] failed:', err.message);
        return next(err);
    }
};

// PATCH /api/student/complaints/:id/reopen
// Body: { note? }
// Transition: RESOLVED -> PENDING
exports.reopen = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const body = req.body || {};
        const noteErr = validateOptionalNoteField(body.note);
        if (noteErr) throw new ApiError(400, noteErr);

        const result = await complaintService.reopenComplaintByStudent(
            userId, complaintId, body.note,
        );
        return res.status(200).json({
            success: true,
            message: 'Complaint reopened successfully',
            data: result,
        });
    } catch (err) {
        console.error('[studentComplaintController.reopen] failed:', err.message);
        return next(err);
    }
};
