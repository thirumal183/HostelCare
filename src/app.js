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
// Production origins include the deployed Vercel frontend: https://hostelcare-one.vercel.app.
// In development, http://localhost:3000 and http://127.0.0.1:3000 are supported by default.
const defaultOrigins = [
    'https://hostelcare-one.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

const configuredOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    // Also allow any HostelCare Vercel deployment preview URLs (e.g. https://hostelcare-one-*.vercel.app)
    if (/^https:\/\/hostelcare(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) {
        return true;
    }
    return false;
};

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server health checks)
        if (isAllowedOrigin(origin)) {
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
