import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/asyncHandler.js';

const ACTION_COLUMNS = `
  id, title, description, customer_name, customer_ref, address,
  assigned_to_email, priority, status, deadline, source, cancel_reason,
  created_at, updated_at
`;

function toApiShape(row, history = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    customerName: row.customer_name,
    customerRef: row.customer_ref,
    address: row.address,
    assignedToEmail: row.assigned_to_email,
    priority: row.priority,
    status: row.status,
    deadline: row.deadline,
    createdAt: row.created_at,
    cancelReason: row.cancel_reason,
    statusHistory: history.map(h => ({
      status: h.status,
      changedAt: h.changed_at,
      changedBy: h.changed_by_kind === 'system' ? 'system' : h.changed_by_email
    }))
  };
}

async function fetchHistoryStandalone(actionId) {
  const { rows } = await query(
    'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
    [actionId]
  );
  return rows;
}

/** Role-scoped at the query level, per the spec — never just hidden in the UI. */
export async function listActionsForUser(user) {
  const sql =
    user.role === 'admin'
      ? `SELECT ${ACTION_COLUMNS} FROM actions ORDER BY deadline ASC`
      : `SELECT ${ACTION_COLUMNS} FROM actions WHERE assigned_to_email = $1 ORDER BY deadline ASC`;
  const params = user.role === 'admin' ? [] : [user.email];

  const { rows } = await query(sql, params);

  // N+1 is fine at this scale (a few hundred actions per employee); revisit
  // with a single joined history query if the admin's full list grows large.
  const withHistory = await Promise.all(
    rows.map(async row => {
      const history = await fetchHistoryStandalone(row.id);
      return toApiShape(row, history);
    })
  );
  return withHistory;
}

export async function getActionForUser(actionId, user) {
  const sql =
    user.role === 'admin'
      ? `SELECT ${ACTION_COLUMNS} FROM actions WHERE id = $1`
      : `SELECT ${ACTION_COLUMNS} FROM actions WHERE id = $1 AND assigned_to_email = $2`;
  const params = user.role === 'admin' ? [actionId] : [actionId, user.email];

  const { rows } = await query(sql, params);
  if (!rows[0]) throw new HttpError(404, 'Action not found');

  const history = await fetchHistoryStandalone(actionId);
  return toApiShape(rows[0], history);
}

async function recordTransition(client, actionId, status, changedByEmail, changedByKind) {
  await client.query(
    `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
     VALUES ($1, $2, $3, $4)`,
    [actionId, status, changedByEmail, changedByKind]
  );
}

async function loadActionRowForUpdate(client, actionId) {
  const { rows } = await client.query(
    `SELECT ${ACTION_COLUMNS} FROM actions WHERE id = $1 FOR UPDATE`,
    [actionId]
  );
  return rows[0];
}

/** Employee closes their own action. Only valid from in_progress/postponed. */
export async function finishAction(actionId, employee) {
  return withTransaction(async client => {
    const row = await loadActionRowForUpdate(client, actionId);
    if (!row) throw new HttpError(404, 'Action not found');
    if (row.assigned_to_email !== employee.email) {
      throw new HttpError(403, 'You can only finish actions assigned to you');
    }
    if (!['in_progress', 'postponed'].includes(row.status)) {
      throw new HttpError(409, `Action is already ${row.status}`);
    }

    await client.query(`UPDATE actions SET status = 'finished' WHERE id = $1`, [actionId]);
    await recordTransition(client, actionId, 'finished', employee.email, 'employee');

    const history = await client.query(
      'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
      [actionId]
    );
    return toApiShape({ ...row, status: 'finished' }, history.rows);
  });
}

/** Either the assigned employee or an admin can cancel; caller passed in as `actor`. */
export async function cancelAction(actionId, actor, reason) {
  return withTransaction(async client => {
    const row = await loadActionRowForUpdate(client, actionId);
    if (!row) throw new HttpError(404, 'Action not found');

    const isOwner = row.assigned_to_email === actor.email;
    if (actor.role !== 'admin' && !isOwner) {
      throw new HttpError(403, 'You can only cancel actions assigned to you');
    }
    if (!['in_progress', 'postponed'].includes(row.status)) {
      throw new HttpError(409, `Action is already ${row.status}`);
    }

    await client.query(
      `UPDATE actions SET status = 'cancelled', cancel_reason = $2 WHERE id = $1`,
      [actionId, reason || null]
    );
    await recordTransition(
      client,
      actionId,
      'cancelled',
      actor.email,
      actor.role === 'admin' ? 'admin' : 'employee'
    );

    const history = await client.query(
      'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
      [actionId]
    );
    return toApiShape({ ...row, status: 'cancelled', cancel_reason: reason || null }, history.rows);
  });
}

/** Admin-only: create and assign a new action directly (the other of the two intake paths). */
export async function createAction(input, admin) {
  const { rows } = await query(
    `INSERT INTO actions
       (title, description, customer_name, customer_ref, address, assigned_to_email, priority, deadline, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'admin')
     RETURNING ${ACTION_COLUMNS}`,
    [
      input.title,
      input.description || '',
      input.customerName,
      input.customerRef || null,
      input.address,
      input.assignedToEmail,
      input.priority || 'medium',
      input.deadline
    ]
  );
  const row = rows[0];
  await query(
    `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
     VALUES ($1, 'in_progress', $2, 'admin')`,
    [row.id, admin.email]
  );
  return toApiShape(row, await fetchHistoryStandalone(row.id));
}

/** Used by the overdue job: flips in_progress -> postponed past deadline. Returns affected rows. */
export async function sweepOverdueActions() {
  const { rows } = await query(
    `UPDATE actions
       SET status = 'postponed'
     WHERE status = 'in_progress' AND deadline < now()
     RETURNING ${ACTION_COLUMNS}`
  );

  for (const row of rows) {
    await query(
      `INSERT INTO action_status_history (action_id, status, changed_by_kind)
       VALUES ($1, 'postponed', 'system')`,
      [row.id]
    );
  }
  return rows;
}
