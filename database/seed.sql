-- =====================================================================
-- HOSTELCARE - Seed Data
-- ---------------------------------------------------------------------
-- Inserts realistic development/test data for the HostelCare database.
--
-- IMPORTANT:
--   * Run AFTER `schema.sql`.
--   * password_hash is intentionally NULL here. Real bcrypt hashes will be
--     inserted by the Node.js/Express backend at signup.
--   * Insertion order respects all foreign-key dependencies.
--
-- Version 1 Activation Design
-- ---------------------------------------------------------------------
-- The system-wide master activation key is NOT stored in the database.
-- It is read by the backend from the environment variable:
--     HOSTEL_ACTIVATION_KEY=HOSTELCARE2026
-- The students table no longer carries an activation_key column; the
-- backend validates the master key against the env var at first-time
-- student activation.
-- =====================================================================

USE hostelcare;

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. HOSTELS  (5 total)
-- ---------------------------------------------------------------------
--   1. BH-3  -- Boys Hostel
--   2. BH-4  -- Boys Hostel
--   3. BH-5  -- Boys Hostel
--   4. GH-1  -- Girls Hostel
--   5. GH-2  -- Girls Hostel
-- =====================================================================
INSERT INTO hostels (hostel_id, hostel_name, hostel_type) VALUES
    (1, 'BH-3', 'BOYS'),
    (2, 'BH-4', 'BOYS'),
    (3, 'BH-5', 'BOYS'),
    (4, 'GH-1', 'GIRLS'),
    (5, 'GH-2', 'GIRLS');

-- =====================================================================
-- 2. ROOMS  (4 per hostel, 20 total)
-- ---------------------------------------------------------------------
-- (hostel_id, room_number) is UNIQUE -- same room number can exist in
-- different hostels but never twice inside the same hostel.
-- =====================================================================
INSERT INTO rooms (room_id, hostel_id, room_number) VALUES
    -- BH-3  (hostel_id = 1)
    (1,  1, 'A-101'),
    (2,  1, 'A-102'),
    (3,  1, 'A-103'),
    (4,  1, 'A-104'),
    -- BH-4  (hostel_id = 2)
    (5,  2, 'B-101'),
    (6,  2, 'B-102'),
    (7,  2, 'B-103'),
    (8,  2, 'B-104'),
    -- BH-5  (hostel_id = 3)
    (9,  3, 'C-101'),
    (10, 3, 'C-102'),
    (11, 3, 'C-103'),
    (12, 3, 'C-104'),
    -- GH-1  (hostel_id = 4)
    (13, 4, 'D-101'),
    (14, 4, 'D-102'),
    (15, 4, 'D-103'),
    (16, 4, 'D-104'),
    -- GH-2  (hostel_id = 5)
    (17, 5, 'E-101'),
    (18, 5, 'E-102'),
    (19, 5, 'E-103'),
    (20, 5, 'E-104');

-- =====================================================================
-- 3. COMPLAINT_CATEGORIES  (kept as-is, 7 total)
-- =====================================================================
INSERT INTO complaint_categories (category_id, category_name) VALUES
    (1, 'Electrical'),
    (2, 'Plumbing'),
    (3, 'Wi-Fi'),
    (4, 'Furniture'),
    (5, 'Cleaning'),
    (6, 'Water'),
    (7, 'Other');

