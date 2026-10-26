// ===========================================================
// JWT Authentication Middleware
// ===========================================================
// Responsibility: extract a Bearer token from the Authorization
// header, verify it against process.env.JWT_SECRET, and attach
// the decoded identity to req.user. Reject every other case
// with a 401.
//
// This middleware is authentication ONLY — it does not perform
// role-based authorization. Role checks (RBAC) belong in a
// separate middleware, which will read req.user.role.
//
// Token-handling rules:
//   - Missing Authorization header              -> 401 'Authentication required'
//   - Wrong scheme (not 'Bearer', case-insensitive) -> 401 'Authentication required'
//   - Token present but unparseable / tampered   -> 401 'Invalid or expired token'
//   - Token expired                              -> 401 'Invalid or expired token'
//   - Valid token                                -> attach req.user, call next()
//
// What we deliberately do NOT do:
//   - Log the token or its decoded payload
//   - Log the JWT secret
//   - Trust any userId / role from the request body
// ===========================================================

const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');

const ALLOWED_ROLES = new Set(['STUDENT', 'WARDEN', 'WORKER']);

// Cheap structural validation of the Authorization header.
// Returns { ok, scheme, token } — never throws.
function parseAuthHeader(headerValue) {
    if (typeof headerValue !== 'string') {
        return { ok: false, reason: 'missing' };
    }
    const trimmed = headerValue.trim();
    if (trimmed.length === 0) {
        return { ok: false, reason: 'missing' };
    }
    // Find the first whitespace between scheme and token.
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx <= 0) {
        return { ok: false, reason: 'malformed' };
    }
    const scheme = trimmed.slice(0, spaceIdx);
    const rest = trimmed.slice(spaceIdx + 1).trim();
    // Token is everything after the scheme; it must not contain
    // additional whitespace.
    if (rest.length === 0 || /\s/.test(rest)) {
        return { ok: false, reason: 'malformed' };
    }
    return { ok: true, scheme, token: rest };
}

// Express middleware. Mount on any route that needs a verified JWT.
exports.authenticate = (req, res, next) => {
    const parsed = parseAuthHeader(req.headers.authorization);

    if (!parsed.ok) {
        // No token was presented. Per the Phase 3C spec, this is
        // "Authentication required" rather than "Invalid or
        // expired token" — those are two distinct failures.
        return next(new ApiError(401, 'Authentication required'));
    }

    if (parsed.scheme.toLowerCase() !== 'bearer') {
        // Wrong scheme (e.g. "Basic abc"). We treat this the same
        // as a missing token: no usable Bearer token was supplied.
        return next(new ApiError(401, 'Authentication required'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // Misconfiguration. Fail closed with a 500 so the operator
        // notices; do not echo the missing secret to the client.
        console.error('[authMiddleware] JWT_SECRET is not configured');
        return next(new ApiError(500, 'Internal server error'));
    }

    let decoded;
    try {
        decoded = jwt.verify(parsed.token, secret);
    } catch (err) {
        // jsonwebtoken raises: TokenExpiredError, JsonWebTokenError,
        // NotBeforeError. All of them map to the same 401 message
        // per the spec — no need to distinguish client-side.
        const category =
            err && err.name === 'TokenExpiredError' ? 'expired' :
            err && err.name === 'NotBeforeError'    ? 'not_active' :
            'invalid';
        console.warn(`[authMiddleware] JWT rejected: ${category}`);
        return next(new ApiError(401, 'Invalid or expired token'));
    }

    // Defensive structural checks on the decoded payload. We trust
    // the signature, but we still validate the SHAPE because a
    // signed-by-someone-else token (or a token from a previous
    // version of the API) could have a different payload shape.
    if (!decoded || typeof decoded !== 'object') {
        return next(new ApiError(401, 'Invalid or expired token'));
    }
    const { userId, role } = decoded;
    if (!Number.isInteger(userId) || userId <= 0) {
        return next(new ApiError(401, 'Invalid or expired token'));
    }
    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
        return next(new ApiError(401, 'Invalid or expired token'));
    }

    // Attach ONLY the public identity to req.user. We do NOT copy
    // iat / exp so downstream code can't mistake them for
    // user-supplied fields. We also do NOT include the raw token.
    req.user = { userId, role };
    return next();
};