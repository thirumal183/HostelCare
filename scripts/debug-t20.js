// Debug T20: simulate the trigger-failure scenario directly via the service.
require('dotenv').config();
const mysql = require('mysql2/promise');
const svc = require('../src/services/wardenComplaintService');

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Make sure no leftover test data
    await conn.query(`DELETE ha FROM complaint_history ha JOIN complaints ca ON ha.complaint_id = ca.complaint_id WHERE ca.title LIKE 'DEBUG-T20%'`);
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'DEBUG-T20%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'DEBUG-T20%'`);

    // Create a complaint
    const [ins] = await conn.query("INSERT INTO complaints (student_id, category_id, title, priority, status, description) VALUES (1, 1, 'DEBUG-T20 complaint', 'LOW', 'PENDING', 'debug')");
    const cid = ins.insertId;
    console.log('created complaint', cid);

    // Install trigger
    await conn.query(`
        CREATE TRIGGER trg_t20_debug
        BEFORE INSERT ON assignments
        FOR EACH ROW
        BEGIN
            IF NEW.complaint_id = ? THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced rollback for T20';
            END IF;
        END
    `, [cid]);

    try {
        const r = await svc.assignComplaintToWorker(6, cid, 1); // user 6 = BH-3 warden
        console.log('UNEXPECTED success:', r);
    } catch (e) {
        console.log('Service threw:', e.statusCode, e.message);
    }

    await conn.query('DROP TRIGGER IF EXISTS trg_t20_debug');

    // Inspect DB state
    const [a] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
    const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
    const [h] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [cid]);
    console.log('DB state:', { assignments: a[0].c, status: c[0].status, history: h[0].c });

    // Cleanup
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id = ?`, [cid]);
    await conn.query(`DELETE FROM complaints WHERE complaint_id = ?`, [cid]);
    await conn.end();
})().catch(e => { console.error('crash:', e); process.exit(1); });