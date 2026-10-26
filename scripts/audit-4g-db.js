// scripts/audit-4g-db.js
// Phase 4G database integrity audit.
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const checks = [];
  const check = (name, val) => checks.push({ name, val });

  // Row counts
  const [tables] = await conn.query(`
    SELECT table_name, table_rows
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name
  `, [process.env.DB_NAME]);
  check('Table row counts', tables);

  // FK constraints (cross-table references)
  const [fks] = await conn.query(`
    SELECT
      tc.table_name AS source_table,
      kc.column_name AS source_column,
      kc.referenced_table_name AS target_table,
      kc.referenced_column_name AS target_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc
      ON tc.constraint_schema = kc.constraint_schema
     AND tc.table_name        = kc.table_name
     AND tc.constraint_name   = kc.constraint_name
    WHERE tc.constraint_schema = ?
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kc.column_name
  `, [process.env.DB_NAME]);
  check('Foreign keys', fks);

  // CHECK constraints
  const [checksRs] = await conn.query(`
    SELECT
      tc.table_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_schema = cc.constraint_schema
     AND tc.constraint_name   = cc.constraint_name
    WHERE tc.constraint_schema = ?
      AND tc.constraint_type = 'CHECK'
    ORDER BY tc.table_name
  `, [process.env.DB_NAME]);
  check('CHECK constraints', checksRs);

  // UNIQUE constraints
  const [uq] = await conn.query(`
    SELECT
      tc.table_name,
      kc.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc
      ON tc.constraint_schema = kc.constraint_schema
     AND tc.table_name        = kc.table_name
     AND tc.constraint_name   = kc.constraint_name
    WHERE tc.constraint_schema = ?
      AND tc.constraint_type = 'UNIQUE'
    ORDER BY tc.table_name, kc.column_name
  `, [process.env.DB_NAME]);
  check('UNIQUE constraints', uq);

  // Orphan checks
  const [orphanA] = await conn.query(`
    SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)`);
  const [orphanAworker] = await conn.query(`
    SELECT COUNT(*) AS c FROM assignments WHERE worker_id NOT IN (SELECT worker_id FROM workers)`);
  const [orphanAwarden] = await conn.query(`
    SELECT COUNT(*) AS c FROM assignments WHERE assigned_by NOT IN (SELECT warden_id FROM wardens)`);
  const [orphanH] = await conn.query(`
    SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)`);
  const [orphanHuser] = await conn.query(`
    SELECT COUNT(*) AS c FROM complaint_history WHERE changed_by NOT IN (SELECT user_id FROM users)`);
  const [orphanR] = await conn.query(`
    SELECT COUNT(*) AS c FROM rooms WHERE hostel_id NOT IN (SELECT hostel_id FROM hostels)`);
  const [orphanStuRoom] = await conn.query(`
    SELECT COUNT(*) AS c FROM students WHERE room_id NOT IN (SELECT room_id FROM rooms)`);
  const [orphanStuUser] = await conn.query(`
    SELECT COUNT(*) AS c FROM students WHERE user_id NOT IN (SELECT user_id FROM users)`);
  const [orphanWardenU] = await conn.query(`
    SELECT COUNT(*) AS c FROM wardens WHERE user_id NOT IN (SELECT user_id FROM users)`);
  const [orphanWardenH] = await conn.query(`
    SELECT COUNT(*) AS c FROM wardens WHERE hostel_id NOT IN (SELECT hostel_id FROM hostels)`);
  const [orphanWorkerU] = await conn.query(`
    SELECT COUNT(*) AS c FROM workers WHERE user_id NOT IN (SELECT user_id FROM users)`);
  const [orphanWorkerH] = await conn.query(`
    SELECT COUNT(*) AS c FROM workers WHERE hostel_id NOT IN (SELECT hostel_id FROM hostels)`);
  const [orphanCat] = await conn.query(`
    SELECT COUNT(*) AS c FROM complaints WHERE category_id NOT IN (SELECT category_id FROM complaint_categories)`);
  const [orphanStudentS] = await conn.query(`
    SELECT COUNT(*) AS c FROM complaints WHERE student_id NOT IN (SELECT student_id FROM students)`);

  check('Orphan assignments → complaints', orphanA[0].c);
  check('Orphan assignments → workers', orphanAworker[0].c);
  check('Orphan assignments → wardens', orphanAwarden[0].c);
  check('Orphan history → complaints', orphanH[0].c);
  check('Orphan history → users', orphanHuser[0].c);
  check('Orphan rooms → hostels', orphanR[0].c);
  check('Orphan students → rooms', orphanStuRoom[0].c);
  check('Orphan students → users', orphanStuUser[0].c);
  check('Orphan wardens → users', orphanWardenU[0].c);
  check('Orphan wardens → hostels', orphanWardenH[0].c);
  check('Orphan workers → users', orphanWorkerU[0].c);
  check('Orphan workers → hostels', orphanWorkerH[0].c);
  check('Orphan complaints → categories', orphanCat[0].c);
  check('Orphan complaints → students', orphanStudentS[0].c);

  // NOT NULL verification on every column we consider required
  const [nn] = await conn.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = ?
      AND is_nullable = 'NO'
      AND extra NOT LIKE '%auto_increment%'
    ORDER BY table_name, ordinal_position
  `, [process.env.DB_NAME]);
  check('NOT NULL columns', nn);

  // Status / priority enum check
  const [statuses] = await conn.query(`SELECT DISTINCT status FROM complaints ORDER BY status`);
  const [priorities] = await conn.query(`SELECT DISTINCT priority FROM complaints ORDER BY priority`);
  const [histStatuses] = await conn.query(`SELECT DISTINCT old_status, new_status FROM complaint_history`);
  check('Distinct complaint.status', statuses);
  check('Distinct complaint.priority', priorities);
  check('Distinct complaint_history statuses', histStatuses);

  console.log(JSON.stringify(checks, null, 2));
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
