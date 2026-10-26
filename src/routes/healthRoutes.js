// ===========================================================
// Health Routes
// ===========================================================
// Mounted at /api by app.js. Each route delegates to a
// controller function.
// ===========================================================

const express = require('express');
const router = express.Router();

const healthController = require('../controllers/healthController');

router.get('/health', healthController.getHealth);
router.get('/health/db', healthController.getDbHealth);

module.exports = router;
