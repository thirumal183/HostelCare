// ===========================================================
// Warden Complaint Controller — HTTP layer for /api/warden/complaints
// ===========================================================
// Phase 4C: list, detail, priority update for complaints in the
//           authenticated warden's hostel.
// Phase 4D: assign a PENDING complaint to a same-hostel worker
//           whose specialization matches the category.
//
// Role enforcement is in the route layer via authenticate +
// authorize('WARDEN'). The controller does NOT re-check role.
//
// Identity / hostel rule: req.user.userId is the ONLY source of
// truth. The hostel is derived from the wardens table by user_id
// — never from the body, query, params, or custom headers.
// ===========================================================

const wardenComplaintService = require('../services/wardenComplaintService');
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

// GET /api/warden/complaints
exports.list = async (req, res, next) => {
    try {
        const userId = requireUserId(req);

        const hostelId = await wardenComplaintService.findHostelIdByUserId(userId);
        if (!hostelId) {
            return res.status(404).json({
                success: false,
                message: 'Warden profile not found',
            });
        }

        const complaints = await wardenComplaintService.listHostelComplaints(hostelId);
        return res.status(200).json({
            success: true,
            data: { complaints },
        });
    } catch (err) {
        console.error('[wardenComplaintController.list] failed:', err.message);
        return next(err);
    }
};

// GET /api/warden/complaints/:id
exports.getById = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const complaint = await wardenComplaintService.findHostelComplaintById(userId, complaintId);
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        const history = await wardenComplaintService.findComplaintHistoryForWarden(complaintId);
        return res.status(200).json({
            success: true,
            data: { complaint, history },
        });
    } catch (err) {
        console.error('[wardenComplaintController.getById] failed:', err.message);
        return next(err);
    }
};

// PATCH /api/warden/complaints/:id/priority
exports.updatePriority = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const body = req.body || {};
        if (body.priority === undefined || body.priority === null) {
            throw new ApiError(400, 'priority is required');
        }
        if (typeof body.priority !== 'string') {
            throw new ApiError(400, 'priority must be a string');
        }
        const newPriority = wardenComplaintService.normalizePriority(body.priority);
        if (!newPriority) {
            throw new ApiError(400, 'priority must be one of LOW, MEDIUM, HIGH, CRITICAL');
        }

        const ok = await wardenComplaintService.updateHostelComplaintPriority(userId, complaintId, newPriority);
        if (!ok) {
            // Either the complaint does not exist or it belongs to
            // another hostel. Same response for both to avoid
            // leaking the existence of other hostels' complaints.
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Complaint priority updated successfully',
            data: { complaintId, priority: newPriority },
        });
    } catch (err) {
        console.error('[wardenComplaintController.updatePriority] failed:', err.message);
        return next(err);
    }
};

// POST /api/warden/complaints/:id/assign
// Body: { workerId }
//
// Validates complaint :id and workerId at the edge, then
// delegates the entire transactional flow (ownership + status +
// worker validation + INSERT + UPDATE + history) to the service.
// All non-200 outcomes are signalled by ApiError status codes.
exports.assign = async (req, res, next) => {
    try {
        const userId = requireUserId(req);
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        const body = req.body || {};
        if (body.workerId === undefined || body.workerId === null) {
            throw new ApiError(400, 'workerId is required');
        }
        if (typeof body.workerId !== 'number' || !Number.isInteger(body.workerId) || body.workerId <= 0) {
            // Accept only a JSON number (not a string like "12"
            // or "12abc"). Clients must send a real integer.
            throw new ApiError(400, 'workerId must be a positive integer');
        }
        const workerId = body.workerId;

        const result = await wardenComplaintService.assignComplaintToWorker(userId, complaintId, workerId);

        return res.status(200).json({
            success: true,
            message: 'Complaint assigned successfully',
            data: result,
        });
    } catch (err) {
        console.error('[wardenComplaintController.assign] failed:', err.message);
        return next(err);
    }
};