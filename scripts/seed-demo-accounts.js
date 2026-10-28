// =====================================================================
// HostelCare — Seed Demo Accounts CLI Script
// =====================================================================
// Usage: node scripts/seed-demo-accounts.js
//
// Connects to the configured database (local or TiDB Cloud via DB_SSL=true)
// and idempotently updates demo accounts with valid bcrypt hashes.
// =====================================================================

require('dotenv').config();
const authService = require('../src/services/authService');
const pool = require('../src/config/db');

(async () => {
    console.log('[seed-demo-accounts] Connecting to database...');
    await authService.ensureDemoAccounts();

    const [rows] = await pool.query(
        `SELECT user_id, email, role, is_active, (password_hash IS NOT NULL) AS has_hash
         FROM users
         WHERE user_id IN (1, 2, 6, 7, 11, 16)
         ORDER BY user_id`
    );

    console.log('[seed-demo-accounts] Demo account status:');
    console.table(rows);

    await pool.end();
    console.log('[seed-demo-accounts] Completed successfully.');
})().catch((err) => {
    console.error('[seed-demo-accounts] Failed:', err.message);
    process.exit(1);
});
