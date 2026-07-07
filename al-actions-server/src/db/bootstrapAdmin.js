/**
 * One-time bootstrap: every new Google sign-in defaults to role
 * 'employee' (see users.repository.js#upsertFromGoogleProfile), so there
 * has to be a way to create the very first admin. Run this once, after
 * that person has signed into the mobile app at least once so their row
 * already exists.
 *
 * Usage:
 *   node src/db/bootstrapAdmin.js someone@airliquide.com
 */
import 'dotenv/config';
import { pool } from './pool.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node src/db/bootstrapAdmin.js <email>');
  process.exit(1);
}

const { rows } = await pool.query(
  `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING email, name, role`,
  [email.toLowerCase()]
);

if (rows.length === 0) {
  console.error(`No user found for ${email}. They need to sign into the app at least once first.`);
  process.exit(1);
}

console.log('Promoted to admin:', rows[0]);
await pool.end();
