-- 409 Wholesale schema (idempotent: safe to run on every deploy)

CREATE TABLE IF NOT EXISTS contacts (
  id              SERIAL PRIMARY KEY,
  token           TEXT UNIQUE NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  dealership      TEXT NOT NULL,
  brand           TEXT,
  role            TEXT,
  email           TEXT,
  phone           TEXT,
  consent_email   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_sms     BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at      TIMESTAMPTZ,
  consent_by      TEXT,
  consent_method  TEXT,
  email_opt_out   BOOLEAN NOT NULL DEFAULT FALSE,
  sms_opt_out     BOOLEAN NOT NULL DEFAULT FALSE,
  pref_makes      TEXT,
  pref_min_price  INTEGER,
  pref_max_price  INTEGER,
  pref_max_km     INTEGER,
  notes           TEXT,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_uq ON contacts (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS vehicles (
  id               SERIAL PRIMARY KEY,
  code             TEXT UNIQUE,
  vin              TEXT,
  year             INTEGER,
  make             TEXT,
  model            TEXT,
  trim             TEXT,
  km               INTEGER,
  exterior         TEXT,
  interior         TEXT,
  drivetrain       TEXT,
  engine           TEXT,
  transmission     TEXT,
  condition_notes  TEXT,
  announcements    TEXT,
  carfax_url       TEXT,
  carfax_summary   TEXT,
  location         TEXT DEFAULT 'Airdrie, AB',
  seller_name      TEXT,
  seller_source    TEXT,
  seller_ask       INTEGER,
  margin_target    INTEGER NOT NULL DEFAULT 1500,
  status           TEXT NOT NULL DEFAULT 'draft',
  closes_at        TIMESTAMPTZ,
  first_sent_at    TIMESTAMPTZ,
  winning_bid_id   INTEGER,
  buy_price        INTEGER,
  sell_price       INTEGER,
  awarded_at       TIMESTAMPTZ,
  internal_notes   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id          SERIAL PRIMARY KEY,
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id           SERIAL PRIMARY KEY,
  vehicle_id   INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  contact_id   INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL,
  via_email    BOOLEAN NOT NULL DEFAULT FALSE,
  via_sms      BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  view_count   INTEGER NOT NULL DEFAULT 0,
  notified_result BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, contact_id)
);

CREATE TABLE IF NOT EXISTS bids (
  id             SERIAL PRIMARY KEY,
  vehicle_id     INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  contact_id     INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  invitation_id  INTEGER REFERENCES invitations(id) ON DELETE SET NULL,
  amount         INTEGER NOT NULL,
  note           TEXT,
  superseded     BOOLEAN NOT NULL DEFAULT FALSE,
  entered_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bids_vehicle_idx ON bids (vehicle_id) WHERE NOT superseded;

CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  vehicle_id   INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  to_addr      TEXT,
  subject      TEXT,
  body         TEXT,
  status       TEXT NOT NULL,
  provider_id  TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at DESC);
