// ===========================================================
// HostelCare — Server entrypoint
// ===========================================================
// Loads the configured Express app from src/app.js and starts
// the HTTP listener on PORT (default 5000).
// ===========================================================

const app = require('./src/app');

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
    console.log(`[server] HostelCare API listening on http://localhost:${PORT}`);
    console.log(`[server] Health:  http://localhost:${PORT}/api/health`);
    console.log(`[server] DB:      http://localhost:${PORT}/api/health/db`);
});

// Surface obvious startup errors (e.g., port already in use).
server.on('error', (err) => {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
});
