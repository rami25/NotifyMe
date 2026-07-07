import { query } from '../db/pool.js';

function toApiShape(row) {
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    photoUrl: row.photo_url
  };
}

/**
 * Called on every successful Google sign-in. Creates the user on first
 * login (default role 'employee', active true) or refreshes name/photo
 * on subsequent logins — role and active are never touched here, only
 * an admin can change those.
 */
export async function upsertFromGoogleProfile({ email, name, photoUrl }) {
  const { rows } = await query(
    `INSERT INTO users (email, name, photo_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           photo_url = EXCLUDED.photo_url
     RETURNING email, name, role, active, photo_url`,
    [email, name, photoUrl]
  );
  return toApiShape(rows[0]);
}

export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT email, name, role, active, photo_url FROM users WHERE email = $1',
    [email]
  );
  return rows[0] ? toApiShape(rows[0]) : null;
}

export async function listUsers() {
  const { rows } = await query(
    'SELECT email, name, role, active, photo_url FROM users ORDER BY name ASC'
  );
  return rows.map(toApiShape);
}

/** Admin-only. Deactivation only — never a hard delete, so historical actions stay intact. */
export async function setUserActive(email, active) {
  const { rows } = await query(
    `UPDATE users SET active = $2 WHERE email = $1
     RETURNING email, name, role, active, photo_url`,
    [email, active]
  );
  return rows[0] ? toApiShape(rows[0]) : null;
}

export async function setUserRole(email, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2 WHERE email = $1
     RETURNING email, name, role, active, photo_url`,
    [email, role]
  );
  return rows[0] ? toApiShape(rows[0]) : null;
}

export async function updatePushToken(email, token) {
  await query('UPDATE users SET push_token = $2 WHERE email = $1', [email, token]);
}

/** Internal use only (notifications) — not part of the public user shape. */
export async function getPushToken(email) {
  const { rows } = await query('SELECT push_token FROM users WHERE email = $1', [email]);
  return rows[0]?.push_token || null;
}
