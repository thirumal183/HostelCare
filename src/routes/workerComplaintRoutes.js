// ===========================================================
// Worker Complaint Routes — /api/worker/complaints
// ===========================================================
// Phase 4E surface:
//   PATCH /:id/status -> update complaint status (worker-driven)
//
// Every route is guarded by authenticate + authorize('WORKER').
// Worker identity is resolved inside the service from
// req.user.userId — never from the request body / query /
// params / headers.
// ===========================================================

const express = require('express');
const router = express.Router();

const workerComplaintController = require('../controllers/workerComplaintController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize }    = require('../middleware/roleMiddleware');

router.get(
    '/',
    authenticate,
    authorize('WORKER'),
    workerComplaintController.listAssigned,
);

router.patch(
    '/:id/status',
    authenticate,
    authorize('WORKER'),
    workerComplaintController.updateStatus,
);

module.exports = router;
