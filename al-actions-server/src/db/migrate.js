import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureColumn(pool, tableName, columnName, definition) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );

  if (rows.length === 0) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`Added column ${tableName}.${columnName}`);
  }
}

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  console.log('Applying schema.sql ...');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;'); // for gen_random_uuid()

  const { rows } = await pool.query(
    `SELECT to_regclass('public.action_attachments') AS table_exists`
  );

  if (rows[0]?.table_exists) {
    await ensureColumn(pool, 'action_attachments', 'storage_path', 'TEXT');
    await ensureColumn(pool, 'action_attachments', 'mime_type', 'TEXT NOT NULL DEFAULT \'application/octet-stream\'');
    await ensureColumn(pool, 'action_attachments', 'file_size', 'BIGINT NOT NULL DEFAULT 0');
    await ensureColumn(pool, 'action_attachments', 'file_data', 'BYTEA NOT NULL');
    await ensureColumn(pool, 'action_attachments', 'uploaded_by', 'TEXT NOT NULL');
    console.log('Existing action_attachments table aligned with the current schema.');
  } else {
    await pool.query(sql);
  }

  console.log('Done.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
