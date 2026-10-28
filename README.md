# HostelCare — Hostel Complaint & Maintenance Management System

HostelCare is a full-stack, enterprise-grade hostel maintenance and incident management platform built with **Node.js, Express, MySQL, React 19, and TypeScript**. It manages the complete complaint resolution lifecycle across student residents, hostel wardens, and maintenance workers with strict role-based access control, hostel-level data isolation, transactional status transitions, and immutable audit logging.

---

## Table of Contents

- [Problem Statement & Core Value](#problem-statement--core-value)
- [Key Role Capabilities](#key-role-capabilities)
- [Application Preview & Screenshots](#application-preview--screenshots)
- [Technology Stack](#technology-stack)
- [Architecture & Request Flow](#architecture--request-flow)
- [Repository Structure](#repository-structure)
- [Complaint Lifecycle State Machine](#complaint-lifecycle-state-machine)
- [Authentication, Authorization & Security Model](#authentication-authorization--security-model)
- [Database Architecture & Schema Design](#database-architecture--schema-design)
- [Local Installation & Development Setup](#local-installation--development-setup)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Database Initialization & Seeding](#database-initialization--seeding)
  - [Starting Backend & Frontend Servers](#starting-backend--frontend-servers)
- [Testing & Quality Verification](#testing--quality-verification)
  - [Backend Automated Test Suites (118 Tests)](#backend-automated-test-suites-118-tests)
  - [Frontend Typecheck & Production Build](#frontend-typecheck--production-build)
  - [Headless Browser Automation (CDP)](#headless-browser-automation-cdp)
- [RESTful API Specification](#restful-api-specification)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Student Complaint Endpoints](#student-complaint-endpoints)
  - [Warden Management Endpoints](#warden-management-endpoints)
  - [Worker Task Endpoints](#worker-task-endpoints)
- [Demo Test Accounts (Non-Sensitive)](#demo-test-accounts-non-sensitive)
- [Known Limitations & Development Notes](#known-limitations--development-notes)
- [AWS Production Deployment Readiness Checklist](#aws-production-deployment-readiness-checklist)
- [Project Status & Future Roadmap](#project-status--future-roadmap)

---

## Problem Statement & Core Value

Managing hostel maintenance issues across multi-block university or residential campuses frequently suffers from fragmented communication, unrecorded technician dispatches, lack of hostel segregation, and inability for residents to verify repairs before tickets are closed.

**HostelCare solves this with:**
- **Strict Role Boundaries**: Distinct permissions and scoped user interfaces for Students, Wardens, and Maintenance Workers.
- **Hostel-Level Data Isolation**: Wardens and technicians are strictly scoped to their assigned hostel block. Cross-hostel ticket inspection or modification is blocked at the database and middleware layers.
- **Transactional State Transitions**: Prevents invalid status jumps, race conditions, and orphaned assignments using ACID transactions (`conn.beginTransaction()`) and row-level concurrency locks (`SELECT ... FOR UPDATE`).
- **Complete Audit Trail**: Every status transition immutably logs the actor (`changed_by`), role, timestamp, previous status, new status, and optional technical notes.
- **Resident Verification & Reopen Loop**: Tickets resolved by technicians require student confirmation to close, with the ability to reopen if the fault persists.

---

## Key Role Capabilities

| Role | Operational Scope & Capabilities |
|---|---|
| **Student Resident** | • First-time room account activation with institutional email verification.<br>• File complaints with auto-resolved room and hostel context.<br>• Real-time ticket tracking with status chips and chronological timeline.<br>• Confirm satisfactory repairs to close the ticket.<br>• Reopen unresolved issues (`RESOLVED → PENDING` or `CLOSED → PENDING`) with documented feedback. |
| **Hostel Warden** | • Block-isolated operational dashboard viewing all complaints filed within their hostel.<br>• Triage complaints and adjust urgency (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).<br>• Assign tickets to qualified technicians matching hostel block and specialization category.<br>• Real-time queue metrics, emergency escalation directory, and filtered CSV export. |
| **Maintenance Worker** | • Filtered job queue restricted to tickets assigned specifically to their worker ID.<br>• Fast ticket lookup by identifier (e.g. `1` or `HC-0001`).<br>• Advance ticket status (`ASSIGNED → IN_PROGRESS → RESOLVED`).<br>• Record inspection progress notes and technical resolution summaries. |

---

## Application Preview & Screenshots

> *UI previews below reflect the production-styled interface built with Tailwind CSS v4 and spring-based Framer Motion transitions.*

```
┌────────────────────────────────────────────────────────────────────────┐
│  HostelCare · Complaints & maintenance                [● API Connected] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   HOSTEL MAINTENANCE & FACILITIES SYSTEM                               │
│   Your hostel facilities, managed with precision.                     │
│                                                                        │
│   [Sign in to account ->]   [Activate room account]                    │
│                                                                        │
│   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐   │
│   │ Student Resident  │ │ Hostel Warden     │ │ Maintenance Tech  │   │
│   │ Track repairs &   │ │ Triage complaints │ │ Assigned work     │   │
│   │ confirm fixes.    │ │ & assign staff.   │ │ queue & notes.    │   │
│   │ [Preview student] │ │ [Preview warden]  │ │ [Preview worker]  │   │
│   └───────────────────┘ └───────────────────┘ └───────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

- **Landing Page**: Editorial SaaS hero, 3 interactive role preview cards, 4-step workflow pipeline, and system architecture guarantee strip.
- **Student Dashboard**: Filterable ticket cards with status chips, technician notes, detail modal with historical audit timeline, and confirmation dialogs.
- **Warden Dashboard**: 4 KPI metric cards, high-density sortable complaint table, status/priority filters, assignment modal, and CSV audit export.
- **Worker Workspace**: Active assigned roster, fast ticket search, and work progress recording drawer.

---

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+ LTS, tested on v24)
- **Framework**: Express 4.x
- **Database**: MySQL 8.x (InnoDB engine with foreign key constraints and `utf8mb4` character set)
- **Database Driver**: `mysql2/promise` (connection pooling and parameterized SQL statements)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) with `Bearer` header scheme
- **Password Security**: `bcrypt` (10 salt rounds)
- **Configuration**: `dotenv`

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6.x
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with custom layered elevation tokens
- **Animations**: `motion` (Framer Motion v12) with accessible `prefers-reduced-motion` fallbacks
- **Icons**: `lucide-react`
- **Charts & Data**: `recharts`

---

## Architecture & Request Flow

The backend follows an MVC-inspired layered design pattern emphasizing zero trust on client-submitted identity parameters:

```
[ HTTP Client (Vite / React SPA) ]
               │
               ▼
    [ Express Middleware Layer ]
      • cors() & express.json()
      • authenticate (JWT verification -> req.user { userId, role })
      • authorize(roles...) (Fail-closed role gate)
               │
               ▼
     [ Route Layer (/routes) ]
      • REST endpoints mounted by operational role
               │
               ▼
   [ Controller Layer (/controllers) ]
      • Request parameter syntactic validation & sanitization
      • Extracts userId exclusively from verified JWT token
      • Error boundary delegation to centralized errorHandler
               │
               ▼
    [ Service Layer (/services) ]
      • Business logic and transition authorization
      • Same-hostel & matching-specialization validation
      • Transaction boundaries (BEGIN ... COMMIT/ROLLBACK)
      • Row-level locks (SELECT ... FOR UPDATE)
               │
               ▼
      [ MySQL Database ]
      • Relational tables with foreign key integrity & CHECK constraints
```

---

## Repository Structure

```text
HostelCare Project/
├── .env.example                     # Backend environment configuration template
├── .gitignore                       # Git exclusion rules (secrets, node_modules, logs)
├── package.json                     # Backend dependencies & script definitions
├── server.js                        # HTTP entry point (express server bootstrap)
│
├── database/
│   ├── schema.sql                   # DDL: 10 relational tables, constraints & indexes
│   └── seed.sql                     # DML: Hostels, rooms, categories, users & staff
│
├── src/
│   ├── app.js                       # Express application assembly & middleware wiring
│   ├── config/
│   │   └── db.js                    # MySQL2 connection pool configuration
│   ├── controllers/
│   │   ├── authController.js        # Authentication & student activation endpoints
│   │   ├── complaintController.js   # Public complaint endpoints
│   │   ├── studentComplaintController.js # Student-scoped lifecycle endpoints
│   │   ├── wardenComplaintController.js  # Warden triage, assign & export endpoints
│   │   ├── workerComplaintController.js  # Worker queue & transition endpoints
│   │   └── healthController.js      # System & database telemetry
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT verification & claims extraction
│   │   ├── roleMiddleware.js        # Role-based authorization gates
│   │   ├── errorHandler.js          # Centralized error mapping (ApiError)
│   │   └── notFoundHandler.js       # 404 handler for unmatched routes
│   ├── routes/
│   │   ├── authRoutes.js            # POST /api/auth/login, POST /api/auth/activate-student
│   │   ├── studentComplaintRoutes.js # /api/student/complaints (close, reopen)
│   │   ├── wardenComplaintRoutes.js  # /api/warden/complaints (assign, priority, csv)
│   │   ├── workerComplaintRoutes.js  # /api/worker/complaints (status updates)
│   │   └── healthRoutes.js          # /api/health, /api/health/db
│   ├── services/
│   │   ├── authService.js           # Password verification & JWT creation
│   │   ├── complaintService.js      # Student complaints, close/reopen state machine
│   │   ├── wardenComplaintService.js # Warden complaint queries & worker assignment
│   │   └── workerComplaintService.js # Worker queue & status progression
│   └── utils/
│       ├── apiError.js              # Standardized API error class
│       └── validation.js            # Syntactic field validators
│
├── scripts/
│   ├── audit-4g-db.js               # Database schema & constraint integrity auditor
│   ├── test-phase4d.js              # Phase 4D: Warden assignment automated tests (22 tests)
│   ├── test-phase4e.js              # Phase 4E: Worker lifecycle automated tests (31 tests)
│   ├── test-phase4f.js              # Phase 4F: Student close/reopen tests (33 tests)
│   ├── test-phase4g-lifecycle.js    # Phase 4G: End-to-end lifecycle & security suite (32 tests)
│   ├── test-frontend-browser.js     # Headless Chrome DevTools Protocol automation (10 checks)
│   └── verify-cleanup.js            # Database test fixture verification script
│
└── Frontend from Studio/            # React + TypeScript + Vite Client
    ├── .env.example                 # Frontend environment template
    ├── package.json                 # Frontend dependencies (React 19, Tailwind v4, Motion)
    ├── vite.config.ts               # Vite configuration & dev proxy
    ├── tsconfig.json                # TypeScript compiler configuration
    ├── index.html                   # HTML entry point
    └── src/
        ├── App.tsx                  # Root app, hero landing page & modal coordinator
        ├── index.css                # Tailwind CSS v4, elevation shadows & theme tokens
        ├── components/
        │   ├── auth/                # LoginModal.tsx, ActivationModal.tsx
        │   ├── common/              # Header.tsx, StatusBadge.tsx, PriorityBadge.tsx,
        │   │                        # ComplaintTimeline.tsx, ProfileModal.tsx, Toast.tsx
        │   ├── student/             # StudentDashboard.tsx, RaiseComplaintModal.tsx
        │   ├── warden/              # WardenDashboard.tsx, WardenAssignModal.tsx,
        │   │                        # WardenDetailModal.tsx, WardenEscalateModal.tsx
        │   └── worker/              # WorkerDashboard.tsx
        ├── services/
        │   └── api.ts               # Typed REST API client & Axios/Fetch wrappers
        └── types/
            └── index.ts             # Domain interfaces, enums, & normalizers
```

---

## Complaint Lifecycle State Machine

Complaints advance through a strictly enforced state machine. Unauthorized jumps are rejected with HTTP `409 Conflict`:

```
               [ Resident Reports ]
                        │
                        ▼
                   ( PENDING )
                        │
                        │ Warden assigns technician
                        │ (Validates same hostel + specialization)
                        ▼
                   ( ASSIGNED )
                        │
                        │ Technician accepts task
                        ▼
                 ( IN_PROGRESS )
                        │
                        │ Technician logs work notes & completes fix
                        ▼
                   ( RESOLVED )
                        │
             ┌──────────┴──────────┐
             │                     │
   Student confirms fix    Student reports fault persists
             │                     │
             ▼                     ▼
         ( CLOSED ) ─────────► ( PENDING )
             │   Student reopens   ▲
             │   recurring fault   │
             └─────────────────────┘
```

### State Transition Rules
1. **PENDING → ASSIGNED**: Executed exclusively by Warden of the same hostel. Creates an active row in `assignments` (`is_active = TRUE`).
2. **ASSIGNED → IN_PROGRESS**: Executed exclusively by the assigned Technician.
3. **IN_PROGRESS → RESOLVED**: Executed exclusively by the assigned Technician with optional technical notes.
4. **RESOLVED → CLOSED**: Executed exclusively by the complaint's Student owner.
5. **RESOLVED → PENDING (Reopen)**: Executed by the Student owner if repair was unsuccessful. Deactivates previous worker assignment (`is_active = FALSE`).
6. **CLOSED → PENDING (Reopen)**: Executed by the Student owner if the issue recurs. Deactivates previous worker assignment.

---

## Authentication, Authorization & Security Model

- **Password Storage**: Hashed via `bcrypt` with a work factor of 10 rounds. Passwords are never stored in plaintext.
- **Stateless Tokens**: Signed JSON Web Tokens containing `{ userId, role }` with a configured expiry (`JWT_EXPIRES_IN=1h`).
- **Authorization Enforcement**:
  - `authenticate`: Edge middleware verifying JWT signature and populating `req.user`.
  - `authorize(...roles)`: Role-gated middleware rejecting unauthorized roles with HTTP `403 Forbidden`.
- **Identity Isolation**: The client never provides its own `userId` in write operations; the backend pulls `req.user.userId` directly from the validated token.
- **Hostel Segregation**: Warden queries filter complaints by `warden.hostel_id`. Worker queries filter complaints by active worker assignment. Cross-hostel accesses return HTTP `404 Not Found`.

---

## Database Architecture & Schema Design

The schema is defined in [`database/schema.sql`](database/schema.sql) and executed on MySQL 8.x:

```
┌──────────────┐       ┌─────────────┐       ┌─────────────┐
│    users     │◀──────│  students   │──────▶│    rooms    │
│  (user_id)   │       │(student_id) │       │  (room_id)  │
└──────────────┘       └──────┬──────┘       └──────┬──────┘
       ▲                      │                     │
       │                      ▼                     ▼
       │               ┌─────────────┐       ┌─────────────┐
       ├───────────────│ complaints  │◀──────│   hostels   │
       │               │(complaint_id│       │ (hostel_id) │
       │               └──────┬──────┘       └─────────────┘
       │                      │                     ▲
       │               ┌──────┴──────┐              │
       │               ▼             ▼              │
┌──────────────┐┌─────────────┐┌─────────────┐┌─────────────┐
│   wardens    ││ assignments ││  history    ││   workers   │
│  (user_id)   ││ (worker_id) ││(changed_by) ││  (user_id)  │
└──────────────┘└─────────────┘└─────────────┘└─────────────┘
```

1. **`users`**: Base credentials table (`user_id`, `email`, `password_hash`, `role`, `is_active`).
2. **`hostels`**: Hostel blocks (`hostel_id`, `hostel_name`, `hostel_type`).
3. **`rooms`**: Specific room entries tied to hostels with unique composite keys `(hostel_id, room_number)`.
4. **`students`**: Resident profiles linked to `users` and `rooms` (`is_activated` flag).
5. **`wardens`**: Administrative staff profiles linked to `users` and specific `hostels`.
6. **`workers`**: Maintenance staff linked to `users`, `hostels`, and technical `category`.
7. **`complaint_categories`**: Normalized category names (`Electrical`, `Plumbing`, `Wi-Fi`, `Furniture`, etc.).
8. **`complaints`**: Primary ticket record (`complaint_code`, `student_id`, `category_id`, `priority`, `status`, `title`, `description`).
9. **`assignments`**: Active and historical technician assignments (`complaint_id`, `worker_id`, `assigned_by`, `is_active`).
10. **`complaint_history`**: Immutable audit logs (`complaint_id`, `changed_by`, `old_status`, `new_status`, `note`, `changed_at`).

---

## Local Installation & Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL Server**: v8.0 or higher running locally (default port `3306`)

### Environment Configuration

#### 1. Backend Environment (`.env`)
Create `.env` in the project root by copying `.env.example`:
```bash
cp .env.example .env
```
Populate `.env` with your local database and auth settings:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=hostelcare
HOSTEL_ACTIVATION_KEY=hostelcare-secret-key-2024
JWT_SECRET=your_secure_random_jwt_secret_key_at_least_32_chars
JWT_EXPIRES_IN=1h
```

#### 2. Frontend Environment (`Frontend from Studio/.env`)
Create `.env` in `Frontend from Studio/` by copying `.env.example`:
```bash
cd "Frontend from Studio"
cp .env.example .env
```
Verify configuration:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

### Database Initialization & Seeding

Open MySQL in your terminal and execute the schema and seed scripts:

#### Windows PowerShell:
```powershell
# Create tables and constraints
Get-Content database\schema.sql | mysql -u root -p

# Populate seed hostels, rooms, demo wardens, technicians, and categories
Get-Content database\seed.sql | mysql -u root -p
```

#### macOS / Linux Bash:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

---

### Starting Backend & Frontend Servers

Run both servers in separate terminal sessions:

#### Terminal 1 — Backend (`http://localhost:5000`):
```bash
# In project root
npm install
npm run dev
# Or start production mode: npm start
```
Verify backend telemetry:
- API Status: `http://localhost:5000/api/health`
- Database Status: `http://localhost:5000/api/health/db`

#### Terminal 2 — Frontend (`http://localhost:3000`):
```bash
cd "Frontend from Studio"
npm install
npm run dev
```

Access the application in your browser at: **`http://localhost:3000`**

---

## Testing & Quality Verification

### Backend Automated Test Suites (118 Tests)

The repository includes comprehensive automated test suites verifying ACID transactions, access constraints, and security negatives:

```bash
# 1. Database schema, tables, foreign keys, and CHECK constraints
node scripts/audit-4g-db.js

# 2. Phase 4D: Warden Assignment Constraints (22 test cases)
# Tests: Atomic assignment, specialization matching, cross-hostel rejection, 409 status gate
node scripts/test-phase4d.js

# 3. Phase 4E: Worker Lifecycle & Isolation (31 test cases)
# Tests: ASSIGNED -> IN_PROGRESS -> RESOLVED, cross-worker isolation, concurrent updates
node scripts/test-phase4e.js

# 4. Phase 4F: Student Close & Reopen (33 test cases)
# Tests: RESOLVED -> CLOSED, RESOLVED -> PENDING, CLOSED -> PENDING, assignment deactivation
node scripts/test-phase4f.js

# 5. Phase 4G: Full End-to-End Lifecycle & Security (32 test cases)
# Tests: Cycle 1 happy path, Cycle 2 reopen & reassign, 15 security negative RBAC tests
node scripts/test-phase4g-lifecycle.js

# 6. Verify zero test fixture leakage in MySQL
node scripts/verify-cleanup.js
```

### Frontend Typecheck & Production Build

```bash
cd "Frontend from Studio"

# Strict TypeScript typechecking (0 errors)
npx tsc --noEmit

# Production bundle compilation
npm run build
```

### Headless Browser Automation (CDP)

The frontend includes a headless Chrome DevTools Protocol automation script verifying live DOM rendering and 0 runtime exceptions:

```bash
# Requires backend running on :5000 and frontend on :3000
node scripts/test-frontend-browser.js
```
*Tests: Page mount, typography, modal open/close, role switching, and console error surveillance.*

---

## RESTful API Specification

### Authentication Endpoints

#### 1. Resident Room Activation
- **URL**: `POST /api/auth/activate-student`
- **Auth**: None (Public)
- **Body**:
  ```json
  {
    "email": "student.bh3.thiru@hostelcare.test",
    "activationKey": "hostelcare-secret-key-2024",
    "password": "SecurePassword123"
  }
  ```
- **Success (200)**: `{ "success": true, "message": "Student account activated successfully" }`

#### 2. User Sign In
- **URL**: `POST /api/auth/login`
- **Auth**: None (Public)
- **Body**:
  ```json
  {
    "email": "warden.bh3@hostelcare.test",
    "password": "WardenPassword123"
  }
  ```
- **Success (200)**: Returns JWT bearer token and user profile object.

---

### Student Complaint Endpoints

- `POST /api/complaints` — Create a maintenance complaint (`category`, `title`, `description`).
- `GET /api/complaints` — Retrieve list of complaints filed by the authenticated resident.
- `GET /api/complaints/:id` — Retrieve full complaint details and history for owned ticket.
- `PATCH /api/student/complaints/:id/close` — Confirm repair and transition `RESOLVED → CLOSED`.
- `PATCH /api/student/complaints/:id/reopen` — Reject repair or report recurring defect (`RESOLVED | CLOSED → PENDING`).

---

### Warden Management Endpoints

- `GET /api/warden/complaints` — Retrieve all complaints filed within the warden's assigned hostel.
- `GET /api/warden/complaints/:id` — Retrieve ticket details with active assignment and timeline.
- `PATCH /api/warden/complaints/:id/priority` — Adjust urgency level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `POST /api/warden/complaints/:id/assign` — Assign a technician (`workerId`). Validates hostel & category match.

---

### Worker Task Endpoints

- `GET /api/worker/complaints` — Retrieve complaints assigned to the authenticated worker.
- `GET /api/worker/complaints/:id` — Look up ticket details for an assigned complaint.
- `PATCH /api/worker/complaints/:id/status` — Transition status (`IN_PROGRESS`, `RESOLVED`) with work notes.

---

## Demo Test Accounts (Non-Sensitive)

The seed script provides baseline testing accounts across roles (use seeded credentials in local dev):

| Role | Seeded Email Identifier | Context / Assignment |
|---|---|---|
| **Student** | `student.bh3.thiru@hostelcare.test` | Resident in Boys Hostel 3 (Room A-101) |
| **Warden** | `warden.bh3@hostelcare.test` | Chief Warden of Boys Hostel 3 |
| **Warden (Cross)** | `warden.bh4@hostelcare.test` | Chief Warden of Boys Hostel 4 |
| **Worker (Electrical)** | `worker.bh3.electrical@hostelcare.test` | Specialized in Electrical, assigned to BH-3 |
| **Worker (Plumbing)** | `worker.bh3.plumbing@hostelcare.test` | Specialized in Plumbing, assigned to BH-3 |

---

## Known Limitations & Development Notes

1. **Numeric Worker ID Assignment**: In real API mode, the Warden assign modal requires inputting the technician's numeric `workerId`. A future feature release will populate an auto-filtered dropdown from a dedicated `/api/warden/workers` endpoint.
2. **File Attachments**: Complaint creation currently supports structured text fields (`category`, `title`, `description`). Direct image attachment uploads will be enabled via AWS S3 presigned URLs in the subsequent phase.
3. **Push Notifications**: Live updates currently operate via REST polling. WebSocket / Server-Sent Events (SSE) dispatch is slated for real-time mobile push notifications.

---

## AWS Production Deployment Readiness Checklist

This project is architected for cloud deployment on **Amazon Web Services (AWS)**:

### 1. Frontend SPA Hosting (Static Distribution)
- **Target**: AWS S3 + Amazon CloudFront
- **Build Output**: `Frontend from Studio/dist`
- **Routing**: CloudFront custom error response redirecting HTTP `404` to `/index.html` (HTTP `200`) for client-side routing.
- **SSL/TLS**: AWS Certificate Manager (ACM) SSL certificate attached to CloudFront distribution.

### 2. Backend API Hosting (Container / Node.js Runtime)
- **Target Options**: AWS App Runner (fully managed) or AWS ECS Fargate (containerized).
- **Process Management**: Docker container running `node server.js` behind an Application Load Balancer (ALB).
- **Health Checks**: ALB health target group pointed to `/api/health`.

### 3. Database Layer (Managed Relational Storage)
- **Target**: Amazon RDS for MySQL (Multi-AZ for high availability).
- **Security**: Placed inside private database subnets with security group rules accepting traffic only from the ECS/App Runner security group on port `3306`.
- **Storage**: General Purpose SSD (gp3) with automated daily snapshot backups.

### 4. Secrets & Configuration Management
- **Target**: AWS Secrets Manager or AWS Systems Manager (SSM) Parameter Store.
- **Injection**: Inject `DB_PASSWORD`, `JWT_SECRET`, and `HOSTEL_ACTIVATION_KEY` at container runtime without storing credentials in code or repository variables.

### 5. Network & Domain Configuration
- **DNS**: Amazon Route 53 pointing apex and subdomain records to CloudFront (frontend) and ALB (API).
- **CORS**: Configure backend `cors({ origin: 'https://hostelcare.yourdomain.com' })` replacing localhost references.

---

## Project Status & Future Roadmap

- [x] End-to-end complaint lifecycle (Report → Triage → Repair → Verify → Close).
- [x] Transactional assignment state machine with atomic deactivation on reopen.
- [x] Strict role-based authorization & hostel isolation.
- [x] Clean, responsive frontend redesign with accessible motion tokens.
- [x] 118 automated backend integration tests & headless browser test suite.
- [ ] AWS CloudFormation / Terraform infrastructure-as-code manifests.
- [ ] Direct photo attachments via Amazon S3 presigned URLs.
- [ ] Student mobile notification integration via Amazon SNS.

---

*HostelCare — Engineered for institutional facility reliability, transparency, and operational accountability.*
