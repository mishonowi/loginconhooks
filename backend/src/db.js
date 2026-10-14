// Conexión a la base de datos SQLite (módulo nativo node:sqlite, sin dependencias).
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { hashPassword } = require("./auth");

const RAIZ = path.resolve(__dirname, "..", "..");
const SCHEMA = path.join(RAIZ, "database", "schema.sql");
const RUTA_POR_DEFECTO = path.join(RAIZ, "database", "login.db");

// Usuaria de ejemplo para probar el login apenas se levanta el proyecto.
const USUARIA_DEMO = { nombre: "Rosa Demo", email: "rosa@demo.com", password: "Rosa1234" };

function abrirBaseDeDatos(ruta = process.env.DB_PATH || RUTA_POR_DEFECTO) {
  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(SCHEMA, "utf-8"));

  const { total } = db.prepare("SELECT COUNT(*) AS total FROM usuarios").get();
  if (total === 0) {
    db.prepare("INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)").run(
      USUARIA_DEMO.nombre,
      USUARIA_DEMO.email,
      hashPassword(USUARIA_DEMO.password),
    );
  }
  return db;
}

module.exports = { abrirBaseDeDatos, USUARIA_DEMO };