-- =====================================================================
-- 4. USERS  (5 students + 5 wardens + 25 workers = 35 rows)
-- ---------------------------------------------------------------------
-- Email naming convention:
--   student.<hostel>.<surname>@hostelcare.test
--   warden.<hostel>@hostelcare.test
--   worker.<hostel>.<category>@hostelcare.test
-- All emails are unique by construction.
-- password_hash is NULL -- real hashes are produced by the backend.
-- is_active:
--   * STUDENT  -> FALSE  (account not yet activated)
--   * WARDEN   -> TRUE
--   * WORKER   -> TRUE
-- =====================================================================
INSERT INTO users (user_id, email, password_hash, role, is_active) VALUES
    -- ---------- STUDENTS (user_id 1..5) ----------
    (1,  'student.bh3.thiru@hostelcare.test',  NULL, 'STUDENT', FALSE),
    (2,  'student.bh4.aarav@hostelcare.test',  NULL, 'STUDENT', FALSE),
    (3,  'student.bh5.rohan@hostelcare.test',  NULL, 'STUDENT', FALSE),
    (4,  'student.gh1.ananya@hostelcare.test', NULL, 'STUDENT', FALSE),
    (5,  'student.gh2.kavya@hostelcare.test',  NULL, 'STUDENT', FALSE),

    -- ---------- WARDENS (user_id 6..10) ----------
    (6,  'warden.bh3@hostelcare.test', NULL, 'WARDEN', TRUE),
    (7,  'warden.bh4@hostelcare.test', NULL, 'WARDEN', TRUE),
    (8,  'warden.bh5@hostelcare.test', NULL, 'WARDEN', TRUE),
    (9,  'warden.gh1@hostelcare.test', NULL, 'WARDEN', TRUE),
    (10, 'warden.gh2@hostelcare.test', NULL, 'WARDEN', TRUE),

    -- ---------- WORKERS - BH-3 (user_id 11..15) ----------
    (11, 'worker.bh3.electrical@hostelcare.test', NULL, 'WORKER', TRUE),
    (12, 'worker.bh3.plumbing@hostelcare.test',  NULL, 'WORKER', TRUE),
    (13, 'worker.bh3.wifi@hostelcare.test',      NULL, 'WORKER', TRUE),
    (14, 'worker.bh3.furniture@hostelcare.test', NULL, 'WORKER', TRUE),
    (15, 'worker.bh3.cleaning@hostelcare.test',  NULL, 'WORKER', TRUE),

    -- ---------- WORKERS - BH-4 (user_id 16..20) ----------
    (16, 'worker.bh4.electrical@hostelcare.test', NULL, 'WORKER', TRUE),
    (17, 'worker.bh4.plumbing@hostelcare.test',  NULL, 'WORKER', TRUE),
    (18, 'worker.bh4.wifi@hostelcare.test',      NULL, 'WORKER', TRUE),
    (19, 'worker.bh4.furniture@hostelcare.test', NULL, 'WORKER', TRUE),
    (20, 'worker.bh4.cleaning@hostelcare.test',  NULL, 'WORKER', TRUE),

    -- ---------- WORKERS - BH-5 (user_id 21..25) ----------
    (21, 'worker.bh5.electrical@hostelcare.test', NULL, 'WORKER', TRUE),
    (22, 'worker.bh5.plumbing@hostelcare.test',  NULL, 'WORKER', TRUE),
    (23, 'worker.bh5.wifi@hostelcare.test',      NULL, 'WORKER', TRUE),
    (24, 'worker.bh5.furniture@hostelcare.test', NULL, 'WORKER', TRUE),
    (25, 'worker.bh5.cleaning@hostelcare.test',  NULL, 'WORKER', TRUE),

    -- ---------- WORKERS - GH-1 (user_id 26..30) ----------
    (26, 'worker.gh1.electrical@hostelcare.test', NULL, 'WORKER', TRUE),
    (27, 'worker.gh1.plumbing@hostelcare.test',  NULL, 'WORKER', TRUE),
    (28, 'worker.gh1.wifi@hostelcare.test',      NULL, 'WORKER', TRUE),
    (29, 'worker.gh1.furniture@hostelcare.test', NULL, 'WORKER', TRUE),
    (30, 'worker.gh1.cleaning@hostelcare.test',  NULL, 'WORKER', TRUE),

    -- ---------- WORKERS - GH-2 (user_id 31..35) ----------
    (31, 'worker.gh2.electrical@hostelcare.test', NULL, 'WORKER', TRUE),
    (32, 'worker.gh2.plumbing@hostelcare.test',  NULL, 'WORKER', TRUE),
    (33, 'worker.gh2.wifi@hostelcare.test',      NULL, 'WORKER', TRUE),
    (34, 'worker.gh2.furniture@hostelcare.test', NULL, 'WORKER', TRUE),
    (35, 'worker.gh2.cleaning@hostelcare.test',  NULL, 'WORKER', TRUE);

-- =====================================================================
-- 5. STUDENTS  (5 demo students, 1 per hostel, all NOT activated)
-- ---------------------------------------------------------------------
-- One demo student per hostel, each placed in the *first* room of that
-- hostel. is_activated = FALSE; the backend will set it to TRUE only
-- after the student submits the master activation key from .env.
-- =====================================================================
INSERT INTO students (student_id, user_id, name, room_id, is_activated) VALUES
    (1, 1, 'Thiru',        1,  FALSE),  -- BH-3  room A-101
    (2, 2, 'Aarav Sharma', 5,  FALSE),  -- BH-4  room B-101
    (3, 3, 'Rohan Verma',  9,  FALSE),  -- BH-5  room C-101
    (4, 4, 'Ananya Iyer',  13, FALSE),  -- GH-1  room D-101
    (5, 5, 'Kavya Reddy',  17, FALSE);  -- GH-2  room E-101

