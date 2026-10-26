// ===========================================================
// Student Complaint Routes — /api/student/complaints
// ===========================================================
// Phase 4F surface:
//   PATCH /:id/close    -> RESOLVED -> CLOSED
//   PATCH /:id/reopen   -> RESOLVED -> PENDING
//
// Every route is guarded by authenticate + authorize('STUDENT').
// Student identity is resolved inside the service from
// req.user.userId — never from the request body / query /
// params / headers.
// ===========================================================

const express = require('express');
const router = express.Router();

const studentComplaintController = require('../controllers/studentComplaintController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize }    = require('../middleware/roleMiddleware');

router.patch(
    '/:id/close',
    authenticate,
    authorize('STUDENT'),
    studentComplaintController.close,
);

router.patch(
    '/:id/reopen',
    authenticate,
    authorize('STUDENT'),
    studentComplaintController.reopen,
);

module.exports = router;
