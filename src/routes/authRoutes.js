// ===========================================================
// Auth Routes
// ===========================================================
// Mounted at /api/auth by app.js. V1 endpoints:
//   POST /activate             — first-time student activation (public)
//   POST /login                — email + password login (public)
//   GET  /me                   — JWT identity echo (protected)
//   GET  /test/student         — RBAC smoke test, STUDENT only
//   GET  /test/warden          — RBAC smoke test, WARDEN only
//   GET  /test/worker          — RBAC smoke test, WORKER only
//   GET  /test/warden-worker   — RBAC smoke test, WARDEN OR WORKER
//
// The /test/* routes exist solely to verify that authenticate +
// authorize work together. They are NOT complaint APIs and
// should be removed (or moved under a /internal/test prefix)
// before any real production deployment.
// ===========================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize }    = require('../middleware/roleMiddleware');

// --- Public routes ---
router.post('/activate', authController.activate);
router.post('/login',    authController.login);

// --- Authenticated routes (any role) ---
router.get('/me', authenticate, authController.me);

// --- RBAC test routes (Explicit development mode only) ---
// Registered strictly when process.env.NODE_ENV === 'development'.
// In production or when NODE_ENV is unset/unrecognized, these routes are not registered,
// causing requests to fall through to notFoundHandler with a standard 404 response.
if (process.env.NODE_ENV === 'development') {
    function roleGranted(role) {
        return (req, res) => res.status(200).json({
            success: true,
            message: `${role} access granted`,
        });
    }

    router.get('/test/student',
        authenticate,
        authorize('STUDENT'),
        roleGranted('Student'),
    );

    router.get('/test/warden',
        authenticate,
        authorize('WARDEN'),
        roleGranted('Warden'),
    );

    router.get('/test/worker',
        authenticate,
        authorize('WORKER'),
        roleGranted('Worker'),
    );

    router.get('/test/warden-worker',
        authenticate,
        authorize('WARDEN', 'WORKER'),
        roleGranted('Warden/Worker'),
    );
}

module.exports = router;
