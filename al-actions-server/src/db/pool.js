import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // for Neon
  ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('error', err => {
  // A backend connection was terminated unexpectedly; log and let the pool recover.
  console.error('Unexpected PostgreSQL client error', err);
});

/** Convenience wrapper so call sites don't import pg directly. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Runs `fn` inside a single client so multi-statement writes are transactional. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
