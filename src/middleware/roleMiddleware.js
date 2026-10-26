// ===========================================================
// Role-Based Authorization Middleware (RBAC)
// ===========================================================
// Responsibility: given a list of allowed roles, decide whether
// the already-authenticated request holds one of them.
//
// IMPORTANT: this middleware runs AFTER `authenticate`. It
// trusts req.user ONLY — it never reads req.body.role,
// req.query.role, or req.params.role. Anything that came from
// the wire is treated as untrusted; the only authority is the
// verified JWT payload set by authenticate.
//
// Usage:
//
//   const { authenticate } = require('../middleware/authMiddleware');
//   const { authorize }    = require('../middleware/roleMiddleware');
//
//   router.get('/admin/anything',
//     authenticate,           // populate req.user
//     authorize('STUDENT'),   // only STUDENTs may proceed
//     handler
//   );
//
// Failure modes (per the Phase 3D spec):
//   - req.user missing            -> 401 'Authentication required'
//   - req.user.role not in {STUDENT,WARDEN,WORKER} -> 403 'Access denied'
//   - req.user.role not in allowedRoles           -> 403 'Access denied'
//
// Construction-time safeguards:
//   - authorize() with no arguments  -> throws TypeError immediately
//   - authorize('UNKNOWN')          -> throws TypeError immediately
// ===========================================================

const ApiError = require('../utils/apiError');

const KNOWN_ROLES = new Set(['STUDENT', 'WARDEN', 'WORKER']);

// Factory: returns an Express middleware that admits only holders
// of one of `allowedRoles`.
function authorize(...allowedRoles) {
    if (allowedRoles.length === 0) {
        // Defensive: a route declaring authorize() with no roles
        // is almost certainly a bug. Fail loud at startup rather
        // than silently letting everyone through.
        throw new TypeError('authorize() requires at least one role');
    }
    for (const r of allowedRoles) {
        if (typeof r !== 'string' || !KNOWN_ROLES.has(r)) {
            throw new TypeError(
                `authorize() received unknown role: ${JSON.stringify(r)}`
            );
        }
    }
    const allowed = new Set(allowedRoles);

    return function authorizeMiddleware(req, res, next) {
        // 1. Authenticate must have run. If req.user is missing,
        //    the route was misconfigured (or someone bypassed
        //    authenticate). Surface 401 so the operator notices.
        if (!req.user || typeof req.user !== 'object') {
            return next(new ApiError(401, 'Authentication required'));
        }

        // 2. Defensive role-shape check. authenticate already
        //    rejects unknown roles at 401, but if a future change
        //    relaxes that, we still want to refuse.
        const role = req.user.role;
        if (typeof role !== 'string' || !KNOWN_ROLES.has(role)) {
            return next(new ApiError(403, 'Access denied'));
        }

        // 3. The actual RBAC decision. ONLY req.user.role is
        //    consulted — body, query, and params are never read.
        if (!allowed.has(role)) {
            return next(new ApiError(403, 'Access denied'));
        }

        return next();
    };
}

module.exports = {
    authorize,
};