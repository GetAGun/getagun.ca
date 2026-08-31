CREATE TABLE IF NOT EXISTS retailers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  phone TEXT,
  website TEXT,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'independent','home-hardware','canadian-tire','pronature','ecotone',
    'bass-pro-cabelas','sail','latulippe','coop','fcnq','northern','gunsmith')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- Shooting/skeet/trap ranges. Deliberately a separate table from retailers so
-- they never reach the store counts, per-capita charts or retailer spreadsheets.
CREATE TABLE IF NOT EXISTS ranges (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  phone TEXT,
  website TEXT,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('indoor','outdoor','hybrid')),
  access TEXT NOT NULL CHECK (access IN ('public','private')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  website TEXT,
  note TEXT,
  kind TEXT NOT NULL DEFAULT 'new' CHECK (kind IN ('new','update','feedback')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migration for databases created before the kind column (run once):
-- ALTER TABLE suggestions ADD COLUMN kind TEXT NOT NULL DEFAULT 'new' CHECK (kind IN ('new','update','feedback'));

-- All Canadian Tire locations (from the store locator); whether one stocks
-- firearms is derived at request time from the mapped canadian-tire retailers.
CREATE TABLE IF NOT EXISTS ct_locations (
  store_number INTEGER PRIMARY KEY,
  branch TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal TEXT,
  phone TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  website TEXT
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY,
  question_en TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  question_fr TEXT,
  answer_fr TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- Door-to-door flyer canvassing (/admin/canvass): one row per residential
-- address that has been touched, keyed on the City of London GIS_ID so
-- rebuilding the static address data never orphans a log. Resident contact
-- details live here and nowhere else, behind the Access gate.
CREATE TABLE IF NOT EXISTS canvass_log (
  id         INTEGER PRIMARY KEY,
  address    TEXT NOT NULL,
  sentiment  INTEGER CHECK (sentiment IS NULL OR sentiment BETWEEN -2 AND 2),
  flyer      INTEGER NOT NULL DEFAULT 0,
  convo      INTEGER NOT NULL DEFAULT 0,
  not_home   INTEGER NOT NULL DEFAULT 0,
  wants_info INTEGER NOT NULL DEFAULT 0,
  licensed   INTEGER NOT NULL DEFAULT 0,
  dnc        INTEGER NOT NULL DEFAULT 0,
  name       TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  updated    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS canvass_log_updated ON canvass_log(updated);
