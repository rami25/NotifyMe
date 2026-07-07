# AL Actions — API (Express + PostgreSQL)

Backend for the Air Liquide Tunisie action-tracking system, replacing the
Google Sheet-based process. Serves the employee mobile app and (later) the
admin panel, and owns all the business logic described in the project
overview: the four-state status machine, role-scoped queries, the overdue
sweep, and the one-way Sheet ingestion sync.

## Stack

- **Express** — HTTP layer
- **PostgreSQL** (`pg`) — source of truth, no ORM (plain parameterized SQL)
- **google-auth-library** — verifies Google ID tokens from the mobile app
- **googleapis** — reads the ingestion Google Sheet
- **nodemailer** — email notifications via Gmail/SMTP
- **firebase-admin** — push notifications via FCM
- **node-cron** — the overdue job and Sheet sync polling
- **jsonwebtoken** — this API's own session tokens (separate from Google's)

## Setup

```bash
npm install
cp .env.example .env    # then fill in real values
```

You'll need a running PostgreSQL instance. Then:

```bash
npm run db:migrate
npm run dev
```

The server starts on `PORT` (default `8000`), matching the mobile app's
`environment.apiBaseUrl = 'http://localhost:8000/api'`.

### First admin

Every Google sign-in creates a `users` row with role `employee` by default
(role/active are things only an admin can change — see the spec). To create
the very first admin, have that person sign in once from the mobile app,
then run:

```bash
npm run db:bootstrap-admin -- someone@airliquide.com
```

## Data model

`src/db/schema.sql` — one `actions` table with a `status` enum
(`in_progress | finished | cancelled | postponed`), an
`action_status_history` audit trail, and a `users` table with `role` and
`active` (deactivation only, never a hard delete — see `source_row_id`'s
unique index for how Sheet-sourced rows stay idempotent).

## API

All routes are under `/api`. Authenticated routes expect
`Authorization: Bearer <session-jwt>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/google` | public | Exchange a Google ID token for a session JWT |
| GET | `/auth/me` | any signed-in user | Resolve the session token to a user (session restore) |
| GET | `/actions/mine` | any signed-in user | The caller's own actions (mobile app's "My Plan") |
| GET | `/actions` | admin | Every action, across all employees |
| GET | `/actions/:id` | owner or admin | Single action + status history |
| POST | `/actions` | admin | Create + assign a new action directly |
| POST | `/actions/:id/finish` | owner (employee) | Close out an action — notifies admins by email |
| POST | `/actions/:id/cancel` | owner or admin | Cancel — notifies whichever side didn't initiate it |
| GET | `/users` | admin | List all users |
| PATCH | `/users/:email/active` | admin | Deactivate/reactivate a user |
| PATCH | `/users/:email/role` | admin | Change a user's role |
| PATCH | `/users/me/push-token` | any signed-in user | Register/refresh the caller's FCM device token |

### Notification rules (matches the spec exactly)

- Action assigned (either intake path) → employee notified by email
- Employee finishes → **all admins** notified by email
- Employee cancels → **all admins** notified by email
- Admin cancels → **that employee** notified by push
- Deadline passes (automatic) → that employee notified by push

## Background jobs

- **Overdue sweep** (`src/jobs/overdueJob.js`) — cron (`OVERDUE_JOB_CRON`,
  default every 15 minutes) flips any `in_progress` action past its
  `deadline` to `postponed`, logs the transition, and pushes the employee.
  Also runs once immediately at boot to catch anything missed while the
  server was down.
- **Sheet sync** (`src/services/sheetSync.service.js`) — polls the
  ingestion Google Sheet (`GOOGLE_SHEETS_ID`) every
  `SHEET_SYNC_INTERVAL_MINUTES` and inserts any row not already ingested.
  `source_row_id` has a unique index, so re-running the sync (or a
  restart mid-poll) can never double-insert the same row. This sync only
  flows one direction — nothing is ever written back to the Sheet, which
  is what avoids the two-places-editing-the-same-data problem the spec
  calls out. Run it once manually with `npm run sheet:sync:once`.

## Things to wire up before production

1. **Google Cloud Console** — OAuth client (Web application type) for
   `GOOGLE_OAUTH_CLIENT_ID`, restricted to the `airliquide.com` Workspace.
   Must match the mobile app's `capacitor.config.ts` `serverClientId`.
2. **Gmail App Password** — a Workspace account dedicated to sending
   notifications (`SMTP_USER` / `SMTP_APP_PASSWORD`), not a personal
   password.
3. **Firebase project** — download the service account JSON for
   `FIREBASE_SERVICE_ACCOUNT_PATH`; push notifications are a no-op until
   this is set.
4. **Sheet service account** — a separate service account (read-only) with
   access to the ingestion Sheet, for `GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH`.
5. **AD username mapping** — `users.ad_username` needs to be populated
   (e.g. during user provisioning) so Sheet rows written as
   `domain\username` can resolve to an email; rows that can't resolve are
   skipped and counted in the sync summary rather than silently dropped.
