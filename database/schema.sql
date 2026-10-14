-- Base de datos del mini login rosa (SQLite)
-- Se aplica automáticamente al iniciar el backend (backend/src/db.js).

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT    PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en  INTEGER NOT NULL  -- epoch en milisegundos
);

CREATE TABLE IF NOT EXISTS intentos_login (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT    NOT NULL,
  exitoso  INTEGER NOT NULL,  -- 1 = entró, 0 = falló
  fecha    TEXT    NOT NULL DEFAULT (datetime('now'))
);
