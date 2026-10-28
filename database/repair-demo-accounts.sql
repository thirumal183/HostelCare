-- =====================================================================
-- HOSTELCARE — Repair Demo Accounts & Passwords (Idempotent)
-- =====================================================================
-- This script safely updates password hashes for pre-seeded demo accounts
-- in an existing HostelCare database (e.g. TiDB Cloud).
--
-- Non-destructive:
--   * Does NOT drop or recreate any tables
--   * Does NOT truncate or delete user data
--   * Does NOT alter existing complaints or assignment history
--
-- Accounts configured:
--   * All Wardens (user_id 6..10):       Warden@123
--   * All Workers (user_id 11..35):      Worker@123
--   * Demo Student (user_id 1):          Student@123  (is_activated = TRUE)
--   * Other Students (user_id 2..5):     Kept unactivated for testing activation
-- =====================================================================

USE hostelcare;

-- 1. Wardens -> 'Warden@123'
UPDATE users
SET password_hash = '$2b$10$wf10MtAjMlmzNPGEpYijI.eWkeA45TDEyKef6Ol5vFruBeuVd62Cm',
    is_active = TRUE
WHERE role = 'WARDEN';

-- 2. Workers -> 'Worker@123'
UPDATE users
SET password_hash = '$2b$10$y4kSbHOViA1o7fskYSEo0.BoEfMSbiRSs/yt4G0pP.wSLNq9rSlVO',
    is_active = TRUE
WHERE role = 'WORKER';

-- 3. Demo Resident Student (student.bh3.thiru@hostelcare.test) -> 'Student@123'
UPDATE users
SET password_hash = '$2b$10$C8v3vsTLd6qcGUehXWLbw.oHQHNKPSEvngF43he3wPbTnAGqDRq4i',
    is_active = TRUE
WHERE email = 'student.bh3.thiru@hostelcare.test';

UPDATE students
SET is_activated = TRUE
WHERE user_id = (SELECT user_id FROM users WHERE email = 'student.bh3.thiru@hostelcare.test');

-- Verification
SELECT user_id, email, role, is_active, (password_hash IS NOT NULL) AS has_password
FROM users
WHERE user_id IN (1, 2, 6, 11)
ORDER BY user_id;
