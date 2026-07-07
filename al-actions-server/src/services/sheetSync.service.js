import { readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';

/**
 * The Sheet is a permanent ingestion boundary, not a temporary stepping
 * stone (per the spec): upstream sources like Navision write rows here,
 * and this sync pulls them into the actions table one-way. Status
 * changes made afterward never get written back into the Sheet.
 */

let sheetsClient = null;

function getSheetsClient() {
  if (!sheetsClient) {
    const credentials = JSON.parse(readFileSync(config.googleSheets.serviceAccountPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

/** Resolves the Sheet's domain\username convention to an @airliquide.com email via the users table. */
async function resolveAssigneeEmail(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return null;

  let email;
  let adUsername = null;

  if (value.includes('@')) {
    email = value.toLowerCase();
  } else {
    // domain\username -> derive the @airliquide.com address
    adUsername = (value.includes('\\') ? value.split('\\').pop() : value).toLowerCase();
    email = `${adUsername}@${config.allowedGoogleDomain}`.toLowerCase();
  }

  // Already known — either signed in before, or ingested from an earlier
  // Sheet row referencing the same person — reuse that row untouched.
  const { rows: existing } = await query(
    'SELECT email FROM users WHERE email = $1 OR ad_username = $2',
    [email, adUsername]
  );
  if (existing[0]) return existing[0].email;

  // Unknown employee: auto-provision a minimal placeholder so the action
  // is still assigned rather than skipped. role defaults to 'employee'
  // and active defaults to true (see schema.sql).
  await query(
    `INSERT INTO users (email, name, ad_username)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [email, adUsername || email.split('@')[0], adUsername]
  );

  return email;
}

function parsePriority(raw) {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'high' || value === 'haute') return 'high';
  if (value === 'low' || value === 'basse') return 'low';
  return 'medium';
}

function parseDeadline(raw) {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Pulls new rows and inserts any not already ingested (source_row_id is
 * unique, so re-running this is always safe). Returns a small summary
 * for logging/manual runs.
 */
export async function syncOnce() {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheets.sheetId,
    range: config.googleSheets.range
  });

  const rows = data.values || [];
  if (rows.length > 0 && (rows[0][0] === 'N°' || rows[0][1] === 'ACTION')) {
    rows.shift();
  }
  const summary = { seen: rows.length, inserted: 0, skippedExisting: 0, skippedInvalid: 0 };

  let i = 1;
  for (const row of rows) {
    if (i > 10) break;
    console.log("new___id", i);
    i += 1;
    const rowId        = row[0];   // N°
    const title        = row[1];   // ACTION
    const assignedRaw  = row[2];   // Affectée à
    const deadlineRaw  = row[4];   // Date d'échéance
    const patientCode  = row[9];   // Code Patient
    const customerName = row[10];  // Nom Patient
    const address      = row[11];  // Adresse
    const phone        = row[12];  // N° téléphone
    const priorityRaw  = row[14];  // Priorité
    const statusRaw    = row[20];  // Statut (Optional helper reference)

    if (!rowId || !title) {
      summary.skippedInvalid++;
      continue;
    }

    // 2. Check for existing record to maintain Idempotency
    const { rows: existing } = await query('SELECT 1 FROM actions WHERE source_row_id = $1', [rowId]);
    if (existing.length > 0) {
      summary.skippedExisting++;
      continue;
    }


    // 3. Resolve and format relational data types
    const assignedToEmail = await resolveAssigneeEmail(assignedRaw);
    const deadline = parseDeadline(deadlineRaw);

    if (!assignedToEmail || !deadline) {
      summary.skippedInvalid++;
      continue;
    }

    // 4. Synthesize a description field using helpful metadata from the spreadsheet
    const description = `Patient Code: ${patientCode || 'N/A'} | Tel: ${phone || 'N/A'}`;

    // 5. Database execution
    const { rows: inserted } = await query(
      `INSERT INTO actions
         (title, description, customer_name, address, assigned_to_email, priority, deadline, source, source_row_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sheet', $8)
       RETURNING id`,
      [
        title, 
        description, 
        customerName || 'Unknown Patient', 
        address || 'No Address Provided', 
        assignedToEmail, 
        parsePriority(priorityRaw), 
        deadline, 
        rowId
      ]
    );

    // 6. Log the initial pipeline event inside your history table
    await query(
      `INSERT INTO action_status_history (action_id, status, changed_by_kind)
       VALUES ($1, 'in_progress', 'system')`,
      [inserted[0].id]
    );

    summary.inserted++;
  }
  return summary;
}

/** Starts the periodic poll. Call once at server boot if Sheet sync is configured. */
export function startSheetSyncPolling() {
  if (!config.googleSheets.sheetId || !config.googleSheets.serviceAccountPath) {
    console.log('Sheet sync not configured (GOOGLE_SHEETS_ID / service account missing) — skipping.');
    return;
  }

  const intervalMs = config.googleSheets.syncIntervalMinutes * 60 * 1000;
  console.log(`Sheet sync polling every ${config.googleSheets.syncIntervalMinutes} minute(s).`);

  const run = async () => {
    try {
      const summary = await syncOnce();
      if (summary.inserted > 0) {
        console.log('Sheet sync:', summary);
      }
    } catch (err) {
      console.error('Sheet sync failed:', err.message);
    }
  };

  run();
  setInterval(run, intervalMs);
}
