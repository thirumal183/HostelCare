// ===========================================================
// Warden Complaint Routes — /api/warden/complaints
// ===========================================================
// Phase 4C surface:
//   GET    /                  -> list complaints in warden's hostel
//   GET    /:id               -> detail + history for one complaint
//   PATCH  /:id/priority      -> update priority
// Phase 4D surface:
//   POST   /:id/assign        -> assign a PENDING complaint to a worker
//
// Every route is guarded by authenticate + authorize('WARDEN').
// Hostel membership is enforced inside the SQL layer (service).
// ===========================================================

const express = require('express');
const router = express.Router();

const wardenComplaintController = require('../controllers/wardenComplaintController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize }    = require('../middleware/roleMiddleware');

router.get(
    '/',
    authenticate,
    authorize('WARDEN'),
    wardenComplaintController.list,
);

router.get(
    '/:id',
    authenticate,
    authorize('WARDEN'),
    wardenComplaintController.getById,
);

router.patch(
    '/:id/priority',
    authenticate,
    authorize('WARDEN'),
    wardenComplaintController.updatePriority,
);

router.post(
    '/:id/assign',
    authenticate,
    authorize('WARDEN'),
    wardenComplaintController.assign,
);

module.exports = router;