// ===========================================================
// Complaint Controller — HTTP layer for /api/complaints
// ===========================================================
// Phase 4A: POST /api/complaints (student creation)
// Phase 4B: GET  /api/complaints          (student list)
//           GET  /api/complaints/:id      (student detail + history)
//
// Role enforcement happens in the route layer via
// authenticate + authorize('STUDENT'); the controller does NOT
// re-check role.
//
// Identity rule: req.user.userId is the ONLY source of truth
// for who is acting. The body / query / params / headers are
// NEVER consulted for student_id or user_id.
// ===========================================================

const complaintService = require('../services/complaintService');
const ApiError = require('../utils/apiError');

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 2000;
const CATEGORY_MAX = 50;

// Validate a string field: required, non-empty after trim,
// within max length. Returns null on success, error string on failure.
function validateStringField(value, label, maxLength) {
    if (value === undefined || value === null) {
        return `${label} is required`;
    }
    if (typeof value !== 'string') {
        return `${label} must be a string`;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return `${label} is required`;
    }
    if (trimmed.length > maxLength) {
        return `${label} must be at most ${maxLength} characters`;
    }
    return null;
}

// Resolve req.user.userId into an integer user id, or throw 401
// if the authenticate middleware somehow didn't set it. This is
// the single read of identity in this controller — everything
// downstream uses the value returned by this helper.
function requireUserId(req) {
    const userId = req.user && req.user.userId;
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(401, 'Authentication required');
    }
    return userId;
}

// Validate that :id is a positive integer. Rejects strings like
// "abc", "0", "-1", "1.5", and anything non-numeric.
//
// Returns the integer complaintId on success, throws ApiError(400)
// otherwise. We never coerce silently — "12abc" and " 12 " are
// both 400s.
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
    // Reject anything that isn't a pure non-negative integer
    // literal. /^\d+$/ matches "0", "12", "12345" but not
    // "-1", "1.5", "12abc", " 12 ".
    if (!/^\d+$/.test(trimmed)) {
        throw new ApiError(400, `${label} must be a positive integer`);
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, `${label} must be a positive integer`);
    }
    return n;
}

// POST /api/complaints
// Body: { category, title, description }
// Identity: req.user.userId (set by authenticate from JWT)
exports.create = async (req, res, next) => {
    try {
        const body = req.body || {};

        // Collect every field-level validation error in one pass
        // so the client can fix them all at once.
        const fieldErrors = [
            validateStringField(body.category,    'Category',    CATEGORY_MAX),
            validateStringField(body.title,       'Title',       TITLE_MAX),
            validateStringField(body.description, 'Description', DESCRIPTION_MAX),
        ].filter(Boolean);

        if (fieldErrors.length > 0) {
            throw new ApiError(400, fieldErrors.join('; '));
        }

        // The identity MUST come from the verified JWT — never
        // from req.body.student_id, req.query.student_id, etc.
        // authenticate() guarantees req.user is set and shaped.
        const userId = requireUserId(req);

        const result = await complaintService.createComplaint({
            userId,
            category:    body.category,
            title:       body.title,
            description: body.description,
        });

        return res.status(201).json({
            success: true,
            message: 'Complaint created successfully',
            data: result,
        });
    } catch (err) {
        // Never log the body. The errorHandler logs the message
        // and stack; the body could carry sensitive content the
        // student included in title/description.
        console.error('[complaintController.create] failed:', err.message);
        return next(err);
    }
};

// GET /api/complaints
// Returns every complaint that belongs to the authenticated
// student, newest first. Empty array when the student has none.
// Ownership is enforced in the service by the SQL JOIN+WHERE.
exports.getMyComplaints = async (req, res, next) => {
    try {
        const userId = requireUserId(req);

        const complaints = await complaintService.findMyComplaints(userId);

        return res.status(200).json({
            success: true,
            data: { complaints },
        });
    } catch (err) {
        console.error('[complaintController.getMyComplaints] failed:', err.message);
        return next(err);
    }
};

// GET /api/complaints/:id
// Returns one complaint (plus its history) ONLY if it belongs
// to the authenticated student. Both "id does not exist" and
// "id exists but belongs to someone else" yield 404 with the
// same message — we never reveal which case it was.
exports.getMyComplaintById = async (req, res, next) => {
    try {
        const userId = requireUserId(req);

        // Reject non-positive-integer ids at the edge so we
        // never run a query like WHERE complaint_id = 'abc'.
        const complaintId = requirePositiveIntParam(req.params.id, 'Complaint id');

        // Step 1: ownership-checked fetch. Returns null if the
        // complaint does not exist OR belongs to another student.
        const complaint = await complaintService.findMyComplaintById(userId, complaintId);
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        // Step 2: history. We only run this AFTER the ownership
        // check succeeded, so we never query history for a row
        // the caller cannot see.
        const history = await complaintService.findComplaintHistory(complaintId);

        return res.status(200).json({
            success: true,
            data: { complaint, history },
        });
    } catch (err) {
        console.error('[complaintController.getMyComplaintById] failed:', err.message);
        return next(err);
    }
};