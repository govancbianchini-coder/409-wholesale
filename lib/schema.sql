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

-- Market report (comps + stats) attached to a unit, filled by the Overbid Research agent
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS report JSONB;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS report_at TIMESTAMPTZ;

-- ===== Dealer accounts (Phase 2) =====
-- A dealership is the org; contacts (existing table) are the people. A contact becomes a dealer user
-- the first time they sign in by magic link. Preferences live on the dealership.
CREATE TABLE IF NOT EXISTS dealerships (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT,
  city          TEXT,
  pref_makes    TEXT[],          -- makes they want to be called on, e.g. {BMW,Audi,Mercedes-Benz}
  pref_models   TEXT,            -- free text, e.g. "X5, Q7, GLE — SUVs only"
  pref_min_year INTEGER,
  pref_max_km   INTEGER,
  pref_max_price INTEGER,
  invite_token  TEXT UNIQUE,     -- onboarding link: /d/join/<token>
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dealerships_name_uq ON dealerships (lower(name));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- One-time sign-in codes
CREATE TABLE IF NOT EXISTS login_codes (
  id          SERIAL PRIMARY KEY,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  channel     TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Units called out by a dealer: who submitted, required photo slots, review state.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seller_dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dealer_notes TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS slot TEXT;   -- e.g. 'ext_front', 'int_dash'

-- ---------- GTM: dealer sign-up tracker ----------
CREATE TABLE IF NOT EXISTS gtm_targets (
  id             SERIAL PRIMARY KEY,
  route_order    INTEGER NOT NULL,
  cluster_no     INTEGER NOT NULL,
  cluster        TEXT NOT NULL,
  dealership     TEXT UNIQUE NOT NULL,
  brands         TEXT,
  grp            TEXT,
  address        TEXT,
  phone          TEXT,
  gm             TEXT,
  gsm            TEXT,
  contact_notes  TEXT,
  priority       TEXT NOT NULL DEFAULT 'B',
  status         TEXT NOT NULL DEFAULT 'not_contacted',
  owner          TEXT,
  next_step      TEXT,
  next_at        DATE,
  dealership_id  INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gtm_visits (
  id          SERIAL PRIMARY KEY,
  target_id   INTEGER NOT NULL REFERENCES gtm_targets(id) ON DELETE CASCADE,
  by_name     TEXT,
  kind        TEXT NOT NULL,          -- call | visit | meeting | demo | note
  outcome     TEXT,                   -- status set by this touch
  met_with    TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gtm_visits_target_idx ON gtm_visits(target_id, created_at DESC);
CREATE TABLE IF NOT EXISTS gtm_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ===== Close + settlement (process pass) =====
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS close_notified_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS buyer_paid_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seller_paid_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS settlement_note TEXT;
