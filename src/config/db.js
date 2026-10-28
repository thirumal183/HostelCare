// ===========================================================
// HostelCare — MySQL connection pool
// ===========================================================
// Responsibility: create and export a single mysql2/promise
// connection pool that the rest of the app uses to talk to
// MySQL. No SQL queries live in this file.
//
// Connection settings come from environment variables loaded
// via dotenv in server.js / app.js.
// ===========================================================

require('dotenv').config();

const mysql = require('mysql2/promise');

const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hostelcare',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Return DATETIME/TIMESTAMP columns as JS Date objects
    dateStrings: false,
};

// Enable TLS/SSL when DB_SSL is set to 'true' (required for TiDB Cloud / managed cloud databases)
if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
    poolConfig.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
    };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
