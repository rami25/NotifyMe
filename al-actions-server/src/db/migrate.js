import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  console.log('Applying schema.sql ...');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;'); // for gen_random_uuid()
  await pool.query(sql);
  console.log('Done.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
