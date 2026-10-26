# HostelCare — Local Development & Troubleshooting Guide

This guide covers setup, running, building, testing, and troubleshooting the **HostelCare** application locally.

---

## 1. Prerequisites

Before running the application, ensure the following software is installed on your development machine:

- **Node.js:** v18.0.0 or later (tested on v24.x)
- **npm:** v9.0.0 or later
- **MySQL Server:** v8.0 or later (or MariaDB v10.4+)
- **Git** (optional, for version management)

---

## 2. Database Setup

### Step 1: Start MySQL
Ensure your local MySQL service is active. On Windows:
```powershell
# Check or start MySQL via Services or command line
net start MySQL80
# Or start via XAMPP / WampServer control panel if using an all-in-one stack
```

### Step 2: Create the Database & Apply Schema
Open your MySQL terminal or client (e.g., MySQL Workbench, HeidiSQL) and execute:

```sql
CREATE DATABASE IF NOT EXISTS hostelcare;
USE hostelcare;
```

Run the schema creation script:
```powershell
# From the project root:
mysql -u root -p hostelcare < database/schema.sql
```

### Step 3: Populate Development Seed Data
Populate the initial hostels, rooms, categories, and test accounts:
```powershell
mysql -u root -p hostelcare < database/seed.sql
```

---

## 3. Backend Setup & Startup

### Step 1: Install Backend Dependencies
Open a terminal in the root project folder:
```powershell
cd "c:\Users\thiru\OneDrive\Desktop\HostelCare Project"
npm install
```

### Step 2: Configure Environment Variables Safely
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Edit `.env` and fill in your local MySQL credentials:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=hostelcare
HOSTEL_ACTIVATION_KEY=HOSTELCARE2026
JWT_SECRET=your_local_secret_key_change_in_production
JWT_EXPIRES_IN=1h
```

> [!WARNING]
> Never commit `.env` to Git. Keep credentials local.

### Step 3: Start the Backend Server
Run the startup script defined in `package.json`:
```powershell
npm start
```
*Expected output:*
```
HostelCare server running on port 5000
```

To run with live reload during development (if `nodemon` is installed):
```powershell
npm run dev
```

### Step 4: Verify Backend Health
Open a browser or terminal and test the health endpoints:
```powershell
curl http://localhost:5000/api/health
# {"success":true,"message":"HostelCare API is running"}

curl http://localhost:5000/api/health/db
# {"success":true,"message":"Database connection is successful","database":"hostelcare",...}
```

---

## 4. Frontend Setup & Startup

### Step 1: Install Frontend Dependencies
Open a second terminal window in the frontend subfolder:
```powershell
cd "c:\Users\thiru\OneDrive\Desktop\HostelCare Project\Frontend from Studio"
npm install
```

### Step 2: Configure the API Base URL (Optional)
By default, the frontend connects to `http://localhost:5000/api`. To customize this:
1. Create a `.env` file in `Frontend from Studio/` with:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
2. Or configure the URL at runtime in the app UI by clicking the **Backend Settings** server icon in the top header bar.

### Step 3: Start the Vite Development Server
Run the dev script defined in `Frontend from Studio/package.json`:
```powershell
npm run dev
```
*Expected output:*
```
  VITE v6.2.3  ready in ... ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

Open `http://localhost:3000` in your web browser.

---

## 5. Building & Testing

### Frontend Type Check & Linting
Run the type-check script from `Frontend from Studio`:
```powershell
cd "c:\Users\thiru\OneDrive\Desktop\HostelCare Project\Frontend from Studio"
npm run lint
```
*Script executes:* `tsc --noEmit`

### Frontend Production Build
To create a production bundle in `Frontend from Studio/dist`:
```powershell
npm run build
```
*Script executes:* `vite build`

To preview the production build locally:
```powershell
npm run preview
```

### Backend Syntax Verification
Verify Node.js syntax across backend source files without running them:
```powershell
cd "c:\Users\thiru\OneDrive\Desktop\HostelCare Project"
node -c src/app.js src/server.js src/controllers/*.js src/services/*.js src/routes/*.js
```

---

## 6. Seeded Test Credentials Reference

The following accounts are available for testing after running `seed.sql`:

### 1. Hostel Warden (1-Click Demo Login)
- **Email:** `warden.bh3@hostelcare.test`
- **Password:** `Warden@123`
- **Hostel:** Boys Hostel 3 (BH-3)
- **Role:** Review complaints, assign technicians, update urgency/priority

### 2. Maintenance Worker (1-Click Demo Login)
- **Email:** `worker.bh3.electrical@hostelcare.test`
- **Password:** `Worker@123`
- **Hostel:** Boys Hostel 3 (BH-3)
- **Specialty:** Electrical
- **Role:** View assigned jobs, click **Start** (`IN_PROGRESS`), click **Resolve** (`RESOLVED`)

### 3. Student Resident (Requires Room Activation)
- **Email:** `student.bh3.thiru@hostelcare.test`
- **Hostel:** `BH-3`
- **Room:** `A-101`
- **Activation Key:** Configured in backend `.env` (`HOSTEL_ACTIVATION_KEY`)
- **How to test:**
  1. Click **Activate room account** on the home page or login modal.
  2. Enter email (`student.bh3.thiru@hostelcare.test`), hostel (`BH-3`), room (`A-101`), and your activation key.
  3. Create a password (minimum 8 characters).
  4. Sign in with the newly set password.

---

## 7. Troubleshooting Common Errors

### 1. `Cannot reach http://localhost:5000/api/health: Server offline`
- **Cause:** Backend server is not running or running on a different port.
- **Solution:** Ensure `npm start` is running in the root folder. Verify `PORT=5000` in `.env`.

### 2. `Database connection failed` / `ECONNREFUSED 127.0.0.1:3306`
- **Cause:** MySQL service is not running, or database credentials in `.env` are wrong.
- **Solution:**
  1. Verify MySQL is running (`net start MySQL80`).
  2. Test logging in via command line: `mysql -u root -p`.
  3. Check `.env` contains the correct `DB_USER` and `DB_PASSWORD`.

### 3. `401 Invalid email or password` on Demo Login
- **Cause:** Database seed data was not imported, or custom credentials were entered.
- **Solution:** Re-run `seed.sql` into the `hostelcare` database. Use the quick-fill buttons on `LoginModal` for Warden and Worker.

### 4. `400 hostel is required; room is required; activationKey is required`
- **Cause:** Using an outdated activation form payload.
- **Solution:** Ensure all 5 fields (email, hostel name, room number, activation key, password) are provided.

### 5. `404 Category not found` on Complaint Submission
- **Cause:** Complaint category name does not match the database seed.
- **Solution:** Ensure the category is one of: `Electrical`, `Plumbing`, `Wi-Fi` (with hyphen), `Furniture`, `Cleaning`, `Water`, or `Other`.

### 6. `403 Access denied` on Ticket Lookup
- **Cause:** A worker tried to access `GET /api/complaints/:id` (which is restricted to students).
- **Solution:** Workers can only inspect and update complaints that are assigned to them. Use the active work orders queue on the Worker Dashboard.

### 7. PowerShell Script Execution Disabled (`PSSecurityException`)
- **Cause:** Windows PowerShell execution policy restricts running `.ps1` scripts.
- **Solution:** Run commands via `cmd /c "npm run ..."` or change PowerShell policy:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

