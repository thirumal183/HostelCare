// scripts/migrate-complaints-title.js
// One-shot migration: add `title VARCHAR(150) NOT NULL DEFAULT ''` to
// complaints table, placed AFTER category_id.
//
// Idempotent: if the column already exists, exits without changes.
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    const [cols] = await c.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'title'`,
        [process.env.DB_NAME]
    );

    if (cols.length > 0) {
        console.log('No-op: complaints.title already exists');
        await c.end();
        return;
    }

    await c.query(
        `ALTER TABLE complaints
         ADD COLUMN title VARCHAR(150) NOT NULL DEFAULT '' AFTER category_id`
    );
    console.log('Added complaints.title');
    await c.end();
})().catch(e => { console.error('Migration failed:', e); process.exit(1); });