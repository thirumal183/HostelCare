// ===========================================================
// Health Controller
// ===========================================================
// Handles GET /api/health and GET /api/health/db.
// Plain HTTP responses — no business logic.
// ===========================================================

const pool = require('../config/db');

// GET /api/health
// Returns a static "API is running" payload.
exports.getHealth = (req, res) => {
    res.status(200).json({
        success: true,
        message: 'HostelCare API is running',
    });
};

// GET /api/health/db
// Runs a trivial query against the MySQL pool to confirm
// the database is reachable. Never exposes credentials or
// raw driver error messages.
exports.getDbHealth = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok, NOW() AS db_time');
        return res.status(200).json({
            success: true,
            message: 'Database connection is successful',
            database: process.env.DB_NAME,
            db_status: rows[0].ok === 1 ? 'up' : 'unknown',
            db_time: rows[0].db_time,
        });
    } catch (err) {
        // Log the real error server-side for debugging.
        console.error('[dbHealth] MySQL connection failed:', err.message);
        // Never leak driver/credential details to the client.
        return res.status(503).json({
            success: false,
            message: 'Database connection failed',
        });
    }
};
