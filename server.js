// ===========================================================
// HostelCare — Server entrypoint
// ===========================================================
// Loads the configured Express app from src/app.js and starts
// the HTTP listener on PORT (default 5000).
// ===========================================================

const app = require('./src/app');
const authService = require('./src/services/authService');

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, async () => {
    console.log(`[server] HostelCare API listening on http://localhost:${PORT}`);
    console.log(`[server] Health:  http://localhost:${PORT}/api/health`);
    console.log(`[server] DB:      http://localhost:${PORT}/api/health/db`);

    // Ensure demo accounts have valid password hashes in the database
    if (typeof authService.ensureDemoAccounts === 'function') {
        await authService.ensureDemoAccounts();
    }
});

// Surface obvious startup errors (e.g., port already in use).
server.on('error', (err) => {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
});
