# HostelCare — Postman / API Readiness Checklist (Phase 4G)

Generated: 2026-08-10
Backend status: All Phase 4A–4F endpoints verified end-to-end. Phase 4G lifecycle + 15 negative tests: **32/32 PASS**.

---

## 1. Server runtime

| Item | Value |
| --- | --- |
| Entry point | `server.js` |
| Default port | `5000` |
| Base URL | `http://localhost:5000` |
| Health check | `GET /api/health` |
| DB health check | `GET /api/health/db` |
| Startup deps | `node server.js` → loads `src/app.js` → mounts routes → starts listening |

---

## 2. Full API inventory

### Public (no auth)

| Method | Path | Controller | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `healthController.getHealth` | Liveness only |
| `GET` | `/api/health/db` | `healthController.getDbHealth` | Pings DB |
| `POST` | `/api/auth/activate` | `authController.activate` | Student first-time activation |
| `POST` | `/api/auth/login` | `authController.login` | Email + password |

### Authenticated (any role)

| Method | Path | Auth | Controller |
| --- | --- | --- | --- |
| `GET` | `/api/auth/me` | JWT | `authController.me` |

### Student-only (`authenticate + authorize('STUDENT')`)

| Method | Path | Phase | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/complaints` | 4A | Create complaint (own hostel) |
| `GET` | `/api/complaints` | 4B | List own complaints |
| `GET` | `/api/complaints/:id` | 4B | Detail + history (own only) |
| `PATCH` | `/api/student/complaints/:id/close` | 4F | RESOLVED → CLOSED |
| `PATCH` | `/api/student/complaints/:id/reopen` | 4F | RESOLVED → PENDING (deactivates assignment) |

### Warden-only (`authenticate + authorize('WARDEN')`)

| Method | Path | Phase | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/warden/complaints` | 4C | List complaints in warden's hostel |
| `GET` | `/api/warden/complaints/:id` | 4C | Detail + history |
| `PATCH` | `/api/warden/complaints/:id/priority` | 4C | Update priority |
| `POST` | `/api/warden/complaints/:id/assign` | 4D | Assign worker |

### Worker-only (`authenticate + authorize('WORKER')`)

| Method | Path | Phase | Notes |
| --- | --- | --- | --- |
| `PATCH` | `/api/worker/complaints/:id/status` | 4E | ASSIGNED→IN_PROGRESS / IN_PROGRESS→RESOLVED |

### RBAC smoke-test endpoints (dev only — strip before prod)

| Method | Path |
| --- | --- |
| `GET` | `/api/auth/test/student` |
| `GET` | `/api/auth/test/warden` |
| `GET` | `/api/auth/test/worker` |
| `GET` | `/api/auth/test/warden-worker` |

---

## 3. Authentication — every protected endpoint requires

```
Authorization: Bearer <jwt>
```

JWT comes from `/api/auth/login`. No cookie/session model.

---

## 4. Status codes the API actually returns (verified by tests)

| Status | Trigger |
| --- | --- |
| `200` | Success |
| `201` | Resource created (`POST /api/complaints`) |
| `400` | Bad request (validation, bad :id, missing body field, non-string note, invalid priority enum) |
| `401` | Missing/invalid JWT, expired JWT, no `userId` in JWT |
| `403` | Authenticated but wrong role for the endpoint |
| `404` | Complaint not visible to the caller (cross-student / cross-hostel / cross-worker) |
| `409` | Conflict — bad transition, wrong hostel/specialization for worker, PENDING complaint hit by worker endpoint, assignment attempted on non-PENDING complaint |
| `500` | Internal server error (escaped) — error middleware strips internals |

---

## 5. Required request shapes

### `POST /api/complaints`

```json
{
  "category": "Electrical",
  "title": "Light not working",
  "description": "Bathroom light has been out for 3 days."
}
```

- `category` must match a row in `complaint_categories.name`.
- `title` non-empty string ≤ 255 chars.
- `description` non-empty string ≤ 5000 chars.

### `PATCH /api/complaints/:id/priority` (no — that's warden)

### `PATCH /api/warden/complaints/:id/priority`

```json
{ "priority": "HIGH" }
```

`priority` ∈ `LOW | MEDIUM | HIGH`.

### `POST /api/warden/complaints/:id/assign`

```json
{ "workerId": 1 }
```

`workerId` must be a positive integer belonging to the warden's hostel with matching specialization.

### `PATCH /api/worker/complaints/:id/status`

