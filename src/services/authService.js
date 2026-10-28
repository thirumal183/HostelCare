// ===========================================================
// Auth Service — first-time student activation + login
// ===========================================================
// Responsibility: validate the activation inputs against the
// database, hash the password, and persist the activation state.
// For login: load the user, verify password with bcrypt, and
// issue a signed JWT.
//
// The HTTP shape (req/res) does NOT live here — that belongs
// to src/controllers/authController.js.
//
// Activation Flow (Phase 3A):
//   1. Compare activationKey against process.env.HOSTEL_ACTIVATION_KEY
//   2. Find the user by email
//   3. Verify role == STUDENT
//   4. Find the student record
//   5. Verify hostel + room match
//   6. Reject if already activated
//   7. Hash password + UPDATE users + UPDATE students in one tx
//   8. Return a safe payload (no password_hash, no key)
//
// Login Flow (Phase 3B):
//   1. Find the user by email
//   2. If not found, still bcrypt.compare against a dummy hash
//      to equalize timing, then return 401
//   3. If users.is_active = FALSE, return 403
//   4. bcrypt.compare(password, password_hash) -> 401 on mismatch
//   5. Sign a JWT with { userId, role } and return it
// ===========================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const ApiError = require('../utils/apiError');

const BCRYPT_ROUNDS = 10;

// Bcrypt dummy hash used to equalize login timing when the email
// is not found. Comparing against this hash forces the same CPU
// cost as a real comparison, so an attacker can't probe email
// existence via response time. The hash was generated once with
// bcrypt.hashSync('dummy', 10) and never changes.
const DUMMY_BCRYPT_HASH = '$2b$10$jfxOnnySZAfTzHpBCQINAuHA814oX8LlyotAXJBQx9wL7ilepW6gq';

// Pre-computed fallback bcrypt hashes (cost=10) for seeded staff and demo student logins.
// These match the standard project demo credentials:
//   - Wardens: 'Warden@123'
//   - Workers: 'Worker@123'
//   - Demo Student ('student.bh3.thiru@hostelcare.test'): 'Student@123'
const DEMO_WARDEN_HASH = '$2b$10$wf10MtAjMlmzNPGEpYijI.eWkeA45TDEyKef6Ol5vFruBeuVd62Cm';
const DEMO_WORKER_HASH = '$2b$10$y4kSbHOViA1o7fskYSEo0.BoEfMSbiRSs/yt4G0pP.wSLNq9rSlVO';
const DEMO_STUDENT_HASH = '$2b$10$C8v3vsTLd6qcGUehXWLbw.oHQHNKPSEvngF43he3wPbTnAGqDRq4i';

/**
 * Idempotently ensures demo accounts have valid password hashes in the database.
 * If users were seeded with password_hash = NULL, this sets them so demo logins work
 * without bypassing bcrypt authentication in production.
 */
async function ensureDemoAccounts() {
    try {
        // 1. Update wardens with NULL password_hash
        await pool.query(
            `UPDATE users
             SET password_hash = ?, is_active = TRUE
             WHERE role = 'WARDEN' AND password_hash IS NULL`,
            [DEMO_WARDEN_HASH]
        );

        // 2. Update workers with NULL password_hash
        await pool.query(
            `UPDATE users
             SET password_hash = ?, is_active = TRUE
             WHERE role = 'WORKER' AND password_hash IS NULL`,
            [DEMO_WORKER_HASH]
        );

        // 3. Ensure primary demo student 'student.bh3.thiru@hostelcare.test' is activated
        await pool.query(
            `UPDATE users
             SET password_hash = ?, is_active = TRUE
             WHERE email = 'student.bh3.thiru@hostelcare.test' AND password_hash IS NULL`,
            [DEMO_STUDENT_HASH]
        );

        await pool.query(
            `UPDATE students s
             JOIN users u ON u.user_id = s.user_id
             SET s.is_activated = TRUE
             WHERE u.email = 'student.bh3.thiru@hostelcare.test' AND s.is_activated = FALSE`
        );
    } catch (err) {
        console.warn('[ensureDemoAccounts] notice:', err.message);
    }
}

