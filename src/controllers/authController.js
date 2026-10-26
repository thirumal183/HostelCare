// ===========================================================
// Auth Controller — HTTP layer for /api/auth/*
// ===========================================================
// Responsibility: parse the request, run syntactic validation,
// delegate the semantic checks + DB work to authService, and
// shape the JSON response. No SQL, no bcrypt, no env access.
// ===========================================================

const authService = require('../services/authService');
const ApiError = require('../utils/apiError');
const {
    validateEmail,
    validatePassword,
    validateActivationKey,
    validateHostelName,
    validateRoomNumber,
} = require('../utils/validation');

// POST /api/auth/activate
// Body: { email, hostel, room, activationKey, password }
exports.activate = async (req, res, next) => {
    try {
        const body = req.body || {};

        // Syntactic validation. We collect all field-level errors
        // and return them together so the client can fix them in
        // one round-trip.
        const fieldErrors = [
            validateEmail(body.email),
            validateHostelName(body.hostel),
            validateRoomNumber(body.room),
            validateActivationKey(body.activationKey),
            validatePassword(body.password),
        ].filter(Boolean);

        if (fieldErrors.length > 0) {
            throw new ApiError(400, fieldErrors.join('; '));
        }

        // Normalize: trim + lowercase the email so trailing spaces
        // and case differences do not cause spurious 404s.
        const email = body.email.trim().toLowerCase();
        const hostel = body.hostel.trim();
        const room = body.room.trim();
        const activationKey = body.activationKey; // do NOT trim / lowercase — keys are case-sensitive
        const password = body.password; // do NOT trim — passwords may legitimately contain spaces

        const result = await authService.activateStudent({
            email,
            hostel,
            room,
            activationKey,
            password,
        });

        return res.status(200).json({
            success: true,
            message: 'Student account activated successfully',
            data: result,
        });
    } catch (err) {
        // Never log the password or activation key — only the
        // request shape and the error are safe to log.
        console.error('[authController.activate] failed:', err.message);
        return next(err);
    }
};

// POST /api/auth/login
// Body: { email, password }
exports.login = async (req, res, next) => {
    try {
        const body = req.body || {};

        // Syntactic validation. Note: we do NOT call
        // validatePassword's length rule here — that is for new
        // password creation, not login. Login only needs the
        // password to be non-empty (we'll bcrypt it either way).
        const fieldErrors = [
            validateEmail(body.email),
            typeof body.password === 'string' && body.password.length > 0
                ? null
                : 'password is required',
        ].filter(Boolean);

        if (fieldErrors.length > 0) {
            throw new ApiError(400, fieldErrors.join('; '));
        }

        const email = body.email.trim().toLowerCase();
        const password = body.password; // do NOT trim — passwords may legitimately contain spaces

        const result = await authService.loginUser({ email, password });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result,
        });
    } catch (err) {
        // Never log the password — only the error message.
        console.error('[authController.login] failed:', err.message);
        return next(err);
    }
};

// GET /api/auth/me
// Returns the identity attached to the verified JWT by
// authMiddleware. For STUDENT role, also fetches room and hostel
// so the dashboard header can display them after a page refresh.
exports.me = async (req, res, next) => {
    try {
        // authMiddleware guarantees req.user is set and well-shaped
        // when this controller is reached. We still defensively
        // check so a future misconfiguration can't crash the route.
        if (!req.user || typeof req.user !== 'object') {
            throw new ApiError(401, 'Authentication required');
        }

        const responseData = {
            userId: req.user.userId,
            role:   req.user.role,
        };

        // Enrich student identity with room + hostel so the
        // dashboard header works after a page refresh without
        // requiring a separate profile endpoint.
        if (req.user.role === 'STUDENT') {
            const profile = await authService.loadStudentProfile(req.user.userId);
            if (profile) {
                responseData.room_number = profile.room_number;
                responseData.hostel_name = profile.hostel_name;
            }
        }

        return res.status(200).json({
            success: true,
            data: responseData,
        });
    } catch (err) {
        console.error('[authController.me] failed:', err.message);
        return next(err);
    }
};
