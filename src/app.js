// ===========================================================
// Express Application
// ===========================================================
// Responsibility: configure the Express app — middleware,
// CORS, JSON body parsing, and route mounting.
//
// The HTTP server itself is started in server.js so that
// tests / future tooling can import the app without binding
// to a port.
// ===========================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const ApiError = require('./utils/apiError');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const studentComplaintRoutes = require('./routes/studentComplaintRoutes');
const wardenComplaintRoutes = require('./routes/wardenComplaintRoutes');
const workerComplaintRoutes = require('./routes/workerComplaintRoutes');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- CORS Configuration ---
// Configurable through CLIENT_ORIGIN (single origin or comma-separated list).
// In development, http://localhost:3000 and http://127.0.0.1:3000 are supported by default.
// In production, wildcard CORS is never allowed; only explicitly configured origins are accepted.
const configuredOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
    ? configuredOrigins
    : Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server health checks)
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new ApiError(403, 'CORS: Request from unapproved origin blocked'));
    },
    credentials: true,
};

// --- Core middleware ---
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API routes ---
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/student/complaints', studentComplaintRoutes);
app.use('/api/warden/complaints', wardenComplaintRoutes);
app.use('/api/worker/complaints', workerComplaintRoutes);

// --- 404 + error handling (must come after routes) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
