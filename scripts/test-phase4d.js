// scripts/test-phase4d.js
// Phase 4D end-to-end test driver (T1-T22).
require('dotenv').config();
const mysql  = require('mysql2/promise');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const BASE = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET;

const RESULTS = [];
function pass(name, detail = '') { RESULTS.push({ name, ok: true,  detail }); console.log(`[PASS] ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name, detail = '') { RESULTS.push({ name, ok: false, detail }); console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`); }

async function http(method, path, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { /* may be empty */ }
    return { status: res.status, json };
}

function mintToken(userId, role) {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function activate(conn, email) {
    const [u] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (u.length === 0) throw new Error(`No user ${email}`);
    const hash = await bcrypt.hash('Test' + email + 'Pass!', 10);
    await conn.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [hash, u[0].user_id]);
    await conn.query('UPDATE students SET is_activated = TRUE WHERE user_id = ?', [u[0].user_id]);
    return u[0].user_id;
}

async function loginStudent(email) {
    const r = await http('POST', '/api/auth/login', { body: { email, password: 'Test' + email + 'Pass!' } });
    if (r.status !== 200) throw new Error(`student login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}

async function loginWarden(email, password) {
    const r = await http('POST', '/api/auth/login', { body: { email, password } });
    if (r.status !== 200) throw new Error(`warden login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Clean stale PHASE4D-* data
    await conn.query(
        `DELETE ha FROM complaint_history ha
         JOIN complaints ca ON ha.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4D-TEST%'`
    );
    await conn.query(
        `DELETE aa FROM assignments aa
         JOIN complaints ca ON aa.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4D-TEST%'`
    );
    await conn.query("DELETE FROM complaints WHERE title LIKE 'PHASE4D-TEST%'");

    // Activate students and set warden passwords (seed leaves them NULL)
    await activate(conn, 'student.bh3.thiru@hostelcare.test');
    await activate(conn, 'student.bh4.aarav@hostelcare.test');
    const tokStuA = await loginStudent('student.bh3.thiru@hostelcare.test');
    const tokStuB = await loginStudent('student.bh4.aarav@hostelcare.test');

    const bh3WardenPass = 'WardenBh3Pass!';
    const bh4WardenPass = 'WardenBh4Pass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 6', [await bcrypt.hash(bh3WardenPass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 7', [await bcrypt.hash(bh4WardenPass, 10)]);
    const tokBh3W = await loginWarden('warden.bh3@hostelcare.test', bh3WardenPass);
    const tokBh4W = await loginWarden('warden.bh4@hostelcare.test', bh4WardenPass);
    const tokWorker = mintToken(11, 'WORKER');

    async function createComplaint(token, category, title) {
        const r = await http('POST', '/api/complaints', { token, body: { category, title, description: 'phase4d test ' + title } });
        if (r.status !== 201) throw new Error(`create ${title}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data.complaintId;
    }

    // Create 4 complaints in BH-3 (Electrical, Plumbing, Water, Other)
    const idElec = await createComplaint(tokStuA, 'Electrical', 'PHASE4D-TEST A1 elec');
    const idPlumb = await createComplaint(tokStuA, 'Plumbing',   'PHASE4D-TEST A2 plumb');
    const idWater = await createComplaint(tokStuA, 'Water',      'PHASE4D-TEST A3 water');
    const idOther = await createComplaint(tokStuA, 'Other',      'PHASE4D-TEST A4 other');
    // One in BH-4 (Electrical) for cross-hostel tests
    const idBh4Elec = await createComplaint(tokStuB, 'Electrical', 'PHASE4D-TEST B1 elec');
    console.log('Seeded complaint ids:', { idElec, idPlumb, idWater, idOther, idBh4Elec });

    // --- T1: BH-3 warden assigns BH-3 Electrical complaint to BH-3 Electrical worker (worker_id=1) ---
    let assignmentId = null;
    {
        const r = await http('POST', `/api/warden/complaints/${idElec}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        if (r.status === 200 && r.json.data.status === 'ASSIGNED' && r.json.data.workerId === 1) {
            pass('T1: BH-3 elec -> BH-3 elec worker (id=1) -> 200 ASSIGNED');
        } else {
            fail('T1', JSON.stringify(r));
        }
    }

    // --- T2: assignments row exists ---
    {
        const [rows] = await conn.query('SELECT assignment_id, complaint_id, worker_id, assigned_by, is_active FROM assignments WHERE complaint_id = ?', [idElec]);
        if (rows.length === 1 && rows[0].complaint_id === idElec && rows[0].worker_id === 1 && rows[0].is_active === 1 && rows[0].assigned_by === 1) {
            assignmentId = rows[0].assignment_id;
            pass('T2: assignments row created with correct fields', `id=${assignmentId} assigned_by(warden_id)=${rows[0].assigned_by}`);
        } else {
            fail('T2', JSON.stringify(rows));
        }
    }

    // --- T3: complaint status changed to ASSIGNED ---
    {
        const [rows] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idElec]);
        if (rows[0]?.status === 'ASSIGNED') pass('T3: complaint.status = ASSIGNED');
        else fail('T3', JSON.stringify(rows));
    }

    // --- T4: complaint_history row PENDING -> ASSIGNED ---
    {
        const [rows] = await conn.query(
            'SELECT old_status, new_status, note, changed_by FROM complaint_history WHERE complaint_id = ? ORDER BY changed_at DESC, history_id DESC LIMIT 1',
            [idElec]
        );
        const r = rows[0];
        if (r && r.old_status === 'PENDING' && r.new_status === 'ASSIGNED' && r.changed_by === 6 && /assigned/i.test(r.note)) {
            pass('T4: history row PENDING -> ASSIGNED by warden (user_id=6)', `note="${r.note}"`);
        } else {
            fail('T4', JSON.stringify(rows));
        }
    }

    // --- T5: all three changes committed atomically (count checks) ---
    {
        const [a] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElec]);
        const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idElec]);
        const [h] = await conn.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ? AND new_status='ASSIGNED'", [idElec]);
        if (a[0].c === 1 && c[0].status === 'ASSIGNED' && h[0].c === 1) pass('T5: assignment + status + history all committed atomically');
        else fail('T5', `assignments=${a[0].c} status=${c[0].status} history_rows=${h[0].c}`);
    }

    // --- T6: BH-3 warden assigns Electrical complaint to BH-3 Plumbing worker (id=2) -> 409, no changes ---
    // Use a fresh Electrical complaint (idElec was already ASSIGNED in T1).
    {
        const idElecT6 = await createComplaint(tokStuA, 'Electrical', 'PHASE4D-TEST T6 elec');
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElecT6]);
        const [beforeC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idElecT6]);
        const [beforeH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [idElecT6]);
        const r = await http('POST', `/api/warden/complaints/${idElecT6}/assign`, { token: tokBh3W, body: { workerId: 2 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElecT6]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idElecT6]);
        const [afterH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [idElecT6]);
        const ok = r.status === 409
                && beforeA[0].c === afterA[0].c
                && beforeC[0].status === afterC[0].status && afterC[0].status === 'PENDING'
                && beforeH[0].c === afterH[0].c;
        if (ok) pass('T6: specialization mismatch (Elec -> Plumbing worker) -> 409, no assignment/status/history change', `r=${r.status} ${r.json?.message}`);
        else fail('T6', `r=${r.status} ${r.json?.message} | assignments ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status} history ${beforeH[0].c}->${afterH[0].c}`);
    }

    // --- T7: BH-3 warden assigns BH-3 complaint to BH-4 worker (id=16 = BH-4 Electrical) -> 409, no changes ---
    {
        const idElecT7 = await createComplaint(tokStuA, 'Electrical', 'PHASE4D-TEST T7 elec');
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElecT7]);
        const r = await http('POST', `/api/warden/complaints/${idElecT7}/assign`, { token: tokBh3W, body: { workerId: 16 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElecT7]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idElecT7]);
        const ok = r.status === 409 && beforeA[0].c === afterA[0].c && afterC[0].status === 'PENDING';
        if (ok) pass('T7: cross-hostel worker -> 409, no assignment, status unchanged', `r=${r.status} ${r.json?.message}`);
        else fail('T7', `r=${r.status} ${r.json?.message} | assignments ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status}`);
    }

    // --- T8: BH-3 warden tries to assign a BH-4 complaint (idBh4Elec) -> 404, no changes ---
    {
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idBh4Elec]);
        const r = await http('POST', `/api/warden/complaints/${idBh4Elec}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idBh4Elec]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idBh4Elec]);
        const ok = r.status === 404 && beforeA[0].c === afterA[0].c && afterC[0].status === 'PENDING';
        if (ok) pass('T8: cross-hostel complaint -> 404, no assignment, status unchanged', `r=${r.status} ${r.json?.message}`);
        else fail('T8', `r=${r.status} ${r.json?.message} | assignments ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status}`);
    }

    // --- T9: nonexistent workerId -> 404, no changes ---
    {
        const idPlumbT9 = await createComplaint(tokStuA, 'Plumbing', 'PHASE4D-TEST T9 plumb');
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idPlumbT9]);
        const r = await http('POST', `/api/warden/complaints/${idPlumbT9}/assign`, { token: tokBh3W, body: { workerId: 9999 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idPlumbT9]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idPlumbT9]);
        const ok = r.status === 404 && beforeA[0].c === afterA[0].c && afterC[0].status === 'PENDING';
        if (ok) pass('T9: nonexistent worker -> 404, no assignment, status unchanged', `r=${r.status} ${r.json?.message}`);
        else fail('T9', `r=${r.status} ${r.json?.message}`);
    }

    // --- T10: STUDENT token -> 403 ---
    { const r = await http('POST', `/api/warden/complaints/${idPlumb}/assign`, { token: tokStuA, body: { workerId: 1 } });
      if (r.status === 403) pass('T10: STUDENT token -> 403'); else fail('T10', JSON.stringify(r)); }

    // --- T11: WORKER token -> 403 ---
    { const r = await http('POST', `/api/warden/complaints/${idPlumb}/assign`, { token: tokWorker, body: { workerId: 1 } });
      if (r.status === 403) pass('T11: WORKER token -> 403'); else fail('T11', JSON.stringify(r)); }

    // --- T12: no JWT -> 401 ---
    { const r = await http('POST', `/api/warden/complaints/${idPlumb}/assign`, { body: { workerId: 1 } });
      if (r.status === 401) pass('T12: no JWT -> 401'); else fail('T12', JSON.stringify(r)); }

    // --- T13: invalid JWT -> 401 ---
    { const r = await http('POST', `/api/warden/complaints/${idPlumb}/assign`, { token: 'invalid.token.here', body: { workerId: 1 } });
      if (r.status === 401) pass('T13: invalid JWT -> 401'); else fail('T13', JSON.stringify(r)); }

    // --- T14: invalid complaint ID (abc / 0 / -1 / 1.5) -> 400 ---
    {
        const cases = ['abc', '0', '-1', '1.5'];
        const all = [];
        let ok = true;
        for (const cid of cases) {
            const r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token: tokBh3W, body: { workerId: 1 } });
            all.push(`${cid}=${r.status}`);
            if (r.status !== 400) ok = false;
        }
        if (ok) pass('T14: invalid complaint id (abc/0/-1/1.5) -> 400', all.join(' '));
        else fail('T14', all.join(' '));
    }

    // --- T15: invalid workerId (abc / 0 / -1 / 1.5 / missing / string) -> 400 ---
    {
        const cases = [
            { workerId: 'abc' },
            { workerId: '0' },
            { workerId: '-1' },
            { workerId: 1.5 },
            { workerId: 0 },
            { workerId: -1 },
            {},
            { workerId: '12abc' },
        ];
        const all = [];
        let ok = true;
        for (const body of cases) {
            const r = await http('POST', `/api/warden/complaints/${idPlumb}/assign`, { token: tokBh3W, body });
            all.push(`${JSON.stringify(body)}=${r.status}`);
            if (r.status !== 400) ok = false;
        }
        if (ok) pass('T15: invalid workerId -> 400', all.join(' '));
        else fail('T15', all.join(' '));
    }

    // --- T16: assign already-ASSIGNED complaint -> 409, no second assignment, no extra history ---
    {
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElec]);
        const [beforeH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [idElec]);
        const r = await http('POST', `/api/warden/complaints/${idElec}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idElec]);
        const [afterH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [idElec]);
        const ok = r.status === 409 && beforeA[0].c === afterA[0].c && beforeH[0].c === afterH[0].c;
        if (ok) pass('T16: already ASSIGNED -> 409, no second assignment, no extra history', `r=${r.status} ${r.json?.message}`);
        else fail('T16', `r=${r.status} ${r.json?.message} | assignments ${beforeA[0].c}->${afterA[0].c} history ${beforeH[0].c}->${afterH[0].c}`);
    }

    // --- T17: directly UPDATE complaint.status to IN_PROGRESS / RESOLVED / CLOSED and try assign each -> 409 ---
    {
        const probs = ['IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        const all = [];
        let okAll = true;
        for (const s of probs) {
            // Use a separate fresh complaint for each status to avoid cross-pollution.
            const cid = await createComplaint(tokStuA, 'Electrical', `PHASE4D-TEST T17-${s}`);
            await conn.query('UPDATE complaints SET status = ? WHERE complaint_id = ?', [s, cid]);
            const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
            const r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token: tokBh3W, body: { workerId: 1 } });
            const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
            const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
            all.push(`${s}:r=${r.status} assn ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status}`);
            if (!(r.status === 409 && beforeA[0].c === afterA[0].c && afterC[0].status === s)) okAll = false;
        }
        if (okAll) pass('T17: IN_PROGRESS/RESOLVED/CLOSED all rejected with 409, no changes', all.join(' | '));
        else fail('T17', all.join(' | '));
    }

    // --- T18: Water complaint -> 409 business error, no assignment ---
    {
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idWater]);
        const r = await http('POST', `/api/warden/complaints/${idWater}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idWater]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idWater]);
        const ok = r.status === 409 && beforeA[0].c === afterA[0].c && afterC[0].status === 'PENDING';
        if (ok) pass('T18: Water (no matching worker) -> 409, no assignment, status unchanged', `r=${r.status} ${r.json?.message}`);
        else fail('T18', `r=${r.status} ${r.json?.message}`);
    }

    // --- T19: Other complaint -> 409 business error ---
    {
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idOther]);
        const r = await http('POST', `/api/warden/complaints/${idOther}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [idOther]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [idOther]);
        const ok = r.status === 409 && beforeA[0].c === afterA[0].c && afterC[0].status === 'PENDING';
        if (ok) pass('T19: Other (no matching worker) -> 409, no assignment, status unchanged', `r=${r.status} ${r.json?.message}`);
        else fail('T19', `r=${r.status} ${r.json?.message}`);
    }

    // --- T20: atomic rollback on a failure after assignment INSERT but before commit ---
    // We install a BEFORE INSERT trigger that fails for one specific complaint_id.
    // The service's SELECT (complaint, worker) succeeds, the INSERT fails -> ROLLBACK.
    // Note: complaint creation itself writes one initial complaint_history
    // (NULL -> PENDING, 'Complaint created by student'), so we capture BEFORE
    // counts and require AFTER == BEFORE — the rollback must add zero NEW rows.
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4D-TEST T20 rollback');
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
        const [beforeC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
        const [beforeH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [cid]);
        await conn.query(`
            CREATE TRIGGER trg_assignments_rollback_t20
            BEFORE INSERT ON assignments
            FOR EACH ROW
            BEGIN
                IF NEW.complaint_id = ? THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced rollback for T20';
                END IF;
            END
        `, [cid]);
        const r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        await conn.query('DROP TRIGGER IF EXISTS trg_assignments_rollback_t20');
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ?', [cid]);
        const [afterC] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
        const [afterH] = await conn.query('SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id = ?', [cid]);
        const ok = r.status >= 500
                && afterA[0].c === beforeA[0].c
                && afterC[0].status === beforeC[0].status
                && afterH[0].c === beforeH[0].c;
        if (ok) pass('T20: mid-flow INSERT failure -> ROLLBACK, no NEW assignment/status/history rows', `r=${r.status} | assignments ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status} history ${beforeH[0].c}->${afterH[0].c}`);
        else fail('T20', `r=${r.status} ${r.json?.message} | assignments ${beforeA[0].c}->${afterA[0].c} status=${afterC[0].status} history ${beforeH[0].c}->${afterH[0].c}`);
    }

    // --- T21: /api/health works ---
    { const r = await http('GET', '/api/health'); if (r.status === 200 && r.json.success) pass('T21: /api/health works'); else fail('T21', JSON.stringify(r)); }

    // --- T22: /api/health/db works ---
    { const r = await http('GET', '/api/health/db'); if (r.status === 200 && r.json.success) pass('T22: /api/health/db works'); else fail('T22', JSON.stringify(r)); }

    // --- CLEANUP ---
    // Remove all PHASE4D-TEST* complaints (CASCADE history; assignments use FK ON DELETE CASCADE? No — assignments has RESTRICT).
    // So delete assignments first, then history, then complaints.
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4D-TEST%')`);
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4D-TEST%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'PHASE4D-TEST%'`);
    await conn.query('UPDATE students SET is_activated = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL, is_active = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL WHERE user_id IN (6,7)');

    // --- VERIFY CLEANUP ---
    const [c1] = await conn.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4D-TEST%'");
    const [a1] = await conn.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [s] = await conn.query("SELECT user_id, password_hash IS NULL AS hash_null FROM users WHERE user_id IN (1,2,6,7)");
    console.log('\n=== CLEANUP VERIFICATION ===');
    console.log('Remaining PHASE4D complaints:', c1[0].c);
    console.log('Orphan assignments:', a1[0].c);
    console.log('Users 1,2,6,7 hash_null:', s);

    const failed = RESULTS.filter(r => !r.ok);
    console.log(`\n${RESULTS.length - failed.length}/${RESULTS.length} passed`);
    if (failed.length > 0) {
        console.log('FAILURES:');
        failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
        process.exit(1);
    }
    console.log('ALL TESTS PASSED');
    await conn.end();
})().catch(e => { console.error('Driver crashed:', e); process.exit(1); });