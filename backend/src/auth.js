// Reglas de negocio del login: validaciones, hash de contraseñas y sesiones.
const crypto = require("node:crypto");

const DURACION_SESION_MS = 2 * 60 * 60 * 1000; // 2 horas
const MAX_INTENTOS_FALLIDOS = 5; // por email, en los últimos 15 minutos
const VENTANA_INTENTOS = "-15 minutes";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// La contraseña debe tener 8+ caracteres, al menos una letra y un número.
function validarPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe tener letras y números";
  }
  return null;
}

function validarEmail(email) {
  return typeof email === "string" && EMAIL_VALIDO.test(email.trim());
}

// Hash con scrypt y sal aleatoria: "sal:hash" en hexadecimal.
function hashPassword(password) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

function verificarPassword(password, guardado) {
  const [sal, hash] = String(guardado).split(":");
  if (!sal || !hash) return false;
  const calculado = crypto.scryptSync(String(password), sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

class ErrorAuth extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

function registrar(db, { nombre, email, password }) {
  nombre = typeof nombre === "string" ? nombre.trim() : "";
  if (nombre.length < 2) throw new ErrorAuth("El nombre debe tener al menos 2 caracteres", 400);
  if (!validarEmail(email)) throw new ErrorAuth("El email no es válido", 400);
  const errorPassword = validarPassword(password);
  if (errorPassword) throw new ErrorAuth(errorPassword, 400);

  email = email.trim().toLowerCase();
  const existe = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existe) throw new ErrorAuth("Ese email ya está registrado", 409);

  const { lastInsertRowid } = db
    .prepare("INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)")
    .run(nombre, email, hashPassword(password));
  return { id: Number(lastInsertRowid), nombre, email };
}

function iniciarSesion(db, { email, password }) {
  if (!validarEmail(email) || typeof password !== "string") {
    throw new ErrorAuth("Email o contraseña incorrectos", 401);
  }
  email = email.trim().toLowerCase();

  const { fallidos } = db
    .prepare(
      `SELECT COUNT(*) AS fallidos FROM intentos_login
       WHERE email = ? AND exitoso = 0 AND fecha > datetime('now', ?)`,
    )
    .get(email, VENTANA_INTENTOS);
  if (fallidos >= MAX_INTENTOS_FALLIDOS) {
    throw new ErrorAuth("Demasiados intentos fallidos. Espera 15 minutos", 429);
  }

  const usuario = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);
  const ok = Boolean(usuario) && verificarPassword(password, usuario.password_hash);
  db.prepare("INSERT INTO intentos_login (email, exitoso) VALUES (?, ?)").run(email, ok ? 1 : 0);
  if (!ok) throw new ErrorAuth("Email o contraseña incorrectos", 401);

  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)").run(
    token,
    usuario.id,
    Date.now() + DURACION_SESION_MS,
  );
  return { token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } };
}

function usuarioDeSesion(db, token) {
  if (!token) return null;
  const fila = db
    .prepare(
      `SELECT u.id, u.nombre, u.email, s.expira_en FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?`,
    )
    .get(token);
  if (!fila) return null;
  if (fila.expira_en < Date.now()) {
    cerrarSesion(db, token);
    return null;
  }
  return { id: fila.id, nombre: fila.nombre, email: fila.email };
}

function cerrarSesion(db, token) {
  db.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
}

module.exports = {
  ErrorAuth,
  MAX_INTENTOS_FALLIDOS,
  validarEmail,
  validarPassword,
  hashPassword,
  verificarPassword,
  registrar,
  iniciarSesion,
  usuarioDeSesion,
  cerrarSesion,
};
