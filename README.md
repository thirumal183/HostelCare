# HostelCare — Hostel Complaint & Maintenance Management System

HostelCare is a full-stack, enterprise-grade hostel maintenance and incident management platform built with **Node.js, Express, MySQL, React, and TypeScript**. It automates the full complaint lifecycle across students, hostel wardens, and maintenance workers with strict role-based access control, hostel-level data isolation, transactional status transitions, and immutable audit logging.

---

## Table of Contents

- [Problem Statement & Objectives](#problem-statement--objectives)
- [Key Role Capabilities](#key-role-capabilities)
- [Backend Architecture & Request Flow](#backend-architecture--request-flow)
- [Technology Stack](#technology-stack)
- [Database Architecture & Schema Design](#database-architecture--schema-design)
- [RESTful API Specification](#restful-api-specification)
- [Authentication, Authorization & Data Security](#authentication-authorization--data-security)
- [Complaint Lifecycle State Machine](#complaint-lifecycle-state-machine)
- [Repository Structure](#repository-structure)
- [Local Development Setup](#local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Database Initialization & Seeding](#database-initialization--seeding)
  - [Starting Backend & Frontend](#starting-backend--frontend)
- [Testing & Quality Verification](#testing--quality-verification)
- [API Request/Response Examples](#api-requestresponse-examples)
- [Security Considerations & Best Practices](#security-considerations--best-practices)

---

## Problem Statement & Objectives

Managing hostel facility issues across multi-block residential campuses often suffers from paper trails, unrecorded worker dispatches, lack of hostel segregation, and inability for students to verify fixes before closure.

**HostelCare solves this with:**
- **Strict Role Boundaries**: Enforces differentiated privileges for students, hostel wardens, and maintenance workers.
- **Hostel Isolation**: Wardens and workers are scoped strictly to their assigned hostel. No cross-hostel visibility or modification is permitted.
- **Transactional State Machine**: Prevents invalid status jumps, race conditions, and dangling assignments using ACID SQL transactions and row-level locks (`SELECT ... FOR UPDATE`).
- **Complete Audit Trail**: Every status transition records timestamp, responsible user, previous status, next status, and remarks in an immutable audit table.

---

## Key Role Capabilities

| Role | Core Capabilities |
|---|---|
| **Student** | • First-time room account activation with campus key verification.<br>• Submit maintenance requests tagged by category, title, description, and auto-resolved room/hostel.<br>• Track real-time progress and technician assignment.<br>• Confirm fix and close resolved complaints.<br>• Reopen unresolved issues with documented reasons. |
| **Warden** | • Hostel-isolated dashboard viewing all complaints filed within their hostel.<br>• Triage and elevate urgency levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).<br>• Assign pending tickets to qualified technicians matching hostel and specialization.<br>• Access complaint history and download filtered CSV audit reports.<br>• View estate escalation contacts for emergency maintenance. |
| **Maintenance Worker** | • View assigned ticket queue matching their hostel and specialization.<br>• Look up assigned complaints by ID.<br>• Transition assigned complaints through `IN_PROGRESS` and `RESOLVED`.<br>• Log technical work remarks and resolution notes. |

---

## Backend Architecture & Request Flow

The backend follows an MVC-inspired layered design pattern prioritizing defense-in-depth and zero trust on client-submitted identity parameters:

```
[ HTTP Client (Vite / React) ]
              │
              ▼
   [ Express Middleware ]
     • cors() & express.json()
     • authenticate (JWT verification -> req.user { userId, role })
     • authorize(roles...) (Role validation gate)
              │
              ▼
    [ Route Layer (/routes) ]
     • Declarative HTTP verb & path definitions
              │
              ▼
 [ Controller Layer (/controllers) ]
     • Request parameter syntactic validation & type coercion
     • Extracts userId exclusively from verified JWT (req.user.userId)
     • Error boundary delegation to centralized errorHandler
              │
              ▼
   [ Service Layer (/services) ]
     • Semantic & business logic validation
     • Role-to-profile resolution (students, wardens, workers)
     • Database connection pooling & transaction boundaries (BEGIN ... COMMIT/ROLLBACK)
     • Row-level concurrency locking (FOR UPDATE)
              │
              ▼
    [ MySQL Database ]
     • InnoDB relational engine with foreign key constraints
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express 4.x
- **Database Engine**: MySQL 8.x (InnoDB with utf8mb4 encoding)
- **Database Driver**: `mysql2/promise` (connection pooling & parameterized queries)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcrypt` (10 rounds password hashing)
- **Configuration**: `dotenv`

### Frontend
- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite
- **UI Styling**: Tailwind CSS (light blue and slate enterprise aesthetic)
- **Icons & Animation**: Lucide React & Motion

---

## Database Architecture & Schema Design

All tables are defined in [`database/schema.sql`](database/schema.sql) using the InnoDB storage engine with cascading rules and indexing for optimal query performance:

```
                     ┌───────────────┐
                     │    HOSTELS    │
                     └───────┬───────┘
                             │ 1:N
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌─────────────┐               ┌─────────────┐
       │    ROOMS    │               │   WARDENS   │
       └──────┬──────┘               └──────┬──────┘
              │ 1:N                         │
              ▼                             │
       ┌─────────────┐                      │
       │  STUDENTS   │                      │
       └──────┬──────┘                      │
              │ 1:N                         │
              ▼                             │
       ┌─────────────┐                      │
       │ COMPLAINTS  │◄─────────────────────┤
       └──────┬──────┘                      │
              │ 1:N                         ▼
              ├──────────────────────►┌─────────────┐
              │                       │ ASSIGNMENTS │
              ▼                       └──────┬──────┘
       ┌────────────────────┐                │ N:1
       │ COMPLAINT_HISTORY  │                ▼
       └────────────────────┘         ┌─────────────┐
                                      │   WORKERS   │
                                      └─────────────┘
```

### Relational Entities:
1. **`users`**: Central auth entity storing `email`, `password_hash`, `role` (`STUDENT`, `WARDEN`, `WORKER`), and `is_active`.
2. **`hostels`**: Hostel definitions (e.g., `BH-3`, `GH-1`) and types (`BOYS`, `GIRLS`).
3. **`rooms`**: Specific room allocations linked to a `hostel_id`.
4. **`students`**: Student profiles referencing `user_id`, `room_id`, name, and activation status (`is_activated`).
5. **`wardens`**: Warden assignments binding a `user_id` to a single `hostel_id`.
6. **`workers`**: Maintenance technician profiles binding `user_id`, assigned `hostel_id`, and `specialization` (`Electrical`, `Plumbing`, `Wi-Fi`, `Furniture`, `Cleaning`).
7. **`complaint_categories`**: Maintenance category classifications.
8. **`complaints`**: Core ticket storing `student_id`, `category_id`, `title`, `description`, `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and `status` (`PENDING`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
9. **`assignments`**: Junction record mapping `complaint_id` to `worker_id` and assigning `warden_id`, with `is_active BOOLEAN DEFAULT TRUE`.
10. **`complaint_history`**: Immutable audit log capturing `complaint_id`, `changed_by` (`user_id`), `old_status`, `new_status`, `note`, and `changed_at`.

---

## RESTful API Specification

### 1. Health & Diagnostics
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Basic service liveness check |
| `GET` | `/api/health/db` | Public | Live database ping and connection verification |

### 2. Authentication (`/api/auth`)
| Method | Endpoint | Access | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/activate` | Public | `{ email, hostel, room, activationKey, password }` | First-time student room activation |
| `POST` | `/api/auth/login` | Public | `{ email, password }` | Authenticates user; returns JWT token & user profile |
| `GET` | `/api/auth/me` | Authenticated | *None* (Bearer JWT) | Returns session claims enriched with student room/hostel |

### 3. Student Operations (`/api/complaints` & `/api/student/complaints`)
| Method | Endpoint | Access | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/api/complaints` | Student | `{ category, title, description }` | Files a complaint under authenticated student's room |
| `GET` | `/api/complaints` | Student | *None* | Lists complaints filed by authenticated student |
| `GET` | `/api/complaints/:id` | Student | *None* | Detail view and timeline history of student complaint |
| `PATCH` | `/api/student/complaints/:id/close` | Student | `{ note? }` | Transitions complaint from `RESOLVED` → `CLOSED` |
| `PATCH` | `/api/student/complaints/:id/reopen` | Student | `{ note }` | Transitions complaint from `CLOSED` → `PENDING` (deactivates assignment) |

### 4. Warden Operations (`/api/warden/complaints`)
| Method | Endpoint | Access | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/api/warden/complaints` | Warden | *None* | Lists complaints in warden's hostel (with assigned worker) |
| `GET` | `/api/warden/complaints/:id` | Warden | *None* | Fetches detail & full timeline for complaint in warden's hostel |
| `PATCH` | `/api/warden/complaints/:id/priority` | Warden | `{ priority }` | Updates priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| `POST` | `/api/warden/complaints/:id/assign` | Warden | `{ workerId }` | Assigns `PENDING` complaint to same-hostel matching worker |

### 5. Maintenance Worker Operations (`/api/worker/complaints`)
| Method | Endpoint | Access | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/api/worker/complaints` | Worker | *None* | Lists active complaints assigned to authenticated worker |
| `PATCH` | `/api/worker/complaints/:id/status` | Worker | `{ status, note? }` | Transitions status: `ASSIGNED` → `IN_PROGRESS` or `IN_PROGRESS` → `RESOLVED` |

---

## Authentication, Authorization & Data Security

1. **Identity Integrity**:
   - Client requests never submit `student_id`, `warden_id`, or `hostel_id` in request bodies.
   - All identities are extracted on the server from cryptographically signed JWT tokens verified in `src/middleware/authMiddleware.js`.
2. **Timing Attack Protection**:
   - In `src/services/authService.js`, unknown login emails trigger an execution of `bcrypt.compare` against a pre-computed dummy hash to maintain identical response times and prevent username enumeration.
3. **Hostel Boundary Enforcement**:
   - Wardens can only select, assign, or view complaints joined via `rooms.hostel_id = warden.hostel_id`.
   - Technicians can only access and update tickets where an active assignment matches `assignments.worker_id = worker.worker_id`.
4. **Input Sanitization & Boundary Checking**:
   - Strict edge validation using regex for integers, trimmed string lengths (Title <= 150 chars, Description <= 2000 chars, Notes <= 1000 chars).

---

## Complaint Lifecycle State Machine

```
               [ Student Files Ticket ]
                          │
                          ▼
                     ( PENDING ) ◄──────────────────────┐
                          │                             │
        [ Warden Assigns Worker (Phase 4D) ]            │
                          │                             │
                          ▼                             │
                     ( ASSIGNED )                       │
                          │                             │
        [ Worker Marks In Progress (Phase 4E) ]         │
                          │                             │
                          ▼                             │
                   ( IN_PROGRESS )                      │
                          │                             │
        [ Worker Records Fix / Resolves (Phase 4E) ]    │
                          │                             │
                          ▼                             │
                    ( RESOLVED )                        │
                          │                             │
        [ Student Confirms Fix (Phase 4F) ]             │
                          │                             │
                          ▼                             │
                     ( CLOSED ) ────────────────────────┘
                                 [ Student Reopens (Phase 4F) ]
```

- **Reopen Policy**: Reopening a `CLOSED` complaint atomically sets status to `PENDING` and executes `UPDATE assignments SET is_active = FALSE WHERE complaint_id = ?`, ensuring previous workers cannot manipulate tickets before re-triage.

---

## Repository Structure

```
HostelCare Project/
├── .env.example                     # Backend environment variable template
├── .gitignore                       # Root ignore rules (excludes .env, node_modules)
├── package.json                     # Root / backend dependencies and scripts
├── server.js                        # HTTP listener entrypoint
├── database/
│   ├── schema.sql                   # Complete relational database DDL
│   └── seed.sql                     # Seed data (hostels, rooms, accounts, workers)
├── docs/                            # Internal guides & phase audits
├── scripts/                         # Lifecycle verification and migration utilities
├── src/                             # Backend application source code
│   ├── app.js                       # Express configuration & route mounting
│   ├── config/                      # Database connection pool setup (mysql2)
│   ├── controllers/                 # HTTP handlers & parameter validation
│   ├── middleware/                  # Auth, role authorization, and error handlers
│   ├── routes/                      # Route declarations
│   ├── services/                    # Business rules, SQL queries, transactions
│   └── utils/                       # ApiError and validator utilities
└── Frontend from Studio/            # React + TypeScript + Vite frontend
    ├── .env.example                 # Frontend environment template
    ├── .gitignore                   # Frontend ignore rules (excludes dist, .env)
    ├── package.json                 # Frontend scripts (build, lint, dev)
    ├── vite.config.ts               # Vite configuration
    └── src/
        ├── App.tsx                  # Main layout and modal manager
        ├── components/              # Student, Warden, Worker, Auth dashboards
        ├── services/api.ts          # Centralized API client & payload normalizer
        └── types/index.ts           # Enterprise TypeScript interfaces & role types
```

---

## Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MySQL**: v8.0 or higher
- **PowerShell** (Windows) or **Bash** (macOS/Linux)

---

### Environment Configuration

1. In the project root, create a `.env` file from the provided template:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Configure `.env` with your local database credentials and secrets:
   ```ini
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=hostelcare
   HOSTEL_ACTIVATION_KEY=your_master_key
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=1h
   ```

---

### Database Initialization & Seeding

Execute the schema and seed scripts using the MySQL CLI:

```powershell
# Create database and tables
Get-Content database\schema.sql | mysql -u root -p

# Populate seed hostels, rooms, demo wardens, and technicians
Get-Content database\seed.sql | mysql -u root -p
```

---

### Starting Backend & Frontend

#### 1. Backend Server (`http://localhost:5000`)
```powershell
# In project root
npm install
npm run dev
# Or production start: npm start
```

#### 2. Frontend Client (`http://localhost:3000`)
```powershell
# In 'Frontend from Studio' directory
cd "Frontend from Studio"
npm install
npm run dev
```

---

## Testing & Quality Verification

All quality checks have been executed and verified in the codebase:

- **Frontend Type Checking**:
  ```powershell
  npx tsc --noEmit
  # Result: PASS (0 errors)
  ```
- **Frontend Code Quality & Lint**:
  ```powershell
  npm run lint
  # Result: PASS (0 lint warnings/errors)
  ```
- **Production Build Generation**:
  ```powershell
  npm run build
  # Result: PASS (vite production bundle generated cleanly)
  ```
- **Backend Architecture & Module Load**:
  ```powershell
  node -e "require('./src/app'); require('./src/services/complaintService');"
  # Result: PASS (All modules load without circular or missing dependencies)
  ```
- **End-to-End Regression Verification**:
  - Confirmed student room and hostel resolution (`GH-1`, `D-101`).
  - Confirmed `CLOSED` → `PENDING` transition on complaint reopening.
  - Confirmed technician reassignment and name rendering across Warden views and CSV exports.
  - Confirmed cross-worker queue isolation.

*Note: Assignment validation for cross-hostel and cross-specialization rejection is implemented in `wardenComplaintService.js` and verified by code inspection.*

---

## API Request/Response Examples

### 1. Student Login
**Request:**
```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "student.gh1.ananya@hostelcare.test",
  "password": "SamplePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 4,
      "name": "Ananya Iyer",
      "email": "student.gh1.ananya@hostelcare.test",
      "role": "STUDENT",
      "room_number": "D-101",
      "hostel_name": "GH-1"
    }
  }
}
```

---

### 2. Warden Assigns Complaint
**Request:**
```http
POST /api/warden/complaints/267/assign HTTP/1.1
Authorization: Bearer <WARDEN_JWT>
Content-Type: application/json

{
  "workerId": 18
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complaint assigned successfully",
  "data": {
    "complaintId": 267,
    "workerId": 18,
    "status": "ASSIGNED"
  }
}
```

---

## Security Considerations & Best Practices

- **Zero Secret Commits**: Real environment secrets (`.env`) are strictly untracked. Safe `.env.example` templates define configuration requirements.
- **Parametric SQL**: All dynamic parameters pass through prepared SQL statements (`?` placeholders) in `mysql2`, blocking SQL injection vectors.
- **Fail-Closed Permissions**: Undefined roles or expired tokens are rejected at the edge with HTTP `401 Unauthorized` / `403 Forbidden`.
- **Atomic Operations**: State transitions and historical auditing occur in unified database transactions (`conn.beginTransaction()`), preventing inconsistent ticket states.