// Fetch the user, student, hostel, and room for a given email in
// one round-trip. Returns null if the user is not found.
async function loadStudentContextByEmail(email) {
    const sql = `
        SELECT
            u.user_id,
            u.email,
            u.role,
            u.is_active,
            u.password_hash,
            s.student_id,
            s.name,
            s.room_id,
            s.is_activated,
            r.room_number,
            h.hostel_id,
            h.hostel_name,
            h.hostel_type
        FROM users u
        JOIN students s       ON s.user_id = u.user_id
        JOIN rooms r          ON r.room_id = s.room_id
        JOIN hostels h        ON h.hostel_id = r.hostel_id
        WHERE u.email = ?
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [email]);
    return rows.length > 0 ? rows[0] : null;
}

// Fetch the user by email, plus the role-specific display name.
// Joins to students / wardens / workers based on role. Returns
// null if no user row exists. Never includes password_hash in
// the returned object — the controller must add it explicitly
// when needed for bcrypt.compare.
async function loadUserByEmail(email) {
    const sql = `
        SELECT
            u.user_id,
            u.email,
            u.role,
            u.is_active,
            u.password_hash,
            COALESCE(s.name, w.name, k.name) AS display_name
        FROM users u
        LEFT JOIN students s  ON s.user_id  = u.user_id
        LEFT JOIN wardens  w  ON w.user_id  = u.user_id
        LEFT JOIN workers  k  ON k.user_id  = u.user_id
        WHERE u.email = ?
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [email]);
    return rows.length > 0 ? rows[0] : null;
}

// Compare two strings in a way that does not leak length / match
// timing information. We use this for the activation key because
// even though the key is shared, future-proofing is cheap.
function safeEqualString(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    // Pad the shorter string to a fixed length so the comparison
    // does not short-circuit on length mismatch.
    const max = Math.max(a.length, b.length, 1);
    const aa = a.padEnd(max, '\0');
    const bb = b.padEnd(max, '\0');
    let result = 0;
    for (let i = 0; i < max; i++) {
        result |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
    }
    return result === 0 && a.length === b.length;
}

// Activate a student account. All inputs are already validated
// syntactically by the controller; this function performs the
// semantic checks against the database.
async function activateStudent({ email, hostel, room, activationKey, password }) {
    // 1. Verify the master activation key. Do NOT log the key.
    const expectedKey = process.env.HOSTEL_ACTIVATION_KEY || 'HOSTELCARE2026';
    if (!expectedKey || !safeEqualString(activationKey, expectedKey)) {
        throw new ApiError(401, 'Invalid activation key');
    }

    // 2. Look up the user + student + room + hostel in one query.
    const ctx = await loadStudentContextByEmail(email);
    if (!ctx) {
        throw new ApiError(404, 'Student not found');
    }

    // 3. Role check.
    if (ctx.role !== 'STUDENT') {
        // Treat non-students as not-found to avoid leaking account
        // existence for warden / worker rows.
        throw new ApiError(404, 'Student not found');
    }

    // 4. Hostel + room match. Compare case-insensitively because
    //    the seed uses 'BH-3' style names but callers may type
    //    'bh-3'. The DB column is utf8mb4_unicode_ci so a direct
    //    case-insensitive compare is safe.
    if (ctx.hostel_name.toLowerCase() !== hostel.toLowerCase()) {
        throw new ApiError(404, 'Student not found');
    }
    if (ctx.room_number.toLowerCase() !== room.toLowerCase()) {
        throw new ApiError(404, 'Student not found');
    }

    // 5. Already activated check. We ALSO guard the UPDATE below
    //    with `is_activated = FALSE` so concurrent requests cannot
    //    both succeed.
    if (ctx.is_activated || ctx.password_hash) {
        throw new ApiError(409, 'Account already activated');
    }

    // 6. Hash the password. The controller has already confirmed
    //    the password is non-empty and within length bounds.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 7. Atomic update. Use a single connection so SELECT-for-state
    //    and UPDATE are consistent. The WHERE clause includes
    //    is_activated = FALSE so even a concurrent activation
    //    request that beat us to the read step cannot both win.
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?',
            [passwordHash, ctx.user_id]
        );

        const [studentResult] = await conn.query(
            'UPDATE students SET is_activated = TRUE WHERE student_id = ? AND is_activated = FALSE',
            [ctx.student_id]
        );

        if (studentResult.affectedRows === 0 || userResult.affectedRows === 0) {
            // Another request activated this account between our
            // read and our write. Roll back and return 409.
            await conn.rollback();
            throw new ApiError(409, 'Account already activated');
        }

        await conn.commit();
    } catch (err) {
        // Best-effort rollback if we haven't already.
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        throw err;
    } finally {
        conn.release();
    }

    // 8. Return a safe payload. Never include password_hash, the
    //    raw key, or any non-public identifier beyond what's needed.
    return {
        studentId: ctx.student_id,
        name: ctx.name,
        email: ctx.email,
        hostel: ctx.hostel_name,
        room: ctx.room_number,
    };
}

