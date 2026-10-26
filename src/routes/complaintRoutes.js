// ===========================================================
// Complaint Routes
// ===========================================================
// Phase 4A: POST /api/complaints (student creation)
// Phase 4B: GET  /api/complaints          (student list)
//           GET  /api/complaints/:id      (student detail)
//
// Every route is guarded by authenticate + authorize('STUDENT').
// No role-checking logic lives in the controller.
//
// Future phases (assignment, status updates, warden/worker
// views) will live in this same file so the /api/complaints
// mount stays the single entry point for the complaint resource.
// ===========================================================

const express = require('express');
const router = express.Router();

const complaintController = require('../controllers/complaintController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize }    = require('../middleware/roleMiddleware');

router.post(
    '/',
    authenticate,
    authorize('STUDENT'),
    complaintController.create,
);

router.get(
    '/',
    authenticate,
    authorize('STUDENT'),
    complaintController.getMyComplaints,
);

router.get(
    '/:id',
    authenticate,
    authorize('STUDENT'),
    complaintController.getMyComplaintById,
);

module.exports = router;