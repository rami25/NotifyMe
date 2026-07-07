-- DROP TRIGGER IF EXISTS trg_actions_updated_at ON actions;
-- DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
-- DROP FUNCTION IF EXISTS set_updated_at();

-- DROP TABLE IF EXISTS action_status_history CASCADE;
-- DROP TABLE IF EXISTS actions CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- DROP TYPE IF EXISTS changed_by_kind CASCADE;
-- DROP TYPE IF EXISTS user_role CASCADE;
-- DROP TYPE IF EXISTS action_priority CASCADE;
-- DROP TYPE IF EXISTS action_status CASCADE;

-- ============================================================
-- Air Liquide Tunisie — Field Action Tracker
-- Replaces the Google Sheet booleans (Clôturée / Annulée) with a
-- single status enum, plus an audit trail of every transition.
-- ============================================================

CREATE TYPE action_status AS ENUM ('in_progress', 'finished', 'cancelled', 'postponed');
CREATE TYPE action_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE user_role AS ENUM ('employee', 'admin');
CREATE TYPE changed_by_kind AS ENUM ('employee', 'admin', 'system');

CREATE TABLE users (
  email         TEXT PRIMARY KEY,               -- @airliquide.com address, natural key
  name          TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'employee',
  active        BOOLEAN NOT NULL DEFAULT true,  -- deactivation, never a hard delete
  ad_username   TEXT UNIQUE,                     -- domain\username from upstream sources, for the AD-to-email mapping
  photo_url     TEXT,
  push_token    TEXT,                             -- current FCM device token, updated on app login
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  customer_name     TEXT NOT NULL,
  customer_ref      TEXT,                        -- e.g. Navision reference
  address           TEXT NOT NULL,
  assigned_to_email TEXT NOT NULL REFERENCES users(email),
  priority          action_priority NOT NULL DEFAULT 'medium',
  status            action_status NOT NULL DEFAULT 'in_progress',
  deadline          TIMESTAMPTZ NOT NULL,
  source            TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'sheet'
  source_row_id     TEXT,                        -- Sheet row identifier, for idempotent ingestion
  cancel_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One upstream Sheet row must only ever create one action row.
CREATE UNIQUE INDEX idx_actions_source_row_id
  ON actions (source_row_id)
  WHERE source_row_id IS NOT NULL;

CREATE INDEX idx_actions_assigned_status ON actions (assigned_to_email, status);
CREATE INDEX idx_actions_deadline ON actions (deadline);
-- Speeds up the overdue job's sweep for candidates.
CREATE INDEX idx_actions_status_deadline ON actions (status, deadline) WHERE status = 'in_progress';

CREATE TABLE action_status_history (
  id          BIGSERIAL PRIMARY KEY,
  action_id   UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  status      action_status NOT NULL,
  changed_by_email TEXT,                         -- NULL when changed_by_kind = 'system'
  changed_by_kind changed_by_kind NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_action ON action_status_history (action_id, changed_at);

-- Keep updated_at current on every write.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