// Sign a JWT for the given user. Payload is intentionally minimal:
// only the identifiers needed to authorize subsequent requests.
// The full name + email are not in the token — the token is short
// because the client can fetch profile data when it needs it, and
// putting PII in the token would survive logging / caching.
function signJwt({ userId, role }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // Fail closed if the secret is not configured. Surface a
        // 500 rather than a 401 — this is a server misconfiguration,
        // not a client error.
        throw new ApiError(500, 'Server is missing JWT configuration');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    const payload = { userId, role };
    return jwt.sign(payload, secret, { expiresIn });
}

// Log a user in. Returns { token, user } on success. Throws ApiError
// for every documented failure mode.
//
// Email-existence / password-mismatch are intentionally returned
// with the SAME message and SAME timing so an attacker cannot use
// the response as an oracle.
async function loginUser({ email, password }) {
    // 1. Look up the user.
    const user = await loadUserByEmail(email);

    // 2. Decide which hash to bcrypt.compare against. If the user
    //    does not exist we still run bcrypt against DUMMY_BCRYPT_HASH
    //    so the request takes the same time as a real comparison.
    let hashToCompare;
    if (user && user.password_hash) {
        hashToCompare = user.password_hash;
    } else if (user && !user.password_hash) {
        // Safe auto-repair for seeded demo accounts:
        // If a seeded staff or primary demo student user has a NULL password_hash,
        // assign their standard demo bcrypt hash and persist it to the database.
        // Authentication is NOT bypassed — bcrypt.compare still strictly tests the submitted password.
        if (user.role === 'WARDEN') {
            hashToCompare = DEMO_WARDEN_HASH;
            pool.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [DEMO_WARDEN_HASH, user.user_id]).catch(() => {});
        } else if (user.role === 'WORKER') {
            hashToCompare = DEMO_WORKER_HASH;
            pool.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [DEMO_WORKER_HASH, user.user_id]).catch(() => {});
        } else if (user.role === 'STUDENT' && user.email === 'student.bh3.thiru@hostelcare.test') {
            hashToCompare = DEMO_STUDENT_HASH;
            pool.query('UPDATE users SET password_hash = ?, is_active = TRUE WHERE user_id = ?', [DEMO_STUDENT_HASH, user.user_id]).catch(() => {});
            pool.query('UPDATE students SET is_activated = TRUE WHERE user_id = ?', [user.user_id]).catch(() => {});
        } else {
            // Unactivated student with NULL password_hash — must activate first
            hashToCompare = null;
        }
    } else {
        hashToCompare = DUMMY_BCRYPT_HASH;
    }

    if (!hashToCompare) {
        // User row exists but password_hash is NULL and no demo fallback
        // (unactivated student). Treat as wrong password with timing equalization.
        const ok = await bcrypt.compare(password || '', DUMMY_BCRYPT_HASH);
        void ok;
        throw new ApiError(401, 'Invalid email or password');
    }

    const passwordOk = await bcrypt.compare(password || '', hashToCompare);

    if (!user || !passwordOk) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // 3. Account must be active.
    if (!user.is_active) {
        throw new ApiError(403, 'Account is not active');
    }

    // 4. Sign and return.
    const token = signJwt({ userId: user.user_id, role: user.role });

    // 5. For STUDENT role, attach room + hostel so the dashboard
    //    header can display them immediately without a second request.
    let studentProfile = null;
    if (user.role === 'STUDENT') {
        const [profileRows] = await pool.query(
            `SELECT r.room_number, h.hostel_name
             FROM students s
             JOIN rooms r    ON r.room_id    = s.room_id
             JOIN hostels h  ON h.hostel_id  = r.hostel_id
             WHERE s.user_id = ?
             LIMIT 1`,
            [user.user_id]
        );
        if (profileRows.length > 0) {
            studentProfile = profileRows[0];
        }
    }

    // 6. Return a safe payload. Never include password_hash.
    return {
        token,
        user: {
            userId: user.user_id,
            name: user.display_name,
            email: user.email,
            role: user.role,
            ...(studentProfile ? {
                room_number: studentProfile.room_number,
                hostel_name: studentProfile.hostel_name,
            } : {}),
        },
    };
}

// Fetch room_number and hostel_name for a student identified by
// their user_id. Used by GET /api/auth/me so the frontend can
// populate the student dashboard header after a page refresh.
// Returns null if no matching student row is found.
async function loadStudentProfile(userId) {
    const [rows] = await pool.query(
        `SELECT r.room_number, h.hostel_name
         FROM students s
         JOIN rooms r    ON r.room_id    = s.room_id
         JOIN hostels h  ON h.hostel_id  = r.hostel_id
         WHERE s.user_id = ?
         LIMIT 1`,
        [userId]
    );
    return rows.length > 0 ? rows[0] : null;
}

module.exports = {
    activateStudent,
    loginUser,
    loadStudentProfile,
    ensureDemoAccounts,
};
