// scripts/verify-cleanup-phase4f.js
// Phase 4F cleanup verification.
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    const [t] = await c.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4F-TEST%'");
    const [a] = await c.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [h] = await c.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [totals] = await c.query(
        "SELECT (SELECT COUNT(*) FROM hostels) AS hostels, "
        + "(SELECT COUNT(*) FROM rooms) AS rooms, "
        + "(SELECT COUNT(*) FROM users) AS users, "
        + "(SELECT COUNT(*) FROM students) AS students, "
        + "(SELECT COUNT(*) FROM wardens) AS wardens, "
        + "(SELECT COUNT(*) FROM workers) AS workers, "
        + "(SELECT COUNT(*) FROM complaint_categories) AS categories, "
        + "(SELECT COUNT(*) FROM complaints) AS complaints, "
        + "(SELECT COUNT(*) FROM assignments) AS assignments, "
        + "(SELECT COUNT(*) FROM complaint_history) AS history"
    );
    console.log('PHASE4F complaints left:', t[0].c);
    console.log('Orphan assignments:', a[0].c);
    console.log('Orphan history:', h[0].c);
    console.log('DB totals:', totals[0]);

    const [u] = await c.query(
        "SELECT user_id, role, is_active, password_hash IS NULL AS hash_null "
        + "FROM users WHERE user_id IN (1,2,6,7,11,16,26) ORDER BY user_id"
    );
    console.log('User state sample:');
    console.table(u);

    const [w10] = await c.query("SELECT worker_id, name, hostel_id, specialization FROM workers WHERE worker_id = 10");
    console.log('Untouched worker_id=10:', w10[0]);

    await c.end();

    // Schema/seed integrity
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const seedText = fs.readFileSync(seedPath, 'utf8');
    const schemaHash = crypto.createHash('sha256').update(schemaText).digest('hex');
    const seedHash = crypto.createHash('sha256').update(seedText).digest('hex');
    console.log('\nschema.sql size:', schemaText.length, 'chars; PHASE4F references:', (schemaText.match(/PHASE4F/gi) || []).length, 'sha256:', schemaHash);
    console.log('seed.sql size:   ', seedText.length, 'chars; PHASE4F references:', (seedText.match(/PHASE4F/gi) || []).length, 'sha256:', seedHash);
})().catch(e => { console.error(e); process.exit(1); });
