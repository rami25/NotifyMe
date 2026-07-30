import { query, withTransaction } from '../db/pool.js';
import { HttpError } from '../utils/asyncHandler.js';

const ACTION_COLUMNS = `
  id, title, description, customer_name, customer_ref, address,
  assigned_to_email, priority, status, deadline, source, cancel_reason,
  created_at, updated_at
`;

function toApiShape(row, history = [], attachments = []) {
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
    })),
    attachments: attachments.map(a => ({
      id: a.id,
      fileName: a.file_name,
      mimeType: a.mime_type,
      fileSize: a.file_size,
      downloadUrl: `/api/actions/${row.id}/attachments/${a.id}/download`
    }))
  };
}

function classifyByDeadline(deadlineIso) {
  return new Date(deadlineIso).getTime() > Date.now() ? 'in_progress' : 'postponed';
}

async function fetchHistoryStandalone(actionId) {
  const { rows } = await query(
    'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
    [actionId]
  );
  return rows;
}

async function fetchAttachmentsStandalone(actionId) {
  const { rows } = await query(
    'SELECT id, file_name, mime_type, file_size FROM action_attachments WHERE action_id = $1 ORDER BY created_at ASC',
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
      const [history, attachments] = await Promise.all([
        fetchHistoryStandalone(row.id),
        fetchAttachmentsStandalone(row.id)
      ]);
      return toApiShape(row, history, attachments);
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

  const [history, attachments] = await Promise.all([
    fetchHistoryStandalone(actionId),
    fetchAttachmentsStandalone(actionId)
  ]);
  return toApiShape(rows[0], history, attachments);
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
export async function finishAction(actionId, employee, files = []) {
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

    for (const file of files) {
      await uploadActionAttachment(actionId, employee, file, client);
    }

    const [history, attachments] = await Promise.all([
      client.query(
        'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
        [actionId]
      ),
      client.query(
        'SELECT id, file_name, mime_type, file_size FROM action_attachments WHERE action_id = $1 ORDER BY created_at ASC',
        [actionId]
      )
    ]);

    return toApiShape({ ...row, status: 'finished' }, history.rows, attachments.rows);
  });
}

export async function uploadActionAttachment(actionId, actor, file, client = null) {
  const execute = client ? (sql, params) => client.query(sql, params) : (sql, params) => query(sql, params);

  const { rows: existing } = await execute('SELECT id FROM actions WHERE id = $1', [actionId]);
  if (!existing[0]) throw new HttpError(404, 'Action not found');

  const { rows: ownerRows } = await execute('SELECT assigned_to_email FROM actions WHERE id = $1', [actionId]);
  const isOwner = actor.role === 'admin' || actor.email === ownerRows[0]?.assigned_to_email;
  if (!isOwner) {
    throw new HttpError(403, 'You can only upload attachments for actions assigned to you');
  }

  const { rows } = await execute(
    `INSERT INTO action_attachments (action_id, file_name, mime_type, file_size, file_data, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, file_name, mime_type, file_size`,
    [actionId, file.originalname, file.mimetype, file.size, file.buffer, actor.email]
  );

  return rows[0];
}

export async function getAttachmentById(attachmentId, actionId, user) {
  const sql =
    user.role === 'admin'
      ? `SELECT a.id, a.file_name, a.mime_type, a.file_size, a.file_data
         FROM action_attachments a
         JOIN actions act ON act.id = a.action_id
         WHERE a.id = $1 AND a.action_id = $2`
      : `SELECT a.id, a.file_name, a.mime_type, a.file_size, a.file_data
         FROM action_attachments a
         JOIN actions act ON act.id = a.action_id
         WHERE a.id = $1 AND a.action_id = $2 AND act.assigned_to_email = $3`;
  const params = user.role === 'admin' ? [attachmentId, actionId] : [attachmentId, actionId, user.email];

  const { rows } = await query(sql, params);
  if (!rows[0]) throw new HttpError(404, 'Attachment not found');
  return rows[0];
}

