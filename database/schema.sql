-- Base de KANAKY · Une histoire en carte. Fichier : database/kanaky.sqlite

CREATE TABLE categories (
  id       TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  color    TEXT NOT NULL,
  position INTEGER NOT NULL
) STRICT;

CREATE TABLE periods (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  from_year REAL NOT NULL,
  to_year   REAL, -- NULL : période en cours
  color     TEXT NOT NULL,
  position  INTEGER NOT NULL
) STRICT;

-- Une image est soit stockée dans la base (image_data), soit un lien (id = https://…).
-- L'id d'une image stockée est le chemin où le site la publie : images/evenements/x.jpg
CREATE TABLE images (
  id     TEXT PRIMARY KEY,
  credit TEXT,
  source TEXT -- page d'origine
) STRICT;

CREATE TABLE image_data (
  image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  mime     TEXT NOT NULL,
  data     BLOB NOT NULL
) STRICT;

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL, -- AAAA, AAAA-MM ou AAAA-MM-JJ
  end_date    TEXT,
  approx      INTEGER NOT NULL DEFAULT 0 CHECK (approx IN (0, 1)),
  date_label  TEXT,
  place       TEXT NOT NULL,
  lat         REAL, -- NULL : hors de l'archipel
  lon         REAL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL,
  logo_id     TEXT REFERENCES images(id),
  image_id    TEXT REFERENCES images(id),
  image_alt   TEXT,
  au_sud      INTEGER NOT NULL DEFAULT 0 CHECK (au_sud IN (0, 1)),
  position    INTEGER NOT NULL, -- départage les événements de même date
  CHECK ((lat IS NULL) = (lon IS NULL))
) STRICT;

CREATE TABLE event_sources (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label    TEXT NOT NULL,
  url      TEXT,
  PRIMARY KEY (event_id, position)
) STRICT;

CREATE TABLE event_videos (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label    TEXT,
  url      TEXT NOT NULL,
  PRIMARY KEY (event_id, position)
) STRICT;

CREATE TABLE aires (
  id          TEXT PRIMARY KEY,
  nom         TEXT NOT NULL UNIQUE,
  couleur     TEXT NOT NULL,
  description TEXT,
  geometry    TEXT NOT NULL, -- géométrie GeoJSON
  position    INTEGER NOT NULL
) STRICT;

CREATE TABLE provinces (
  id          TEXT PRIMARY KEY,
  nom         TEXT NOT NULL,
  cle         TEXT NOT NULL UNIQUE, -- nom court : Nord, Sud, Îles Loyauté
  couleur     TEXT NOT NULL,
  chef_lieu   TEXT,
  description TEXT,
  geometry    TEXT NOT NULL,
  position    INTEGER NOT NULL
) STRICT;

CREATE TABLE communes (
  id                TEXT PRIMARY KEY,
  nom               TEXT NOT NULL UNIQUE,
  province_id       TEXT NOT NULL REFERENCES provinces(id),
  aire_id           TEXT NOT NULL REFERENCES aires(id),
  lat               REAL NOT NULL,
  lon               REAL NOT NULL,
  resume            TEXT,
  histoire          TEXT,
  histoire_manuelle TEXT, -- remplace « histoire » si elle est remplie
  wikipedia         TEXT,
  image_id          TEXT REFERENCES images(id),
  image_alt         TEXT
) STRICT;

CREATE TABLE commune_sources (
  commune_id TEXT NOT NULL REFERENCES communes(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  label      TEXT NOT NULL,
  url        TEXT,
  PRIMARY KEY (commune_id, position)
) STRICT;

CREATE TABLE tribus (
  id           TEXT PRIMARY KEY,
  nom          TEXT NOT NULL,
  nom_local    TEXT,
  commune_id   TEXT NOT NULL REFERENCES communes(id),
  aire_id      TEXT NOT NULL REFERENCES aires(id),
  ile          TEXT,
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  origines     TEXT,
  ajout_manuel INTEGER NOT NULL DEFAULT 0 CHECK (ajout_manuel IN (0, 1))
) STRICT;
CREATE INDEX tribus_commune ON tribus(commune_id);

CREATE TABLE tribu_evenements (
  tribu_id TEXT NOT NULL REFERENCES tribus(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  date     TEXT NOT NULL,
  texte    TEXT NOT NULL,
  PRIMARY KEY (tribu_id, position)
) STRICT;

CREATE TABLE tribu_sources (
  tribu_id TEXT NOT NULL REFERENCES tribus(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label    TEXT NOT NULL,
  url      TEXT,
  PRIMARY KEY (tribu_id, position)
) STRICT;