-- =====================================================================
-- 6. WARDENS  (5 total, 1 per hostel)
-- =====================================================================
INSERT INTO wardens (warden_id, user_id, name, hostel_id) VALUES
    (1, 6,  'Rajesh Kumar',  1),  -- BH-3
    (2, 7,  'Suresh Babu',   2),  -- BH-4
    (3, 8,  'Mahesh Iyer',   3),  -- BH-5
    (4, 9,  'Lakshmi Devi',  4),  -- GH-1
    (5, 10, 'Priya Sharma',  5);  -- GH-2

-- =====================================================================
-- 7. WORKERS  (25 total, 5 per hostel, one per category)
-- ---------------------------------------------------------------------
-- Per-hostel ordering: Electrical, Plumbing, Wi-Fi, Furniture, Cleaning.
-- Each worker belongs to exactly one hostel and one specialization.
-- =====================================================================
INSERT INTO workers (worker_id, user_id, name, hostel_id, phone, specialization) VALUES
    -- ---------- BH-3 (hostel_id = 1) ----------
    (1,  11, 'Ravi Kumar',     1, '9000000001', 'Electrical'),
    (2,  12, 'Mohan Lal',      1, '9000000002', 'Plumbing'),
    (3,  13, 'Sanjay Patel',   1, '9000000003', 'Wi-Fi'),
    (4,  14, 'Dinesh Yadav',   1, '9000000004', 'Furniture'),
    (5,  15, 'Gopal Singh',    1, '9000000005', 'Cleaning'),

    -- ---------- BH-4 (hostel_id = 2) ----------
    (6,  16, 'Vinod Kumar',    2, '9000000006', 'Electrical'),
    (7,  17, 'Prakash Joshi',  2, '9000000007', 'Plumbing'),
    (8,  18, 'Arjun Nair',     2, '9000000008', 'Wi-Fi'),
    (9,  19, 'Karthik Rao',    2, '9000000009', 'Furniture'),
    (10, 20, 'Santosh Mishra', 2, '9000000010', 'Cleaning'),

    -- ---------- BH-5 (hostel_id = 3) ----------
    (11, 21, 'Naveen Sharma',  3, '9000000011', 'Electrical'),
    (12, 22, 'Ramesh Chand',   3, '9000000012', 'Plumbing'),
    (13, 23, 'Vivek Saxena',   3, '9000000013', 'Wi-Fi'),
    (14, 24, 'Manoj Gupta',    3, '9000000014', 'Furniture'),
    (15, 25, 'Suresh Yadav',   3, '9000000015', 'Cleaning'),

    -- ---------- GH-1 (hostel_id = 4) ----------
    (16, 26, 'Arun Kumar',     4, '9000000016', 'Electrical'),
    (17, 27, 'Bharat Singh',   4, '9000000017', 'Plumbing'),
    (18, 28, 'Ravi Shankar',   4, '9000000018', 'Wi-Fi'),
    (19, 29, 'Hari Prasad',    4, '9000000019', 'Furniture'),
    (20, 30, 'Lakshman Swamy', 4, '9000000020', 'Cleaning'),

    -- ---------- GH-2 (hostel_id = 5) ----------
    (21, 31, 'Anand Rao',      5, '9000000021', 'Electrical'),
    (22, 32, 'Kiran Joshi',    5, '9000000022', 'Plumbing'),
    (23, 33, 'Deepak Menon',   5, '9000000023', 'Wi-Fi'),
    (24, 34, 'Sunil Bhat',     5, '9000000024', 'Furniture'),
    (25, 35, 'Prakash Reddy',  5, '9000000025', 'Cleaning');

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- VERIFICATION QUERIES (read-only, comment out for one-off checks)
-- ---------------------------------------------------------------------
-- Expected totals:
--   hostels   = 5
--   rooms     = 20
--   users     = 35   (5 students + 5 wardens + 25 workers)
--   students  = 5
--   wardens   = 5
--   workers   = 25
--
-- SELECT 'hostels'   AS table_name, COUNT(*) AS rows FROM hostels
-- UNION ALL SELECT 'rooms',   COUNT(*) FROM rooms
-- UNION ALL SELECT 'users',   COUNT(*) FROM users
-- UNION ALL SELECT 'students',COUNT(*) FROM students
-- UNION ALL SELECT 'wardens', COUNT(*) FROM wardens
-- UNION ALL SELECT 'workers', COUNT(*) FROM workers;
-- =====================================================================

-- =====================================================================
-- END OF SEED DATA
-- =====================================================================
