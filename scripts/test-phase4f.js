// scripts/test-phase4f.js
// Phase 4F end-to-end test driver (T1-T34).
//
// Strategy:
//   * Activate student.bh3.thiru (BH-3) and student.bh4.aarav (BH-4).
//   * Set temp passwords for BH-3 warden, BH-4 warden, and BH-3
//     Electrical worker (worker_id=1, user_id=11).
//   * Create Phase 4F complaints via the student API, push them
//     to RESOLVED via the warden + worker APIs (Phase 4D/4E),
//     then drive close/reopen via the new Phase 4F endpoints.
//   * Clean up everything at the end.

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');

const BASE = 'http://localhost:5000';

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

async function activateStudent(conn, email) {
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
async function loginWorker(email, password) {
    const r = await http('POST', '/api/auth/login', { body: { email, password } });
    if (r.status !== 200) throw new Error(`worker login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.data.token;
}

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Clean stale PHASE4F-* data
    await conn.query(
        `DELETE ha FROM complaint_history ha
         JOIN complaints ca ON ha.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4F-TEST%'`
    );
    await conn.query(
        `DELETE aa FROM assignments aa
         JOIN complaints ca ON aa.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4F-TEST%'`
    );
    await conn.query("DELETE FROM complaints WHERE title LIKE 'PHASE4F-TEST%'");

    // Activate students
    await activateStudent(conn, 'student.bh3.thiru@hostelcare.test');
    await activateStudent(conn, 'student.bh4.aarav@hostelcare.test');
    const tokStuA = await loginStudent('student.bh3.thiru@hostelcare.test'); // BH-3, user 1
    const tokStuB = await loginStudent('student.bh4.aarav@hostelcare.test'); // BH-4, user 2

    const bh3WardenPass = 'WardenBh3Pass!';
    const bh4WardenPass = 'WardenBh4Pass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 6',  [await bcrypt.hash(bh3WardenPass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 7',  [await bcrypt.hash(bh4WardenPass, 10)]);
    const tokBh3W = await loginWarden('warden.bh3@hostelcare.test', bh3WardenPass);
    const tokBh4W = await loginWarden('warden.bh4@hostelcare.test', bh4WardenPass);

    const w1Pass = 'WorkerBh3ElecPass!';
    const w6Pass = 'WorkerBh4ElecPass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 11', [await bcrypt.hash(w1Pass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 16', [await bcrypt.hash(w6Pass, 10)]);
    const tokW1 = await loginWorker('worker.bh3.electrical@hostelcare.test', w1Pass);
    const tokW6 = await loginWorker('worker.bh4.electrical@hostelcare.test', w6Pass);

    // Helpers
    async function createComplaint(token, category, title) {
        const r = await http('POST', '/api/complaints', { token, body: { category, title, description: 'phase4f ' + title } });
        if (r.status !== 201) throw new Error(`create ${title}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data.complaintId;
    }
    async function assign(token, cid, workerId) {
        const r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token, body: { workerId } });
        if (r.status !== 200) throw new Error(`assign ${cid}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data;
    }
    async function driveToResolved(cid) {
        await assign(tokBh3W, cid, 1);
        let r = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        if (r.status !== 200) throw new Error(`worker IN_PROGRESS ${cid}: ${r.status} ${JSON.stringify(r.json)}`);
        r = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'RESOLVED' } });
        if (r.status !== 200) throw new Error(`worker RESOLVED ${cid}: ${r.status} ${JSON.stringify(r.json)}`);
    }
    async function dbStatus(cid) {
        const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
        return c[0]?.status;
    }
    async function dbHistory(cid) {
        const [h] = await conn.query(
            'SELECT history_id, old_status, new_status, changed_by, note, changed_at '
            + 'FROM complaint_history WHERE complaint_id = ? ORDER BY changed_at ASC, history_id ASC',
            [cid]
        );
        return h;
    }
    async function dbActiveAssignment(cid) {
        const [rows] = await conn.query(
            'SELECT assignment_id, worker_id, is_active FROM assignments WHERE complaint_id = ? AND is_active = TRUE',
            [cid]
        );
        return rows;
    }

    // Seed 9 complaints in BH-3 (Electrical) for close tests,
    // 1 complaint in BH-4 (Electrical) for cross-student tests.
    const C = {};
    for (let i = 1; i <= 9; i++) {
        const cid = await createComplaint(tokStuA, 'Electrical', `PHASE4F-TEST C${i} close`);
        await driveToResolved(cid);
        C['c' + i] = cid;
    }
    const cidBh4 = await createComplaint(tokStuB, 'Electrical', 'PHASE4F-TEST X1 bh4');
    await assign(tokBh4W, cidBh4, 6); // BH-4 worker (worker_id=6)
    console.log('Seeded complaint ids:', { ...C, cidBh4 });

    // =========================
    // CLOSE tests
    // =========================

    // T1: Correct student closes RESOLVED -> 200
    let r = await http('PATCH', `/api/student/complaints/${C.c1}/close`, { token: tokStuA, body: { note: 'Issue has been resolved. Thank you.' } });
    if (r.status === 200 && r.json.data.complaintId === C.c1 && r.json.data.status === 'CLOSED') {
        pass('T1: student closes RESOLVED -> 200 CLOSED');
    } else {
        fail('T1', JSON.stringify(r));
    }

    // T2: complaints.status = CLOSED
    {
        const s = await dbStatus(C.c1);
        if (s === 'CLOSED') pass('T2: complaints.status = CLOSED');
        else fail('T2', `status=${s}`);
    }

    // T3 + T4: complaint_history has RESOLVED -> CLOSED, changed_by = student user_id (1)
    {
        const h = await dbHistory(C.c1);
        const last = h[h.length - 1];
        const ok = last && last.old_status === 'RESOLVED' && last.new_status === 'CLOSED' && last.changed_by === 1;
        if (ok) pass('T3+T4: history RESOLVED -> CLOSED, changed_by=student user_id(1)', JSON.stringify(last));
        else fail('T3+T4', JSON.stringify(last));
    }

    // T5: supplied note stored verbatim
    {
        const h = await dbHistory(C.c1);
        const last = h[h.length - 1];
        if (last && last.note === 'Issue has been resolved. Thank you.') {
            pass('T5: supplied close note stored verbatim', `note="${last.note}"`);
        } else {
            fail('T5', JSON.stringify(last));
        }
    }

    // T6: close without note -> 200, default note
    r = await http('PATCH', `/api/student/complaints/${C.c2}/close`, { token: tokStuA, body: {} });
    {
        const h = await dbHistory(C.c2);
        const last = h[h.length - 1];
        const ok = r.status === 200 && last && last.note === 'Complaint closed by student';
        if (ok) pass('T6: close without note -> 200 with default note', `note="${last?.note}"`);
        else fail('T6', JSON.stringify({ r, last }));
    }

    // T7: PENDING -> close -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T7 pending');
        const rr = await http('PATCH', `/api/student/complaints/${cid}/close`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T7: close PENDING -> 409');
        else fail('T7', JSON.stringify(rr));
    }

    // T8: ASSIGNED -> close -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T8 assigned');
        await assign(tokBh3W, cid, 1);
        const rr = await http('PATCH', `/api/student/complaints/${cid}/close`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T8: close ASSIGNED -> 409');
        else fail('T8', JSON.stringify(rr));
    }

    // T9: IN_PROGRESS -> close -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T9 inprogress');
        await assign(tokBh3W, cid, 1);
        await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const rr = await http('PATCH', `/api/student/complaints/${cid}/close`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T9: close IN_PROGRESS -> 409');
        else fail('T9', JSON.stringify(rr));
    }

    // T10: already CLOSED -> 409
    {
        // C.c1 is already CLOSED from T1
        const rr = await http('PATCH', `/api/student/complaints/${C.c1}/close`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T10: close already-CLOSED -> 409');
        else fail('T10', JSON.stringify(rr));
    }

    // =========================
    // REOPEN tests
    // =========================

    // T11: reopen RESOLVED -> 200
    r = await http('PATCH', `/api/student/complaints/${C.c3}/reopen`, { token: tokStuA, body: { note: 'The issue is still occurring.' } });
    if (r.status === 200 && r.json.data.status === 'PENDING') pass('T11: reopen RESOLVED -> 200 PENDING');
    else fail('T11', JSON.stringify(r));

    // T12: status = PENDING
    {
        const s = await dbStatus(C.c3);
        if (s === 'PENDING') pass('T12: complaints.status = PENDING');
        else fail('T12', `status=${s}`);
    }

    // T13 + T14: history RESOLVED -> PENDING, changed_by = student user_id (1)
    {
        const h = await dbHistory(C.c3);
        const last = h[h.length - 1];
        const ok = last && last.old_status === 'RESOLVED' && last.new_status === 'PENDING' && last.changed_by === 1;
        if (ok) pass('T13+T14: history RESOLVED -> PENDING, changed_by=student user_id(1)', JSON.stringify(last));
        else fail('T13+T14', JSON.stringify(last));
    }

    // T15: supplied reopen note
    {
        const h = await dbHistory(C.c3);
        const last = h[h.length - 1];
        if (last && last.note === 'The issue is still occurring.') {
            pass('T15: supplied reopen note stored verbatim');
        } else {
            fail('T15', JSON.stringify(last));
        }
    }

    // T16: reopen without note -> 200, default
    {
        const rr = await http('PATCH', `/api/student/complaints/${C.c4}/reopen`, { token: tokStuA, body: {} });
        const h = await dbHistory(C.c4);
        const last = h[h.length - 1];
        if (rr.status === 200 && last && last.note === 'Complaint reopened by student') {
            pass('T16: reopen without note -> 200 with default note', `note="${last.note}"`);
        } else {
            fail('T16', JSON.stringify({ rr, last }));
        }
    }

    // T17: reopen PENDING -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T17 pending');
        const rr = await http('PATCH', `/api/student/complaints/${cid}/reopen`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T17: reopen PENDING -> 409');
        else fail('T17', JSON.stringify(rr));
    }

    // T18: reopen ASSIGNED -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T18 assigned');
        await assign(tokBh3W, cid, 1);
        const rr = await http('PATCH', `/api/student/complaints/${cid}/reopen`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T18: reopen ASSIGNED -> 409');
        else fail('T18', JSON.stringify(rr));
    }

    // T19: reopen IN_PROGRESS -> 409
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T19 inprogress');
        await assign(tokBh3W, cid, 1);
        await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const rr = await http('PATCH', `/api/student/complaints/${cid}/reopen`, { token: tokStuA, body: {} });
        if (rr.status === 409) pass('T19: reopen IN_PROGRESS -> 409');
        else fail('T19', JSON.stringify(rr));
    }

    // T20: reopen CLOSED -> 200 PENDING (student can reopen closed ticket)
    {
        // C.c1 is CLOSED from T1
        const rr = await http('PATCH', `/api/student/complaints/${C.c1}/reopen`, { token: tokStuA, body: {} });
        if (rr.status === 200 && rr.json?.data?.status === 'PENDING') pass('T20: reopen CLOSED -> 200 PENDING');
        else fail('T20', JSON.stringify(rr));
    }

    // =========================
    // SECURITY tests
    // =========================

    // T21: Student attempts to close another student's RESOLVED complaint
    {
        // cidBh4 is BH-4, assigned to BH-4 worker (worker_id=6). Push it to RESOLVED.
        await http('PATCH', `/api/worker/complaints/${cidBh4}/status`, { token: tokW6, body: { status: 'IN_PROGRESS' } });
        await http('PATCH', `/api/worker/complaints/${cidBh4}/status`, { token: tokW6, body: { status: 'RESOLVED' } });
        // tokStuA tries to close cidBh4
        const rr = await http('PATCH', `/api/student/complaints/${cidBh4}/close`, { token: tokStuA, body: {} });
        const s = await dbStatus(cidBh4);
        if (rr.status === 404 && s === 'RESOLVED') pass('T21: cross-student close -> 404, status unchanged');
        else fail('T21', JSON.stringify({ rr, s }));
    }

    // T22: Student attempts to reopen another student's RESOLVED complaint
    {
        const rr = await http('PATCH', `/api/student/complaints/${cidBh4}/reopen`, { token: tokStuA, body: {} });
        const s = await dbStatus(cidBh4);
        if (rr.status === 404 && s === 'RESOLVED') pass('T22: cross-student reopen -> 404, status unchanged');
        else fail('T22', JSON.stringify({ rr, s }));
    }

    // T23: WARDEN attempts close
    {
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokBh3W, body: {} });
        if (rr.status === 403) pass('T23: WARDEN attempts close -> 403');
        else fail('T23', JSON.stringify(rr));
    }

    // T24: WORKER attempts close
    {
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokW1, body: {} });
        if (rr.status === 403) pass('T24: WORKER attempts close -> 403');
        else fail('T24', JSON.stringify(rr));
    }

    // T25: no JWT
    {
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { body: {} });
        if (rr.status === 401) pass('T25: no JWT -> 401');
        else fail('T25', JSON.stringify(rr));
    }

    // T26: invalid JWT
    {
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: 'bogus.token.here', body: {} });
        if (rr.status === 401) pass('T26: invalid JWT -> 401');
        else fail('T26', JSON.stringify(rr));
    }

    // =========================
    // INPUT validation
    // =========================

    // T27: invalid complaint IDs
    {
        const cases = ['abc', '0', '-1', '1.5'];
        const all = [];
        let ok = true;
        for (const cid of cases) {
            const rr = await http('PATCH', `/api/student/complaints/${cid}/close`, { token: tokStuA, body: {} });
            all.push(`${cid}=${rr.status}`);
            if (rr.status !== 400) ok = false;
        }
        if (ok) pass('T27: invalid complaint id -> 400', all.join(' '));
        else fail('T27', all.join(' '));
    }

    // T28: invalid note type (non-string, non-null)
    // Note: null and undefined mean "no note supplied" and are
    // accepted (default note is used). Non-string non-null types
    // are rejected with 400.
    {
        const cases = [12345, { x: 1 }, ['a']];
        const all = [];
        let ok = true;
        for (const note of cases) {
            const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokStuA, body: { note } });
            all.push(`${JSON.stringify(note)}=${rr.status}`);
            if (rr.status !== 400) ok = false;
        }
        if (ok) pass('T28: invalid note type (non-string, non-null) -> 400', all.join(' '));
        else fail('T28', all.join(' '));
    }

    // T28b: null note is treated as absent -> 200 with default
    {
        // First reset C.c5 to RESOLVED if close was rejected above
        // (it should be — T28 rejects so status remains RESOLVED)
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokStuA, body: { note: null } });
        const h = await dbHistory(C.c5);
        const last = h[h.length - 1];
        if (rr.status === 200 && last && last.note === 'Complaint closed by student') {
            pass('T28b: null note treated as absent -> 200 with default');
        } else {
            fail('T28b', JSON.stringify({ rr, last }));
        }
    }

    // T29: whitespace-only / empty note
    {
        const cases = ['   ', '\t', '\n', ''];
        const all = [];
        let ok = true;
        for (const note of cases) {
            const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokStuA, body: { note } });
            all.push(`${JSON.stringify(note)}=${rr.status}`);
            if (rr.status !== 400) ok = false;
        }
        if (ok) pass('T29: whitespace-only / empty note -> 400', all.join(' '));
        else fail('T29', all.join(' '));
    }

    // T30: note > 1000 chars
    {
        const longNote = 'x'.repeat(1001);
        const rr = await http('PATCH', `/api/student/complaints/${C.c5}/close`, { token: tokStuA, body: { note: longNote } });
        if (rr.status === 400) pass('T30: note > 1000 chars -> 400');
        else fail('T30', JSON.stringify(rr));
    }

    // =========================
    // TRANSACTION / ROLLBACK
    // =========================

    // T31: force history INSERT failure after status UPDATE -> 500 + ROLLBACK
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T31 trigger');
        await driveToResolved(cid);
        const beforeH = await dbHistory(cid);
        await conn.query(`
            CREATE TRIGGER trg_phase4f_history_rollback
            BEFORE INSERT ON complaint_history
            FOR EACH ROW
            BEGIN
                IF NEW.complaint_id = ? THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced rollback for T31';
                END IF;
            END
        `, [cid]);
        const rr = await http('PATCH', `/api/student/complaints/${cid}/close`, { token: tokStuA, body: { note: 'should fail' } });
        await conn.query('DROP TRIGGER IF EXISTS trg_phase4f_history_rollback');
        const afterH = await dbHistory(cid);
        const afterS = await dbStatus(cid);
        const ok = rr.status >= 500 && afterS === 'RESOLVED' && afterH.length === beforeH.length;
        if (ok) pass('T31: history INSERT failure -> 500 + ROLLBACK, status unchanged, no new history', `r=${rr.status}`);
        else fail('T31', JSON.stringify({ rr, afterS, historyDelta: afterH.length - beforeH.length }));
    }

    // T32: /api/health
    {
        const rr = await http('GET', '/api/health');
        if (rr.status === 200 && rr.json.success) pass('T32: /api/health works');
        else fail('T32', JSON.stringify(rr));
    }

    // T33: /api/health/db
    {
        const rr = await http('GET', '/api/health/db');
        if (rr.status === 200 && rr.json.success) pass('T33: /api/health/db works');
        else fail('T33', JSON.stringify(rr));
    }

    // =========================
    // T34: full second-cycle lifecycle
    // =========================
    // Create -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> PENDING (reopen)
    // -> ASSIGNED (re-assigned) -> IN_PROGRESS (new worker status)
    {
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4F-TEST T34 cycle');
        await driveToResolved(cid);
        const firstAssignment = await dbActiveAssignment(cid);

        // Reopen
        const reopen = await http('PATCH', `/api/student/complaints/${cid}/reopen`, { token: tokStuA, body: { note: 'cycle reopen' } });
        const reopenedStatus = await dbStatus(cid);
        const reopenHistory = await dbHistory(cid);
        const reopenHistoryRow = reopenHistory[reopenHistory.length - 1];
        // No active assignment after reopen.
        const activeAfterReopen = await dbActiveAssignment(cid);

        // Old worker tries to set status — must fail because the
        // assignment was deactivated.
        const staleAttempt = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });

        // Re-assign via Phase 4D
        const reassign = await http('POST', `/api/warden/complaints/${cid}/assign`, { token: tokBh3W, body: { workerId: 1 } });
        const activeAfterReassign = await dbActiveAssignment(cid);

        // Worker drives second cycle to IN_PROGRESS
        const newDrive = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const finalStatus = await dbStatus(cid);
        const finalHistory = await dbHistory(cid);

        const ok = reopen.status === 200
                && reopenedStatus === 'PENDING'
                && reopenHistoryRow && reopenHistoryRow.old_status === 'RESOLVED' && reopenHistoryRow.new_status === 'PENDING'
                && activeAfterReopen.length === 0                              // no active assignment after reopen
                && (staleAttempt.status === 404 || staleAttempt.status === 409)  // old worker blocked (404 if complaint not found, 409 if transition invalid because active assignment gone)
                && reassign.status === 200
                && activeAfterReassign.length === 1 && activeAfterReassign[0].worker_id === 1
                && newDrive.status === 200
                && finalStatus === 'IN_PROGRESS'
                && finalHistory.length === reopenHistory.length + 2;            // +1 reassign doesn't write history (4D didn't add to history in Phase 4D? — let me reconsider)
        // Phase 4D DOES add a history row per spec ("old=PENDING new=ASSIGNED changed_by=warden").
        // So reassign adds 1 history row + 1 status update history. After reopen we had:
        //   PENDING (creation), ASSIGNED, IN_PROGRESS, RESOLVED, PENDING (reopen)  = 5 rows
        // Then reassign adds: PENDING -> ASSIGNED  = 1 row  -> 6 rows
        // Then worker IN_PROGRESS: ASSIGNED -> IN_PROGRESS = 1 row -> 7 rows
        // So final = 7 rows, reopenHistory.length + 2 = 5 + 2 = 7.
        if (ok) pass('T34: full second-cycle lifecycle — reopen, no active assignment, stale worker blocked, re-assign, second drive works');
        else fail('T34', JSON.stringify({
            reopen: reopen.status, reopenedStatus, historyCountAfterReopen: reopenHistory.length,
            activeAfterReopen: activeAfterReopen.length, staleAttempt: staleAttempt.status,
            reassign: reassign.status, activeAfterReassign: activeAfterReassign.length,
            newDrive: newDrive.status, finalStatus, finalHistoryCount: finalHistory.length,
        }));
    }

    // =========================
    // CLEANUP
    // =========================
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4F-TEST%')`);
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4F-TEST%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'PHASE4F-TEST%'`);
    await conn.query('UPDATE students SET is_activated = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL, is_active = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL WHERE user_id IN (6,7,11,16)');

    // Verify cleanup
    const [c1] = await conn.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4F-TEST%'");
    const [a1] = await conn.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [h1] = await conn.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [u]  = await conn.query("SELECT user_id, role, is_active, password_hash IS NULL AS hash_null FROM users WHERE user_id IN (1,2,6,7,11,16) ORDER BY user_id");
    console.log('\n=== CLEANUP VERIFICATION ===');
    console.log('Remaining PHASE4F complaints:', c1[0].c);
    console.log('Orphan assignments:', a1[0].c);
    console.log('Orphan history:', h1[0].c);
    console.log('Users state:');
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
