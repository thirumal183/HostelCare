// Reproduce T20 strictly via HTTP, observe what happens
require('dotenv').config();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Cleanup
    await conn.query("DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'DEBUG-T20-HTTP%')");
    await conn.query("DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'DEBUG-T20-HTTP%')");
    await conn.query("DELETE FROM complaints WHERE title LIKE 'DEBUG-T20-HTTP%'");

    // Create complaint
    const [ins] = await conn.query("INSERT INTO complaints (student_id, category_id, title, priority, status, description) VALUES (1, 1, 'DEBUG-T20-HTTP complaint', 'LOW', 'PENDING', 'debug')");
    const cid = ins.insertId;
    console.log('created complaint', cid);

    // Install trigger
    await conn.query(`
        CREATE TRIGGER trg_t20_http
        BEFORE INSERT ON assignments
        FOR EACH ROW
        BEGIN
            IF NEW.complaint_id = ? THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced rollback for T20-HTTP';
            END IF;
        END
    `, [cid]);

    // Hit the HTTP endpoint
    const token = jwt.sign({ userId: 6, role: 'WARDEN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await fetch('http://localhost:5000/api/warden/complaints/' + cid + '/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ workerId: 1 }),
    });
    console.log('HTTP status:', res.status);
    console.log('HTTP body:', await res.text());

    await conn.query('DROP TRIGGER IF EXISTS trg_t20_http');

    const [a] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
    const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
    const [h] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [cid]);
    console.log('DB state after HTTP call:', { assignments: a[0].c, status: c[0].status, history: h[0].c });

    // Cleanup
    await conn.query("DELETE FROM complaint_history WHERE complaint_id = ?", [cid]);
    await conn.query("DELETE FROM complaints WHERE complaint_id = ?", [cid]);
    await conn.end();
})().catch(e => { console.error('crash:', e); process.exit(1); });
