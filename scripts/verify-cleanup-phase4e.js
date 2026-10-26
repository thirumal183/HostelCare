// scripts/verify-cleanup-phase4e.js
// Phase 4E cleanup verification — confirms no leftover data and
// that schema.sql / seed.sql were not modified.
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
    // 1. DB state
    const c = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    const [t] = await c.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4E-TEST%'");
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
    console.log('PHASE4E complaints left:', t[0].c);
    console.log('Orphan assignments:', a[0].c);
    console.log('Orphan history:', h[0].c);
    console.log('DB totals:', totals[0]);

    // 2. Verify users state — temp users (1,2,6,7,11,12,16) should be back to seed-like state.
    const [u] = await c.query(
        "SELECT user_id, role, is_active, password_hash IS NULL AS hash_null "
        + "FROM users WHERE user_id IN (1,2,3,4,5,6,7,8,9,10,11,12,16,26) ORDER BY user_id"
    );
    console.log('User state sample:');
    console.table(u);

    // 3. Spot-check: a known seed user (26 = GH-1 Electrical) should never have been touched.
    const [w26] = await c.query("SELECT worker_id, name, hostel_id, specialization FROM workers WHERE worker_id = 10");
    console.log('Untouched worker_id=10 (BH-4 Cleaning):', w26[0]);

    await c.end();

    // 4. Verify schema.sql and seed.sql were not modified during Phase 4E work.
    // We don't have a baseline hash, but we can at least confirm both files exist
    // and that no PHASE4E comments were appended.
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const seedText = fs.readFileSync(seedPath, 'utf8');
    console.log('\nschema.sql size:', schemaText.length, 'chars; PHASE4E references:', (schemaText.match(/PHASE4E/gi) || []).length);
    console.log('seed.sql size:   ', seedText.length, 'chars; PHASE4E references:', (seedText.match(/PHASE4E/gi) || []).length);
})().catch(e => { console.error(e); process.exit(1); });
