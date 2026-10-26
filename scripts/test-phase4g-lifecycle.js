// scripts/test-phase4g-lifecycle.js
// Phase 4G full end-to-end lifecycle + security negative tests.
//
//   Cycle 1: student creates complaint, warden assigns, worker
//            drives to RESOLVED, student closes -> CLOSED.
//   Cycle 2: complaint created, assigned, resolved, student
//            reopens -> PENDING, warden reassigns, worker
//            drives again, student closes -> CLOSED. Verifies
//            assignment deactivation on reopen and full history.
//
//   Security negatives: cross-owner, cross-role, cross-hostel.

require('dotenv').config();
const mysql  = require('mysql2/promise');
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
        method, headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { /* may be empty */ }
    return { status: res.status, json };
}

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Clean stale PHASE4G-* data
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4G-TEST%')`);
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4G-TEST%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'PHASE4G-TEST%'`);

    // Activate students
    async function activateStudent(email) {
        const [u] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
        const hash = await bcrypt.hash('Test' + email + 'Pass!', 10);
        await conn.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [hash, u[0].user_id]);
        await conn.query('UPDATE students SET is_activated = TRUE WHERE user_id = ?', [u[0].user_id]);
        return u[0].user_id;
    }
    await activateStudent('student.bh3.thiru@hostelcare.test');
    await activateStudent('student.bh4.aarav@hostelcare.test');
    const stuAId = 1, stuBId = 2;
    const stuALogin = await http('POST', '/api/auth/login', { body: { email: 'student.bh3.thiru@hostelcare.test', password: 'Teststudent.bh3.thiru@hostelcare.testPass!' } });
    const stuBLogin = await http('POST', '/api/auth/login', { body: { email: 'student.bh4.aarav@hostelcare.test', password: 'Teststudent.bh4.aarav@hostelcare.testPass!' } });
    const tokStuA = stuALogin.json.data.token;
    const tokStuB = stuBLogin.json.data.token;

    // Set warden/worker passwords
    const bh3WardenPass = 'WardenBh3Pass!';
    const bh4WardenPass = 'WardenBh4Pass!';
    const w1Pass = 'WorkerBh3ElecPass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 6',  [await bcrypt.hash(bh3WardenPass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 7',  [await bcrypt.hash(bh4WardenPass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 11', [await bcrypt.hash(w1Pass, 10)]);
    const tokBh3W = (await http('POST', '/api/auth/login', { body: { email: 'warden.bh3@hostelcare.test', password: bh3WardenPass } })).json.data.token;
    const tokBh4W = (await http('POST', '/api/auth/login', { body: { email: 'warden.bh4@hostelcare.test', password: bh4WardenPass } })).json.data.token;
    const tokW1 = (await http('POST', '/api/auth/login', { body: { email: 'worker.bh3.electrical@hostelcare.test', password: w1Pass } })).json.data.token;

    // Helpers
    async function create(token, cat, title) {
        const r = await http('POST', '/api/complaints', { token, body: { category: cat, title, description: 'phase4g ' + title } });
        if (r.status !== 201) throw new Error(`create ${title}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data.complaintId;
    }
    async function dbStatus(cid) {
        const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
        return c[0]?.status;
    }
    async function dbHistory(cid) {
        const [h] = await conn.query('SELECT history_id, old_status, new_status, changed_by, note, changed_at FROM complaint_history WHERE complaint_id = ? ORDER BY changed_at ASC, history_id ASC', [cid]);
        return h;
    }
    async function dbActiveAssignments(cid) {
        const [a] = await conn.query('SELECT assignment_id, worker_id, is_active FROM assignments WHERE complaint_id = ? AND is_active = TRUE', [cid]);
        return a;
    }
    async function driveToResolved(cid) {
        let r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        if (r.status !== 200) throw new Error(`assign: ${r.status} ${JSON.stringify(r.json)}`);
        r = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        if (r.status !== 200) throw new Error(`IN_PROGRESS: ${r.status}`);
        r = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'RESOLVED' } });
        if (r.status !== 200) throw new Error(`RESOLVED: ${r.status}`);
    }

    // ===================================================================
    // CYCLE 1 — full happy path to CLOSED
    // ===================================================================
    console.log('\n--- CYCLE 1: full lifecycle to CLOSED ---');
    const cid1 = await create(tokStuA, 'Electrical', 'PHASE4G-TEST cycle1');

    // 1.1 student creates -> PENDING
    if ((await dbStatus(cid1)) === 'PENDING') pass('C1.1: created -> PENDING');
    else fail('C1.1', `status=${await dbStatus(cid1)}`);

    // 1.2 student views own
    const v1 = await http('GET', `/api/complaints/${cid1}`, { token: tokStuA });
    if (v1.status === 200 && v1.json.data.complaint.complaintId === cid1) pass('C1.2: student GET /complaints/:id');
    else fail('C1.2', JSON.stringify(v1));

    // 1.3 student lists
    const lst1 = await http('GET', '/api/complaints', { token: tokStuA });
    if (lst1.status === 200 && Array.isArray(lst1.json.data.complaints)) pass('C1.3: student GET /complaints');
    else fail('C1.3', JSON.stringify(lst1));

    // 1.4 warden sees complaint
    const wl = await http('GET', '/api/warden/complaints', { token: tokBh3W });
    const wl2 = await http('GET', `/api/warden/complaints/${cid1}`, { token: tokBh3W });
    if (wl.status === 200 && wl2.status === 200 && wl2.json.data.complaint.complaintId === cid1) pass('C1.4: warden views complaint');
    else fail('C1.4', JSON.stringify({ wl, wl2 }));

    // 1.5 warden changes priority
    const wp = await http('PATCH', `/api/warden/complaints/${cid1}/priority`, { token: tokBh3W, body: { priority: 'HIGH' } });
    const [pr] = await conn.query('SELECT priority FROM complaints WHERE complaint_id = ?', [cid1]);
    if (wp.status === 200 && pr[0].priority === 'HIGH') pass('C1.5: warden changes priority to HIGH');
    else fail('C1.5', JSON.stringify({ wp, p: pr[0] }));

    // 1.6 warden assigns
    const asg = await http('POST', `/api/warden/complaints/${cid1}/assign`, { token: tokBh3W, body: { workerId: 1 } });
    const [s1] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid1]);
    const active1 = await dbActiveAssignments(cid1);
    if (asg.status === 200 && s1[0].status === 'ASSIGNED' && active1.length === 1) pass('C1.6: warden assigns -> ASSIGNED + active assignment');
    else fail('C1.6', JSON.stringify({ asg, s: s1[0], active1 }));

    // 1.7 worker -> IN_PROGRESS
    const wip = await http('PATCH', `/api/worker/complaints/${cid1}/status`, { token: tokW1, body: { status: 'IN_PROGRESS', note: 'starting' } });
    if (wip.status === 200 && (await dbStatus(cid1)) === 'IN_PROGRESS') pass('C1.7: worker IN_PROGRESS');
    else fail('C1.7', JSON.stringify(wip));

    // 1.8 worker -> RESOLVED
    const wr = await http('PATCH', `/api/worker/complaints/${cid1}/status`, { token: tokW1, body: { status: 'RESOLVED', note: 'fixed' } });
    if (wr.status === 200 && (await dbStatus(cid1)) === 'RESOLVED') pass('C1.8: worker RESOLVED');
    else fail('C1.8', JSON.stringify(wr));

    // 1.9 student closes
    const sc = await http('PATCH', `/api/student/complaints/${cid1}/close`, { token: tokStuA, body: { note: 'all good' } });
    if (sc.status === 200 && (await dbStatus(cid1)) === 'CLOSED') pass('C1.9: student CLOSE -> CLOSED');
    else fail('C1.9', JSON.stringify(sc));

    // 1.10 verify history chain
    const h1 = await dbHistory(cid1);
    const expectedTransitions = [
        { old: null,         new: 'PENDING',     changedBy: stuAId },
        { old: 'PENDING',    new: 'ASSIGNED',    changedBy: 6 }, // warden user 6
        { old: 'ASSIGNED',   new: 'IN_PROGRESS', changedBy: 11 }, // worker user 11
        { old: 'IN_PROGRESS',new: 'RESOLVED',    changedBy: 11 },
        { old: 'RESOLVED',   new: 'CLOSED',      changedBy: stuAId },
    ];
    let chainOk = h1.length === expectedTransitions.length;
    for (let i = 0; i < expectedTransitions.length && chainOk; i++) {
        const r = h1[i], e = expectedTransitions[i];
        if (r.old_status !== e.old || r.new_status !== e.new || r.changed_by !== e.changedBy) chainOk = false;
    }
    if (chainOk) pass('C1.10: complete history chain (5 transitions, correct actors)');
    else fail('C1.10', JSON.stringify(h1));

    // ===================================================================
    // CYCLE 2 — reopen + reassign
    // ===================================================================
    console.log('\n--- CYCLE 2: reopen + reassign ---');
    const cid2 = await create(tokStuA, 'Electrical', 'PHASE4G-TEST cycle2');
    await driveToResolved(cid2);

    // 2.1 reopen
    const ro = await http('PATCH', `/api/student/complaints/${cid2}/reopen`, { token: tokStuA, body: { note: 'still broken' } });
    const active2 = await dbActiveAssignments(cid2);
    if (ro.status === 200 && (await dbStatus(cid2)) === 'PENDING' && active2.length === 0) {  // eslint-disable-line no-unused-vars
        pass('C2.1: reopen -> PENDING + previous assignment deactivated');
    } else {
        fail('C2.1', JSON.stringify({ ro, active2 }));
    }

    // 2.2 old worker blocked
    const stale = await http('PATCH', `/api/worker/complaints/${cid2}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
    if (stale.status === 404 || stale.status === 409) pass('C2.2: stale worker blocked');
    else fail('C2.2', JSON.stringify(stale));

    // 2.3 reassign
    const ra = await http('POST', `/api/warden/complaints/${cid2}/assign`, { token: tokBh3W, body: { workerId: 1 } });
    const active2b = await dbActiveAssignments(cid2);
    if (ra.status === 200 && active2b.length === 1) pass('C2.3: warden re-assigns, active assignment exists');
    else fail('C2.3', JSON.stringify({ ra, active2b }));

    // 2.4 second drive -> IN_PROGRESS
    const wip2 = await http('PATCH', `/api/worker/complaints/${cid2}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
    if (wip2.status === 200 && (await dbStatus(cid2)) === 'IN_PROGRESS') pass('C2.4: second-cycle IN_PROGRESS');
    else fail('C2.4', JSON.stringify(wip2));

    // 2.5 second drive -> RESOLVED
    const wr2 = await http('PATCH', `/api/worker/complaints/${cid2}/status`, { token: tokW1, body: { status: 'RESOLVED' } });
    if (wr2.status === 200 && (await dbStatus(cid2)) === 'RESOLVED') pass('C2.5: second-cycle RESOLVED');
    else fail('C2.5', JSON.stringify(wr2));

    // 2.6 student closes second cycle
    const sc2 = await http('PATCH', `/api/student/complaints/${cid2}/close`, { token: tokStuA, body: {} });
    if (sc2.status === 200 && (await dbStatus(cid2)) === 'CLOSED') pass('C2.6: second-cycle CLOSE');
    else fail('C2.6', JSON.stringify(sc2));

    // 2.7 verify history chain
    const h2 = await dbHistory(cid2);
    // Expected:
    // 1 NULL -> PENDING         (creation)
    // 2 PENDING -> ASSIGNED     (first assign)
    // 3 ASSIGNED -> IN_PROGRESS
    // 4 IN_PROGRESS -> RESOLVED
    // 5 RESOLVED -> PENDING     (reopen)
    // 6 PENDING -> ASSIGNED     (reassign)
    // 7 ASSIGNED -> IN_PROGRESS
    // 8 IN_PROGRESS -> RESOLVED
    // 9 RESOLVED -> CLOSED      (close)
    if (h2.length === 9 && h2[0].new_status === 'PENDING' && h2[8].new_status === 'CLOSED') pass('C2.7: full history chain (9 rows, NULL->CLOSED)');
    else fail('C2.7', `rows=${h2.length} first=${h2[0]?.new_status} last=${h2[8]?.new_status}`);

    // ===================================================================
    // SECURITY NEGATIVE TESTS
    // ===================================================================
    console.log('\n--- Security negative tests ---');

    // Create a BH-4 student complaint + push it to RESOLVED for cross-tests
    const cidBh4 = await create(tokStuB, 'Electrical', 'PHASE4G-TEST bh4x');
    let rr = await http('POST', `/api/warden/complaints/${cidBh4}/assign`, { token: tokBh4W, body: { workerId: 6 } });
    // push to RESOLVED via worker (need BH-4 worker password set)
    const w6Pass = 'WorkerBh4ElecPass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 16', [await bcrypt.hash(w6Pass, 10)]);
    const tokW6 = (await http('POST', '/api/auth/login', { body: { email: 'worker.bh4.electrical@hostelcare.test', password: w6Pass } })).json.data.token;
    await http('PATCH', `/api/worker/complaints/${cidBh4}/status`, { token: tokW6, body: { status: 'IN_PROGRESS' } });
    await http('PATCH', `/api/worker/complaints/${cidBh4}/status`, { token: tokW6, body: { status: 'RESOLVED' } });

    // SN1: student A accessing student B complaint -> 404
    rr = await http('GET', `/api/complaints/${cidBh4}`, { token: tokStuA });
    if (rr.status === 404) pass('SN1: student A GET student B complaint -> 404');
    else fail('SN1', JSON.stringify(rr));

    // SN2: student A closing student B complaint -> 404
    rr = await http('PATCH', `/api/student/complaints/${cidBh4}/close`, { token: tokStuA, body: {} });
    if (rr.status === 404) pass('SN2: student A close student B complaint -> 404');
    else fail('SN2', JSON.stringify(rr));

    // SN3: student A reopening student B complaint -> 404
    rr = await http('PATCH', `/api/student/complaints/${cidBh4}/reopen`, { token: tokStuA, body: {} });
    if (rr.status === 404) pass('SN3: student A reopen student B complaint -> 404');
    else fail('SN3', JSON.stringify(rr));

    // SN4: BH-3 warden accessing BH-4 complaint -> 404
    rr = await http('GET', `/api/warden/complaints/${cidBh4}`, { token: tokBh3W });
    if (rr.status === 404) pass('SN4: BH-3 warden GET BH-4 complaint -> 404');
    else fail('SN4', JSON.stringify(rr));

    // SN5: BH-3 warden assigning BH-4 worker -> 409 (cross-hostel worker)
    const cidBh3 = await create(tokStuA, 'Electrical', 'PHASE4G-TEST bh3x');
    rr = await http('POST', `/api/warden/complaints/${cidBh3}/assign`, { token: tokBh3W, body: { workerId: 6 } });
    if (rr.status === 409) pass('SN5: BH-3 warden assigning BH-4 worker -> 409');
    else fail('SN5', JSON.stringify(rr));

    // SN6: BH-3 warden assigning wrong-specialization worker -> 409
    rr = await http('POST', `/api/warden/complaints/${cidBh3}/assign`, { token: tokBh3W, body: { workerId: 2 } }); // worker 2 = Plumbing
    if (rr.status === 409) pass('SN6: BH-3 warden assigning wrong-specialization worker -> 409');
    else fail('SN6', JSON.stringify(rr));

    // SN7: worker A modifying worker B complaint -> 404 (cidBh4 belongs to worker 6, tokW1 = worker 1)
    rr = await http('PATCH', `/api/worker/complaints/${cidBh4}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
    if (rr.status === 404 || rr.status === 409) pass('SN7: worker A modifying worker B complaint -> blocked');
    else fail('SN7', JSON.stringify(rr));

    // SN8: worker modifying unassigned complaint -> 409
    const cidUnassigned = await create(tokStuA, 'Electrical', 'PHASE4G-TEST unassigned');
    rr = await http('PATCH', `/api/worker/complaints/${cidUnassigned}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
    if (rr.status === 409) pass('SN8: worker modifying unassigned complaint -> 409');
    else fail('SN8', JSON.stringify(rr));

    // SN9: student calling worker endpoint -> 403
    rr = await http('PATCH', `/api/worker/complaints/${cid1}/status`, { token: tokStuA, body: { status: 'IN_PROGRESS' } });
    if (rr.status === 403) pass('SN9: student calling worker endpoint -> 403');
    else fail('SN9', JSON.stringify(rr));

    // SN10: worker calling warden endpoint -> 403
    rr = await http('POST', `/api/warden/complaints/${cid1}/assign`, { token: tokW1, body: { workerId: 1 } });
    if (rr.status === 403) pass('SN10: worker calling warden endpoint -> 403');
    else fail('SN10', JSON.stringify(rr));

    // SN11: warden calling student close endpoint -> 403
    rr = await http('PATCH', `/api/student/complaints/${cid1}/close`, { token: tokBh3W, body: {} });
    if (rr.status === 403) pass('SN11: warden calling student close endpoint -> 403');
    else fail('SN11', JSON.stringify(rr));

    // SN12: missing JWT -> 401 (anywhere)
    rr = await http('PATCH', `/api/student/complaints/${cid1}/close`, { body: {} });
    if (rr.status === 401) pass('SN12: missing JWT -> 401');
    else fail('SN12', JSON.stringify(rr));

    // SN13: invalid JWT -> 401
    rr = await http('PATCH', `/api/student/complaints/${cid1}/close`, { token: 'bogus.bogus.bogus', body: {} });
    if (rr.status === 401) pass('SN13: invalid JWT -> 401');
    else fail('SN13', JSON.stringify(rr));

    // SN14: health endpoints open
    rr = await http('GET', '/api/health');
    if (rr.status === 200 && rr.json.success) pass('SN14: /api/health open (no auth)');
    else fail('SN14', JSON.stringify(rr));
    rr = await http('GET', '/api/health/db');
    if (rr.status === 200 && rr.json.success) pass('SN15: /api/health/db open (no auth)');
    else fail('SN15', JSON.stringify(rr));

    // CLEANUP
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4G-TEST%')`);
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4G-TEST%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'PHASE4G-TEST%'`);
    await conn.query('UPDATE students SET is_activated = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL, is_active = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL WHERE user_id IN (6,7,11,16)');

    const [c1] = await conn.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4G-TEST%'");
    const [a1] = await conn.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [h1c] = await conn.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [u] = await conn.query("SELECT user_id, role, is_active, password_hash IS NULL AS hash_null FROM users WHERE user_id IN (1,2,6,7,11,16) ORDER BY user_id");
    console.log('\n=== CLEANUP ===');
    console.log('PHASE4G complaints left:', c1[0].c);
    console.log('Orphan assignments:', a1[0].c);
    console.log('Orphan history:', h1c[0].c);
    console.table(u);

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