```json
{ "status": "IN_PROGRESS", "note": "starting now" }
```

`status` ∈ `IN_PROGRESS | RESOLVED`. `note` optional, ≤ 1000 chars.

### `PATCH /api/student/complaints/:id/close`

```json
{ "note": "thanks" }
```

### `PATCH /api/student/complaints/:id/reopen`

```json
{ "note": "still broken" }
```

---

## 6. Response envelope (success)

```json
{
  "success": true,
  "message": "Complaint assigned successfully",
  "data": { ... }
}
```

Error envelope:

```json
{
  "success": false,
  "message": "Human-readable reason",
  "error":   "..."
}
```

`error` field present for 4xx/5xx; doesn't leak stack traces or secrets (verified by Step 4 security audit).

---

## 7. Lifecycle the API enforces

```
PENDING ──warden assign──▶ ASSIGNED ──worker──▶ IN_PROGRESS ──worker──▶ RESOLVED ──student──▶ CLOSED
   ▲                                                                              │
   └────────────────── student reopen ────────────────────────────────────────────┘
```

All five transitions are exercised by `scripts/test-phase4g-lifecycle.js`.

---

## 8. Authorization rules (verified)

| Rule | Test |
| --- | --- |
| Student can only see / close / reopen their own complaints | SN1, SN2, SN3 |
| Warden can only see / operate on complaints in their hostel | SN4 |
| Warden can only assign workers from same hostel, matching specialization | SN5, SN6 |
| Worker can only operate on complaints they are actively assigned to | SN7, SN8 |
| Cross-role access blocked at middleware layer | SN9, SN10, SN11 |
| Missing / invalid JWT rejected | SN12, SN13 |

---

## 9. Pre-flight checklist before pointing Postman at a fresh DB

1. `mysql -u root -p < database/schema.sql`
2. `mysql -u root -p hostelcare < database/seed.sql`
3. `npm install`
4. Confirm `.env` has `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT=5000`.
5. `npm start` — server boots, `GET /api/health/db` returns `200`.
7. Activate a student via `POST /api/auth/activate` (use seeded `users` row's `email`).
8. Login → token → all RBAC routes work.

---

## 10. Suggested Postman collection ordering

```
1.  GET  /api/health
2.  GET  /api/health/db
3.  POST /api/auth/activate   (seeded student)
4.  POST /api/auth/login       (capture token to {{student_token}})
5.  POST /api/complaints       → save {{cid}}
6.  GET  /api/complaints
7.  GET  /api/complaints/{{cid}}
8.  POST /api/auth/login       (warden → {{warden_token}})
9.  GET  /api/warden/complaints
10. GET  /api/warden/complaints/{{cid}}
11. PATCH /api/warden/complaints/{{cid}}/priority  { "priority": "HIGH" }
12. POST /api/warden/complaints/{{cid}}/assign     { "workerId": 1 }
13. POST /api/auth/login       (worker → {{worker_token}})
14. PATCH /api/worker/complaints/{{cid}}/status    { "status": "IN_PROGRESS" }
15. PATCH /api/worker/complaints/{{cid}}/status    { "status": "RESOLVED" }
16. PATCH /api/student/complaints/{{cid}}/close    { }
17. GET  /api/complaints/{{cid}}  → status CLOSED
```

Repeat steps 5–16 with a second complaint, then:

```
18. PATCH /api/student/complaints/{{cid2}}/reopen { }
19. POST /api/warden/complaints/{{cid2}}/assign   { "workerId": 1 }   ← second drive
20. PATCH /api/worker/complaints/{{cid2}}/status  { "status": "IN_PROGRESS" }
21. PATCH /api/worker/complaints/{{cid2}}/status  { "status": "RESOLVED" }
22. PATCH /api/student/complaints/{{cid2}}/close  { }
```

---

## 11. Known dev-only surfaces to remove before any real deployment

- `GET /api/auth/test/student|warden|worker|warden-worker` — RBAC smoke tests; not used by app.
- Console `console.error(...)` calls in controllers — fine for dev; gate behind log level for prod.
- `populate.js` / one-off scripts under `scripts/` — never run automatically.

---

## 12. Files that document behavior (read these if anything is unclear)

- `docs/POSTMAN-READINESS.md` (this file)
- `docs/PHASE4G-FINAL-AUDIT.md` — audit + verification report
- `scripts/test-phase4d.js`, `test-phase4e.js`, `test-phase4f.js`, `test-phase4g-lifecycle.js` — runnable regression

Backend is Postman-ready as of this phase.