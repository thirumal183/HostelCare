// scripts/test-phase4e.js
// Phase 4E end-to-end test driver (T1-T32).
//
// Strategy:
//   * Use existing seed workers (worker_id 1 = BH-3 Electrical,
//     worker_id 2 = BH-3 Plumbing, worker_id 6 = BH-4 Electrical).
//   * Set temporary bcrypt passwords for a few seed users so we
//     can mint JWTs via /api/auth/login. (Seed leaves
//     password_hash NULL; workers are is_active=TRUE.)
//   * Create Phase 4E test complaints via the student API, then
//     push them to ASSIGNED via the warden API (Phase 4D), then
//     drive the worker status transitions via the new endpoint.
//   * Clean up everything at the end.

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
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { /* may be empty */ }
    return { status: res.status, json };
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

async function activateStudent(conn, email) {
    const [u] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (u.length === 0) throw new Error(`No user ${email}`);
    const hash = await bcrypt.hash('Test' + email + 'Pass!', 10);
    await conn.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [hash, u[0].user_id]);
    await conn.query('UPDATE students SET is_activated = TRUE WHERE user_id = ?', [u[0].user_id]);
    return u[0].user_id;
}

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Clean stale PHASE4E-* data
    await conn.query(
        `DELETE ha FROM complaint_history ha
         JOIN complaints ca ON ha.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4E-TEST%'`
    );
    await conn.query(
        `DELETE aa FROM assignments aa
         JOIN complaints ca ON aa.complaint_id = ca.complaint_id
         WHERE ca.title LIKE 'PHASE4E-TEST%'`
    );
    await conn.query("DELETE FROM complaints WHERE title LIKE 'PHASE4E-TEST%'");

    // Activate students and set warden/worker passwords (seed leaves them NULL)
    await activateStudent(conn, 'student.bh3.thiru@hostelcare.test');
    await activateStudent(conn, 'student.bh4.aarav@hostelcare.test');
    const tokStuA = await loginStudent('student.bh3.thiru@hostelcare.test');
    const tokStuB = await loginStudent('student.bh4.aarav@hostelcare.test');

    const bh3WardenPass = 'WardenBh3Pass!';
    const bh4WardenPass = 'WardenBh4Pass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 6', [await bcrypt.hash(bh3WardenPass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 7', [await bcrypt.hash(bh4WardenPass, 10)]);
    const tokBh3W = await loginWarden('warden.bh3@hostelcare.test', bh3WardenPass);
    const tokBh4W = await loginWarden('warden.bh4@hostelcare.test', bh4WardenPass);

    // Set temporary passwords for the seed workers we need:
    //   worker_id=1  user_id=11 BH-3 Electrical
    //   worker_id=2  user_id=12 BH-3 Plumbing
    //   worker_id=6  user_id=16 BH-4 Electrical (cross-worker test)
    const w1Pass = 'WorkerBh3ElecPass!';
    const w2Pass = 'WorkerBh3PlumbPass!';
    const w6Pass = 'WorkerBh4ElecPass!';
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 11', [await bcrypt.hash(w1Pass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 12', [await bcrypt.hash(w2Pass, 10)]);
    await conn.query('UPDATE users SET password_hash = ? WHERE user_id = 16', [await bcrypt.hash(w6Pass, 10)]);
    const tokW1 = await loginWorker('worker.bh3.electrical@hostelcare.test', w1Pass); // user 11 -> worker 1
    const tokW2 = await loginWorker('worker.bh3.plumbing@hostelcare.test',  w2Pass); // user 12 -> worker 2
    const tokW6 = await loginWorker('worker.bh4.electrical@hostelcare.test', w6Pass); // user 16 -> worker 6

    async function createComplaint(token, category, title) {
        const r = await http('POST', '/api/complaints', { token, body: { category, title, description: 'phase4e test ' + title } });
        if (r.status !== 201) throw new Error(`create ${title}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data.complaintId;
    }

    async function wardenAssign(token, cid, workerId) {
        const r = await http('POST', `/api/warden/complaints/${cid}/assign`, { token, body: { workerId } });
        if (r.status !== 200) throw new Error(`warden assign cid=${cid} worker=${workerId}: ${r.status} ${JSON.stringify(r.json)}`);
        return r.json.data;
    }

    // Helper: ensure a complaint is currently ASSIGNED to `workerId`.
    async function ensureAssigned(token, cid, workerId) {
        const [c] = await conn.query('SELECT status FROM complaints WHERE complaint_id = ?', [cid]);
        if (c[0]?.status === 'ASSIGNED') return;
        if (c[0]?.status === 'PENDING') {
            await wardenAssign(token, cid, workerId);
            return;
        }
        // Reset for tests that need a fresh ASSIGNED state.
        // Deactivate old assignments and reset to PENDING.
        await conn.query('UPDATE assignments SET is_active = FALSE WHERE complaint_id = ?', [cid]);
        await conn.query("UPDATE complaints SET status = 'PENDING' WHERE complaint_id = ?", [cid]);
        await wardenAssign(token, cid, workerId);
    }

    // Helper: get current status from DB.
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

    // Seed: 5 complaints in BH-3 Electrical, all assigned to worker 1 (BH-3 Electrical).
    const idElec1 = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST A1');
    const idElec2 = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST A2');
    const idElec3 = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST A3');
    const idElec4 = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST A4');
    const idElec5 = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST A5');
    await ensureAssigned(tokBh3W, idElec1, 1);
    await ensureAssigned(tokBh3W, idElec2, 1);
    await ensureAssigned(tokBh3W, idElec3, 1);
    await ensureAssigned(tokBh3W, idElec4, 1);
    await ensureAssigned(tokBh3W, idElec5, 1);

    // Cross-worker test setup: create a BH-4 complaint and assign to BH-4 worker (worker_id=6).
    const idBh4Elec = await createComplaint(tokStuB, 'Electrical', 'PHASE4E-TEST B1 bh4');
    await ensureAssigned(tokBh4W, idBh4Elec, 6);

    // Cross-worker test setup: a BH-3 complaint assigned to a DIFFERENT worker (worker_id=2, Plumbing).
    const idBh3Plumb = await createComplaint(tokStuA, 'Plumbing', 'PHASE4E-TEST A6 plumb');
    await ensureAssigned(tokBh3W, idBh3Plumb, 2);

    console.log('Seeded complaint ids:', { idElec1, idElec2, idElec3, idElec4, idElec5, idBh4Elec, idBh3Plumb });

    // =========================
    // T1: ASSIGNED -> IN_PROGRESS, expect 200
    // =========================
    let r = await http('PATCH', `/api/worker/complaints/${idElec1}/status`, { token: tokW1, body: { status: 'IN_PROGRESS', note: 'Started inspection of the electrical issue.' } });
    if (r.status === 200 && r.json.data.complaintId === idElec1 && r.json.data.status === 'IN_PROGRESS') {
        pass('T1: worker ASSIGNED -> IN_PROGRESS -> 200');
    } else {
        fail('T1', JSON.stringify(r));
    }

    // T2: complaints.status = IN_PROGRESS
    {
        const s = await dbStatus(idElec1);
        if (s === 'IN_PROGRESS') pass('T2: complaints.status = IN_PROGRESS');
        else fail('T2', `status=${s}`);
    }

    // T3+T4: complaint_history has ASSIGNED -> IN_PROGRESS, changed_by = user 11
    {
        const h = await dbHistory(idElec1);
        const last = h[h.length - 1];
        const ok = last && last.old_status === 'ASSIGNED' && last.new_status === 'IN_PROGRESS' && last.changed_by === 11;
        if (ok) pass('T3+T4: history row ASSIGNED -> IN_PROGRESS, changed_by=worker user_id(11)');
        else fail('T3+T4', JSON.stringify(last));
    }

    // T5: supplied note is stored correctly
    {
        const h = await dbHistory(idElec1);
        const last = h[h.length - 1];
        if (last && last.note === 'Started inspection of the electrical issue.') {
            pass('T5: supplied note stored verbatim', `note="${last.note}"`);
        } else {
            fail('T5', JSON.stringify(last));
        }
    }

    // T6: IN_PROGRESS -> RESOLVED, expect 200
    r = await http('PATCH', `/api/worker/complaints/${idElec1}/status`, { token: tokW1, body: { status: 'RESOLVED', note: 'Issue fixed and verified.' } });
    if (r.status === 200 && r.json.data.status === 'RESOLVED') pass('T6: worker IN_PROGRESS -> RESOLVED -> 200');
    else fail('T6', JSON.stringify(r));

    // T7: complaints.status = RESOLVED
    {
        const s = await dbStatus(idElec1);
        if (s === 'RESOLVED') pass('T7: complaints.status = RESOLVED');
        else fail('T7', `status=${s}`);
    }

    // T8: history row IN_PROGRESS -> RESOLVED
    {
        const h = await dbHistory(idElec1);
        const last = h[h.length - 1];
        if (last && last.old_status === 'IN_PROGRESS' && last.new_status === 'RESOLVED' && last.changed_by === 11) {
            pass('T8: history row IN_PROGRESS -> RESOLVED', JSON.stringify(last));
        } else {
            fail('T8', JSON.stringify(last));
        }
    }

    // T9: cross-worker — worker 2 (Plumbing) tries to update a complaint assigned to worker 1 (Electrical, currently ASSIGNED).
    {
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ? AND is_active = TRUE', [idElec2]);
        const beforeH = await dbHistory(idElec2);
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: tokW2, body: { status: 'IN_PROGRESS' } });
        const afterH = await dbHistory(idElec2);
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ? AND is_active = TRUE', [idElec2]);
        const afterS = await dbStatus(idElec2);
        const ok = rr.status === 404
                && beforeA[0].c === 1
                && afterA[0].c === 1
                && afterH.length === beforeH.length
                && afterS === 'ASSIGNED';
        if (ok) pass('T9: cross-worker -> 404, no status change, no extra history');
        else fail('T9', JSON.stringify({ rr, afterS, beforeH: beforeH.length, afterH: afterH.length }));
    }

    // T10: nonexistent complaint
    {
        const rr = await http('PATCH', '/api/worker/complaints/9999/status', { token: tokW1, body: { status: 'IN_PROGRESS' } });
        if (rr.status === 404) pass('T10: nonexistent complaint -> 404');
        else fail('T10', JSON.stringify(rr));
    }

    // T11: STUDENT JWT -> 403
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: tokStuA, body: { status: 'IN_PROGRESS' } });
        if (rr.status === 403) pass('T11: STUDENT JWT -> 403');
        else fail('T11', JSON.stringify(rr));
    }

    // T12: WARDEN JWT -> 403
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: tokBh3W, body: { status: 'IN_PROGRESS' } });
        if (rr.status === 403) pass('T12: WARDEN JWT -> 403');
        else fail('T12', JSON.stringify(rr));
    }

    // T13: missing JWT -> 401
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { body: { status: 'IN_PROGRESS' } });
        if (rr.status === 401) pass('T13: missing JWT -> 401');
        else fail('T13', JSON.stringify(rr));
    }

    // T14: invalid JWT -> 401
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: 'not.a.real.token', body: { status: 'IN_PROGRESS' } });
        if (rr.status === 401) pass('T14: invalid JWT -> 401');
        else fail('T14', JSON.stringify(rr));
    }

    // T15: PENDING -> IN_PROGRESS — reject. Use a brand-new complaint that's never been assigned.
    {
        const cidPending = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST T15 pending');
        const rr = await http('PATCH', `/api/worker/complaints/${cidPending}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const s = await dbStatus(cidPending);
        const h = await dbHistory(cidPending);
        // Only the create-row should exist.
        const ok = rr.status === 409 && s === 'PENDING' && h.length === 1 && h[0].new_status === 'PENDING';
        if (ok) pass('T15: PENDING -> IN_PROGRESS -> 409, status unchanged, no new history');
        else fail('T15', JSON.stringify({ rr, s, historyCount: h.length }));
    }

    // T16: PENDING -> RESOLVED — reject. Brand-new complaint.
    {
        const cidPending = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST T16 pending');
        const rr = await http('PATCH', `/api/worker/complaints/${cidPending}/status`, { token: tokW1, body: { status: 'RESOLVED' } });
        const s = await dbStatus(cidPending);
        const ok = rr.status === 409 && s === 'PENDING';
        if (ok) pass('T16: PENDING -> RESOLVED -> 409, status unchanged');
        else fail('T16', JSON.stringify({ rr, s }));
    }

    // T17: ASSIGNED -> RESOLVED (skipping IN_PROGRESS) — reject.
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec3}/status`, { token: tokW1, body: { status: 'RESOLVED' } });
        const s = await dbStatus(idElec3);
        const ok = rr.status === 409 && s === 'ASSIGNED';
        if (ok) pass('T17: ASSIGNED -> RESOLVED (skip IN_PROGRESS) -> 409');
        else fail('T17', JSON.stringify({ rr, s }));
    }

    // T18: RESOLVED -> IN_PROGRESS (already-resolved idElec1) — reject.
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec1}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const s = await dbStatus(idElec1);
        const ok = rr.status === 409 && s === 'RESOLVED';
        if (ok) pass('T18: RESOLVED -> IN_PROGRESS -> 409');
        else fail('T18', JSON.stringify({ rr, s }));
    }

    // T19: same-status requested — idElec2 is ASSIGNED; ask for ASSIGNED (but ASSIGNED isn't allowed at all — that's T21).
    // For same-status, push idElec2 to IN_PROGRESS then ask for IN_PROGRESS again.
    await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
    {
        const beforeH = await dbHistory(idElec2);
        const rr = await http('PATCH', `/api/worker/complaints/${idElec2}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const afterH = await dbHistory(idElec2);
        const s = await dbStatus(idElec2);
        const ok = rr.status === 409 && s === 'IN_PROGRESS' && afterH.length === beforeH.length;
        if (ok) pass('T19: same-status (IN_PROGRESS -> IN_PROGRESS) -> 409, no extra history');
        else fail('T19', JSON.stringify({ rr, s, beforeH: beforeH.length, afterH: afterH.length }));
    }

    // T20: unsupported status PENDING
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { status: 'PENDING' } });
        if (rr.status === 400) pass('T20: unsupported status PENDING -> 400');
        else fail('T20', JSON.stringify(rr));
    }

    // T21: unsupported status ASSIGNED
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { status: 'ASSIGNED' } });
        if (rr.status === 400) pass('T21: unsupported status ASSIGNED -> 400');
        else fail('T21', JSON.stringify(rr));
    }

    // T22: unsupported status CLOSED
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { status: 'CLOSED' } });
        if (rr.status === 400) pass('T22: unsupported status CLOSED -> 400');
        else fail('T22', JSON.stringify(rr));
    }

    // T23: invalid complaint IDs (abc / 0 / -1 / 1.5)
    {
        const cases = ['abc', '0', '-1', '1.5'];
        const all = [];
        let okAll = true;
        for (const cid of cases) {
            const rr = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
            all.push(`${cid}=${rr.status}`);
            if (rr.status !== 400) okAll = false;
        }
        if (okAll) pass('T23: invalid complaint id (abc/0/-1/1.5) -> 400', all.join(' '));
        else fail('T23', all.join(' '));
    }

    // T24: missing status
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { note: 'no status here' } });
        if (rr.status === 400) pass('T24: missing status -> 400');
        else fail('T24', JSON.stringify(rr));
    }

    // T25: whitespace / empty / non-string notes -> 400
    {
        const cases = [
            { status: 'IN_PROGRESS', note: '   ' },           // whitespace only
            { status: 'IN_PROGRESS', note: '' },              // empty
            { status: 'IN_PROGRESS', note: 12345 },           // non-string
            { status: 'IN_PROGRESS', note: { x: 1 } },        // object
            { status: 'IN_PROGRESS', note: ['a'] },           // array
        ];
        const all = [];
        let okAll = true;
        for (const body of cases) {
            const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body });
            all.push(`${JSON.stringify(body)}=${rr.status}`);
            if (rr.status !== 400) okAll = false;
        }
        if (okAll) pass('T25: whitespace/empty/non-string note -> 400', all.join(' '));
        else fail('T25', all.join(' '));
    }

    // T26: note longer than 1000 chars -> 400
    {
        const longNote = 'x'.repeat(1001);
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { status: 'IN_PROGRESS', note: longNote } });
        if (rr.status === 400) pass('T26: note > 1000 chars -> 400');
        else fail('T26', JSON.stringify(rr));
    }

    // T27: no note supplied -> 200, sensible default
    {
        const rr = await http('PATCH', `/api/worker/complaints/${idElec4}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        const s = await dbStatus(idElec4);
        const h = await dbHistory(idElec4);
        const last = h[h.length - 1];
        const ok = rr.status === 200 && s === 'IN_PROGRESS' && last && last.note === 'Complaint status updated';
        if (ok) pass('T27: no note -> 200 with default note', `note="${last?.note}"`);
        else fail('T27', JSON.stringify({ rr, s, last }));
    }

    // T28: attempt to send workerId in body belonging to another worker.
    // Server must ignore it and use req.user.userId (worker 1, BH-3).
    {
        // idElec5 is currently ASSIGNED to worker 1. Send workerId=9999 in body.
        // Worker 1's token must still drive the update; the bogus workerId is ignored.
        const beforeH = await dbHistory(idElec5);
        const rr = await http('PATCH', `/api/worker/complaints/${idElec5}/status`, {
            token: tokW1,
            body: { status: 'IN_PROGRESS', workerId: 9999, note: 'attempted override' },
        });
        const afterH = await dbHistory(idElec5);
        const s = await dbStatus(idElec5);
        // The acting worker is the JWT user (worker 1, user 11), not the bogus workerId.
        const last = afterH[afterH.length - 1];
        const ok = rr.status === 200 && s === 'IN_PROGRESS'
                && last && last.changed_by === 11 && last.note === 'attempted override'
                && afterH.length === beforeH.length + 1;
        if (ok) pass('T28: body.workerId ignored, server uses req.user.userId', `changed_by=${last.changed_by}`);
        else fail('T28', JSON.stringify({ rr, s, changed_by: last?.changed_by, historyDelta: afterH.length - beforeH.length }));
    }

    // T29: simulate history INSERT failure AFTER the complaint UPDATE.
    // Install a BEFORE INSERT trigger on complaint_history that fails for a
    // specific complaint_id. Expect 500 + ROLLBACK.
    {
        // Use a fresh PENDING->ASSIGNED complaint for this test.
        const cid = await createComplaint(tokStuA, 'Electrical', 'PHASE4E-TEST T29 trigger');
        await ensureAssigned(tokBh3W, cid, 1);
        const [beforeA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ? AND is_active = TRUE', [cid]);
        const beforeH = await dbHistory(cid);
        await conn.query(`
            CREATE TRIGGER trg_history_rollback_t29
            BEFORE INSERT ON complaint_history
            FOR EACH ROW
            BEGIN
                IF NEW.complaint_id = ? THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced rollback for T29';
                END IF;
            END
        `, [cid]);
        const rr = await http('PATCH', `/api/worker/complaints/${cid}/status`, { token: tokW1, body: { status: 'IN_PROGRESS' } });
        await conn.query('DROP TRIGGER IF EXISTS trg_history_rollback_t29');
        const [afterA] = await conn.query('SELECT COUNT(*) AS c FROM assignments WHERE complaint_id = ? AND is_active = TRUE', [cid]);
        const afterH = await dbHistory(cid);
        const afterS = await dbStatus(cid);
        const ok = rr.status >= 500
                && afterS === 'ASSIGNED'                       // status must NOT have moved
                && afterH.length === beforeH.length            // no new history
                && afterA[0].c === beforeA[0].c;               // assignment untouched
        if (ok) pass('T29: history INSERT failure -> 500 + ROLLBACK, status unchanged, no new history', `r=${rr.status}`);
        else fail('T29', JSON.stringify({ rr, afterS, historyDelta: afterH.length - beforeH.length, afterA: afterA[0].c, beforeA: beforeA[0].c }));
    }

    // T30: concurrent status updates — fire two near-simultaneous PATCH calls.
    // Both try ASSIGNED -> IN_PROGRESS. With FOR UPDATE row locking + status
    // WHERE clause, exactly ONE should win (200) and the other should see
    // IN_PROGRESS already and 409. The DB must end in IN_PROGRESS (not
    // RESOLVED, not stuck in some other state).
    {
        // Use idElec3 (currently ASSIGNED).
        const beforeH = await dbHistory(idElec3);
        const [a, b] = await Promise.all([
            http('PATCH', `/api/worker/complaints/${idElec3}/status`, { token: tokW1, body: { status: 'IN_PROGRESS', note: 'race-A' } }),
            http('PATCH', `/api/worker/complaints/${idElec3}/status`, { token: tokW1, body: { status: 'IN_PROGRESS', note: 'race-B' } }),
        ]);
        const afterH = await dbHistory(idElec3);
        const afterS = await dbStatus(idElec3);
        const statuses = [a.status, b.status].sort();
        const one200 = statuses.filter(s => s === 200).length === 1;
        const one409 = statuses.filter(s => s === 409).length === 1;
        const ok = one200 && one409 && afterS === 'IN_PROGRESS' && afterH.length === beforeH.length + 1;
        if (ok) pass('T30: concurrent updates — exactly one wins, other 409, status correct, one new history', `r1=${a.status} r2=${b.status} final=${afterS} historyDelta=${afterH.length - beforeH.length}`);
        else fail('T30', JSON.stringify({ a: a.status, b: b.status, afterS, historyDelta: afterH.length - beforeH.length }));
    }

    // T31: /api/health
    {
        const rr = await http('GET', '/api/health');
        if (rr.status === 200 && rr.json.success) pass('T31: /api/health works');
        else fail('T31', JSON.stringify(rr));
    }

    // T32: /api/health/db
    {
        const rr = await http('GET', '/api/health/db');
        if (rr.status === 200 && rr.json.success) pass('T32: /api/health/db works');
        else fail('T32', JSON.stringify(rr));
    }

    // =========================
    // CLEANUP
    // =========================
    await conn.query(`DELETE FROM assignments WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4E-TEST%')`);
    await conn.query(`DELETE FROM complaint_history WHERE complaint_id IN (SELECT complaint_id FROM complaints WHERE title LIKE 'PHASE4E-TEST%')`);
    await conn.query(`DELETE FROM complaints WHERE title LIKE 'PHASE4E-TEST%'`);
    await conn.query('UPDATE students SET is_activated = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL, is_active = FALSE WHERE user_id IN (1,2)');
    await conn.query('UPDATE users SET password_hash = NULL WHERE user_id IN (6,7,11,12,16)');

    // Verify cleanup
    const [c1] = await conn.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4E-TEST%'");
    const [a1] = await conn.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [h1] = await conn.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
    const [u]  = await conn.query("SELECT user_id, role, password_hash IS NULL AS hash_null, is_active FROM users WHERE user_id IN (1,2,6,7,11,12,16) ORDER BY user_id");
    console.log('\n=== CLEANUP VERIFICATION ===');
    console.log('Remaining PHASE4E complaints:', c1[0].c);
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