export async function deleteAttachmentById(actionId, attachmentId, actor) {
  const { rows: ownerRows } = await query('SELECT assigned_to_email FROM actions WHERE id = $1', [actionId]);
  if (!ownerRows[0]) throw new HttpError(404, 'Action not found');

  const isOwner = actor.role === 'admin' || actor.email === ownerRows[0].assigned_to_email;
  if (!isOwner) {
    throw new HttpError(403, 'You can only delete attachments for actions assigned to you');
  }

  const { rows } = await query(
    'DELETE FROM action_attachments WHERE id = $1 AND action_id = $2 RETURNING id',
    [attachmentId, actionId]
  );
  if (!rows[0]) throw new HttpError(404, 'Attachment not found');
  return rows[0];
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
export async function createAction(input, actor) {
  const deadlineIsFuture = new Date(input.deadline).getTime() > Date.now();
  const newStatus = deadlineIsFuture ? 'in_progress' : 'postponed';
  const source = actor.role === 'admin' ? 'admin' : 'employee';
  const { rows } = await query(
    `INSERT INTO actions
       (title, description, customer_name, customer_ref, address, assigned_to_email, priority, status, deadline, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${ACTION_COLUMNS}`,
    [
      input.title,
      input.description || '',
      input.customerName,
      input.customerRef || null,
      input.address,
      input.assignedToEmail,
      input.priority || 'medium',
      newStatus,
      input.deadline,
      source
    ]
  );
  const row = rows[0];
  await query(
    `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
     VALUES ($1, $2, $3, $4)`,
    [row.id, newStatus, actor.email, actor.role]
  );
  return toApiShape(row, await fetchHistoryStandalone(row.id));
}

/** Admin-Only: Update an action. Tracks assignee shifts and status history. */
export async function updateAction(actionId, patch, actor) {
  return withTransaction(async client => {
    const row = await loadActionRowForUpdate(client, actionId);
    if (!row) throw new HttpError(404, 'Action not found');
    if (actor.role !== 'admin' && row.assigned_to_email !== actor.email) {
      throw new HttpError(403, 'You can only edit actions assigned to you');
    }
    if (actor.role !== 'admin' && !['in_progress', 'postponed'].includes(row.status)) {
      throw new HttpError(409, `Action is already ${row.status}`);
    }

    const next = {
      title: patch.title ?? row.title,
      description: patch.description ?? row.description,
      customer_name: patch.customerName ?? row.customer_name,
      customer_ref: patch.customerRef ?? row.customer_ref,
      address: patch.address ?? row.address,
      assigned_to_email: patch.assignedToEmail ?? row.assigned_to_email,
      priority: patch.priority ?? row.priority,
      deadline: patch.deadline ?? row.deadline
    };

    // Terminal states (finished/cancelled) are never touched by an edit —
    // only in_progress/postponed are live enough to be reclassified by a
    // deadline change. Comparing against the NEW deadline, not the old one:
    //   postponed  + new deadline now in the future -> back to in_progress
    //   in_progress + new deadline now in the past   -> immediately postponed
    //     (rather than waiting for the next overdue sweep)

    // let nextStatus = row.status;
    // const deadlineIsFuture = new Date(next.deadline).getTime() > Date.now();
    // if (row.status === 'postponed' && deadlineIsFuture) {
    //   nextStatus = 'in_progress';
    // } else if (row.status === 'in_progress' && !deadlineIsFuture) {
    //   nextStatus = 'postponed';
    // }
    // const statusChanged = nextStatus !== row.status;
    const nextStatus = classifyByDeadline(next.deadline);
    const statusChanged = nextStatus !== row.status;

    await client.query(
      `UPDATE actions SET
         title = $2, description = $3, customer_name = $4, customer_ref = $5,
         address = $6, assigned_to_email = $7, priority = $8, deadline = $9,
         status = $10
       WHERE id = $1`,
      [
        actionId, next.title, next.description, next.customer_name, next.customer_ref,
        next.address, next.assigned_to_email, next.priority, next.deadline, nextStatus
      ]
    );

    const reassigned = next.assigned_to_email !== row.assigned_to_email;
    if (reassigned) {
      // Reassignment is meaningful enough to show up in the audit trail
      // even when the status itself didn't change.
      await client.query(
        `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
         VALUES ($1, $2, $3, $4)`,
        [actionId, nextStatus, actor.email, actor.role]
      );
    }
    if (statusChanged) {
      // Reclassification triggered by the admin's edit — attributed to
      // them (not 'system'), since the automatic sweep didn't do this.
      await client.query(
        `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
         VALUES ($1, $2, $3, $4)`,
        [actionId, nextStatus, actor.email, actor.role]
      );
    }

    const history = await client.query(
      'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
      [actionId]
    );

    return {
      action: toApiShape({ ...row, ...next, status: nextStatus }, history.rows),
      reassigned,
      statusChanged,
      previousAssignee: reassigned ? row.assigned_to_email : null
    };
  });
}

/**
 * Admin-only: duplicates a FINISHED action into a brand-new action, with
 * optionally-edited fields. The original finished row is never touched
 * — this is the only way to "edit" a finished action's details, and it
 * preserves the historical record of what was actually done rather than
 * overwriting it.
 *
 * The new action's initial status is derived from ITS OWN deadline
 * (classifyByDeadline), not forced to in_progress — duplicating a job
 * that still needs to happen urgently, with a deadline already in the
 * past, starts life already postponed rather than misrepresenting it.
 */
export async function duplicateAction(sourceId, patch, admin) {
  const { rows } = await query(`SELECT ${ACTION_COLUMNS} FROM actions WHERE id = $1`, [sourceId]);
  const source = rows[0];
  if (!source) throw new HttpError(404, 'Action not found');
  if (source.status !== 'finished') {
    throw new HttpError(409, 'Only finished actions can be duplicated this way.');
  }
  if (admin.role !== 'admin' && source.assigned_to_email !== admin.email) {
    throw new HttpError(403, 'You can only duplicate actions assigned to you');
  }

  const next = {
    title: patch.title ?? source.title,
    description: patch.description ?? source.description,
    customer_name: patch.customerName ?? source.customer_name,
    customer_ref: patch.customerRef ?? source.customer_ref,
    address: patch.address ?? source.address,
    assigned_to_email: patch.assignedToEmail ?? source.assigned_to_email,
    priority: patch.priority ?? source.priority,
    deadline: patch.deadline ?? source.deadline
  };
  const initialStatus = classifyByDeadline(next.deadline);

  const { rows: inserted } = await query(
    `INSERT INTO actions
       (title, description, customer_name, customer_ref, address, assigned_to_email, priority, deadline, status, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${ACTION_COLUMNS}`,
    [
      next.title, next.description, next.customer_name, next.customer_ref,
      next.address, next.assigned_to_email, next.priority, next.deadline, initialStatus,
      admin.role === 'admin' ? 'admin' : 'employee'
    ]
  );
  const created = inserted[0];

  await query(
    `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
     VALUES ($1, $2, $3, 'admin')`,
    [created.id, initialStatus, admin.email]
  );

  return toApiShape(created, await fetchHistoryStandalone(created.id));
}

/**
 * Admin-only: restores a CANCELLED action back to an active status,
 * with the ability to edit its fields in the same operation (unlike
 * duplicateAction, this reuses the SAME row/id — a cancelled action
 * was never "done" the way a finished one was, so there's no separate
 * historical artifact worth protecting by leaving it alone). Clears
 * cancel_reason, since it's active again. New status is derived from
 * the (possibly edited) deadline, same as updateAction.
 */
export async function restoreAction(actionId, patch, admin) {
  return withTransaction(async client => {
    const row = await loadActionRowForUpdate(client, actionId);
    if (!row) throw new HttpError(404, 'Action not found');
    if (row.status !== 'cancelled') {
      throw new HttpError(409, 'Only cancelled actions can be restored.');
    }
    if (admin.role !== 'admin' && row.assigned_to_email !== admin.email) {
      throw new HttpError(403, 'You can only restore actions assigned to you');
    }

    const next = {
      title: patch.title ?? row.title,
      description: patch.description ?? row.description,
      customer_name: patch.customerName ?? row.customer_name,
      customer_ref: patch.customerRef ?? row.customer_ref,
      address: patch.address ?? row.address,
      assigned_to_email: patch.assignedToEmail ?? row.assigned_to_email,
      priority: patch.priority ?? row.priority,
      deadline: patch.deadline ?? row.deadline
    };
    const restoredStatus = classifyByDeadline(next.deadline);

    await client.query(
      `UPDATE actions SET
         title = $2, description = $3, customer_name = $4, customer_ref = $5,
         address = $6, assigned_to_email = $7, priority = $8, deadline = $9,
         status = $10, cancel_reason = NULL
       WHERE id = $1`,
      [
        actionId, next.title, next.description, next.customer_name, next.customer_ref,
        next.address, next.assigned_to_email, next.priority, next.deadline, restoredStatus
      ]
    );

    await client.query(
      `INSERT INTO action_status_history (action_id, status, changed_by_email, changed_by_kind)
       VALUES ($1, $2, $3, 'admin')`,
      [actionId, restoredStatus, admin.email]
    );

    const reassigned = next.assigned_to_email !== row.assigned_to_email;

    const history = await client.query(
      'SELECT status, changed_by_email, changed_by_kind, changed_at FROM action_status_history WHERE action_id = $1 ORDER BY changed_at ASC',
      [actionId]
    );

    return {
      action: toApiShape({ ...row, ...next, status: restoredStatus, cancel_reason: null }, history.rows),
      reassigned
    };
  });
}

/** Admin-Only: Hard delete an action and return its metadata before it vanishes for notifications */
export async function deleteAction(id, actor) {
  const { rows: existing } = await query(
    'SELECT id, title, assigned_to_email, customer_name FROM actions WHERE id = $1',
    [id]
  );
  if (existing.length === 0) return null;
  const row = existing[0];
  if (actor.role !== 'admin' && row.assigned_to_email !== actor.email) {
    throw new HttpError(403, 'You can only delete actions assigned to you');
  }
  await query('DELETE FROM action_status_history WHERE action_id = $1', [id]);
  await query('DELETE FROM actions WHERE id = $1', [id]);
  return row;
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
