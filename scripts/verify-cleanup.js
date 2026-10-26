require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [t] = await c.query("SELECT COUNT(*) AS c FROM complaints WHERE title LIKE 'PHASE4D-TEST%'");
  const [a] = await c.query("SELECT COUNT(*) AS c FROM assignments WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
  const [h] = await c.query("SELECT COUNT(*) AS c FROM complaint_history WHERE complaint_id NOT IN (SELECT complaint_id FROM complaints)");
  const [u] = await c.query("SELECT user_id, role, is_active, password_hash IS NULL AS hash_null FROM users WHERE user_id IN (1,2,6,7) ORDER BY user_id");
  const [totals] = await c.query(
    "SELECT (SELECT COUNT(*) FROM complaints) AS complaints, "
    + "(SELECT COUNT(*) FROM assignments) AS assignments, "
    + "(SELECT COUNT(*) FROM complaint_history) AS history, "
    + "(SELECT COUNT(*) FROM users) AS users"
  );
  console.log('Remaining PHASE4D-* complaints:', t[0].c);
  console.log('Orphan assignments:', a[0].c);
  console.log('Orphan history:', h[0].c);
  console.log('Users 1,2,6,7 state:');
  console.table(u);
  console.log('DB totals:', totals[0]);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
