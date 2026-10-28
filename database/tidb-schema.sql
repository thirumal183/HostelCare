-- =====================================================================
-- HOSTELCARE - Hostel Complaint Resolution System
-- Database Schema (TiDB Cloud / MySQL 8+)
-- ---------------------------------------------------------------------
-- This script creates the complete `hostelcare` tables, constraints,
-- foreign keys, and indexes required by the application design on an
-- existing `hostelcare` database (e.g. TiDB Cloud Serverless / Starter).
--
-- Execution order:
--   1. USE hostelcare
--   2. CREATE TABLES (in dependency order)
--   3. CREATE INDEXES (where not implicitly created)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Database setup
-- ---------------------------------------------------------------------
USE hostelcare;

-- Disable FK checks during bulk creation to avoid order issues
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. USERS
-- ---------------------------------------------------------------------
-- Central identity table for every person who can log into HostelCare.
-- Authentication info (password_hash) will be populated by Node.js/Express
-- using bcrypt. Until then, password_hash may be NULL.
-- =====================================================================
CREATE TABLE users (
    user_id         INT             NOT NULL AUTO_INCREMENT,
    email           VARCHAR(150)    NOT NULL,
    password_hash   VARCHAR(255)    NULL,
    role            VARCHAR(20)     NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_users_email (email),
    CONSTRAINT chk_users_role CHECK (role IN ('STUDENT','WARDEN','WORKER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. HOSTELS
-- ---------------------------------------------------------------------
-- Stores hostel buildings. Referenced by rooms, wardens, and workers.
-- =====================================================================
CREATE TABLE hostels (
    hostel_id       INT             NOT NULL AUTO_INCREMENT,
    hostel_name     VARCHAR(100)    NOT NULL,
    hostel_type     VARCHAR(10)     NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hostel_id),
    UNIQUE KEY uk_hostels_name (hostel_name),
    CONSTRAINT chk_hostels_type CHECK (hostel_type IN ('BOYS','GIRLS'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. ROOMS
-- ---------------------------------------------------------------------
-- Rooms belonging to hostels. The (hostel_id, room_number) pair is unique
-- so the same room number can exist in different hostels but cannot be
-- duplicated within the same hostel.
-- =====================================================================
CREATE TABLE rooms (
    room_id         INT             NOT NULL AUTO_INCREMENT,
    hostel_id       INT             NOT NULL,
    room_number     VARCHAR(20)     NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id),
    UNIQUE KEY uk_rooms_hostel_room (hostel_id, room_number),
    CONSTRAINT fk_rooms_hostel
        FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. STUDENTS
-- ---------------------------------------------------------------------
-- Student profile. Authentication info is in users (1:1 via user_id).
--
-- V1 Activation Design
-- ---------------------------------------------------------------------
-- The system-wide master activation key is NOT stored in the database.
-- It is read by the backend from the environment variable:
--     HOSTEL_ACTIVATION_KEY=HOSTELCARE2026
-- The backend validates this key during each student's first-time
-- activation. No per-student activation token column is required.
-- =====================================================================
CREATE TABLE students (
    student_id      INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    room_id         INT             NOT NULL,
    is_activated    BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id),
    UNIQUE KEY uk_students_user (user_id),
    KEY idx_students_room (room_id),
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_students_room
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. WARDENS
-- ---------------------------------------------------------------------
-- Warden profile. Authentication info is in users (1:1 via user_id).
-- A warden is assigned to one hostel.
-- =====================================================================
CREATE TABLE wardens (
    warden_id       INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    hostel_id         INT             NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (warden_id),
    UNIQUE KEY uk_wardens_user (user_id),
    KEY idx_wardens_hostel (hostel_id),
    CONSTRAINT fk_wardens_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_wardens_hostel
        FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. WORKERS
-- ---------------------------------------------------------------------
-- Maintenance worker profile. Authentication info is in users (1:1
-- via user_id). A worker belongs to one hostel so a warden cannot
-- assign a worker from an unrelated hostel.
-- =====================================================================
CREATE TABLE workers (
    worker_id       INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    hostel_id         INT             NOT NULL,
    phone           VARCHAR(20)     NULL,
    specialization  VARCHAR(50)     NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (worker_id),
    UNIQUE KEY uk_workers_user (user_id),
    KEY idx_workers_hostel (hostel_id),
    CONSTRAINT fk_workers_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_workers_hostel
        FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7. COMPLAINT_CATEGORIES
-- ---------------------------------------------------------------------
-- Predefined complaint categories. Complaints reference category_id
-- (no category names duplicated in the complaints table).
-- =====================================================================
CREATE TABLE complaint_categories (
    category_id     INT             NOT NULL AUTO_INCREMENT,
    category_name   VARCHAR(50)     NOT NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uk_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 8. COMPLAINTS
-- ---------------------------------------------------------------------
-- Central business table for student complaints.
-- Status transitions are enforced by the backend; the database only
-- validates that the value is one of the allowed enum values.
-- =====================================================================
CREATE TABLE complaints (
    complaint_id    INT             NOT NULL AUTO_INCREMENT,
    student_id      INT             NOT NULL,
    category_id     INT             NOT NULL,
    title           VARCHAR(150)    NOT NULL,
    priority        VARCHAR(20)     NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    description     TEXT            NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (complaint_id),
    KEY idx_complaints_student   (student_id),
    KEY idx_complaints_category  (category_id),
    KEY idx_complaints_status    (status),
    KEY idx_complaints_priority  (priority),
    CONSTRAINT fk_complaints_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_complaints_category
        FOREIGN KEY (category_id) REFERENCES complaint_categories(category_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_complaints_priority
        CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_complaints_status
        CHECK (status IN ('PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 9. ASSIGNMENTS
-- ---------------------------------------------------------------------
-- Connects a complaint to a worker, recording which warden assigned it.
-- A complaint may be reassigned; previous assignments are kept for
-- history. `is_active` flags the currently-active assignment.
-- =====================================================================
CREATE TABLE assignments (
    assignment_id   INT             NOT NULL AUTO_INCREMENT,
    complaint_id    INT             NOT NULL,
    worker_id       INT             NOT NULL,
    assigned_by     INT             NOT NULL,
    assigned_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    PRIMARY KEY (assignment_id),
    KEY idx_assignments_complaint (complaint_id),
    KEY idx_assignments_worker    (worker_id),
    CONSTRAINT fk_assignments_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_assignments_worker
        FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_assignments_warden
        FOREIGN KEY (assigned_by) REFERENCES wardens(warden_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 10. COMPLAINT_HISTORY
-- ---------------------------------------------------------------------
-- Audit trail of important complaint status changes.
-- `changed_by` references the user who performed the change
-- (student / warden / worker / etc.).
-- =====================================================================
CREATE TABLE complaint_history (
    history_id      INT             NOT NULL AUTO_INCREMENT,
    complaint_id    INT             NOT NULL,
    changed_by      INT             NOT NULL,
    old_status      VARCHAR(20)     NULL,
    new_status      VARCHAR(20)     NOT NULL,
    note            TEXT            NULL,
    changed_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (history_id),
    KEY idx_history_complaint (complaint_id),
    KEY idx_history_changed_by (changed_by),
    CONSTRAINT fk_history_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_history_user
        FOREIGN KEY (changed_by) REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_history_new_status
        CHECK (new_status IN ('PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
