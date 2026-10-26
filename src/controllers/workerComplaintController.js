// ===========================================================
// Worker Complaint Controller — HTTP layer for /api/worker/complaints
// ===========================================================
// Phase 4E: PATCH /:id/status for the worker status lifecycle.
//
// Role enforcement is at the route layer via authenticate +
// authorize('WORKER'). The controller does NOT re-check role.
//
// Identity rule: req.user.userId is the ONLY source of truth.
// worker_id from the body is deliberately IGNORED — the spec
// requires the server to ignore any workerId the client sends
// and always resolve the acting worker from req.user.userId.
// ===========================================================

const workerComplaintService = require('../services/workerComplaintService');
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

// PATCH /api/worker/complaints/:id/status
// Body: { status, note? }
//
// Validates at the edge: complaintId is a positive int, status
// is required and a string. Note is optional; if present it
// must be a string within length limits. All semantic checks
// (ownership, transition, etc.) happen in the service.
exports.updateStatus = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const body = req.body || {};

        // status is required.
        if (body.status === undefined || body.status === null) {
            throw new ApiError(400, 'status is required');
        }
        if (typeof body.status !== 'string') {
            throw new ApiError(400, 'status must be a string');
        }

        // note is optional. If absent or undefined it's allowed.
        // If present, it MUST be a string — non-string types
        // (numbers, objects, arrays) are 400.
        if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
            throw new ApiError(400, 'note must be a string');
        }

        // Per spec: even if the client sends workerId / worker_id
        // in the body, we MUST NOT use it. The only worker we
        // resolve is the one behind req.user.userId.
        // (No code path here reads body.workerId — by design.)

        const result = await workerComplaintService.updateComplaintStatusByWorker(
            userId,
            complaintId,
            body.status,
            body.note,
        );

        return res.status(200).json({
            success: true,
            message: 'Complaint status updated successfully',
            data: result,
        });
    } catch (err) {
        console.error('[workerComplaintController.updateStatus] failed:', err.message);
        return next(err);
    }
};

// GET /api/worker/complaints
// Returns all complaints actively assigned to the authenticated worker.
exports.listAssigned = async (req, res, next) => {
    try {
        const userId = requireUserId(req);

        const complaints = await workerComplaintService.listAssignedComplaints(userId);

        return res.status(200).json({
            success: true,
            data: { complaints },
        });
    } catch (err) {
        console.error('[workerComplaintController.listAssigned] failed:', err.message);
        return next(err);
    }
};

