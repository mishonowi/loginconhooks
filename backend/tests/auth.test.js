// Pruebas de las reglas de negocio del login. Los hooks protegen esta carpeta:
// si una prueba falla, se corrige el código, no la prueba.
const test = require("node:test");
const assert = require("node:assert/strict");
const { abrirBaseDeDatos, USUARIA_DEMO } = require("../src/db");
const auth = require("../src/auth");

const nuevaDB = () => abrirBaseDeDatos(":memory:");

test("la base de datos trae a la usuaria demo", () => {
  const db = nuevaDB();
  const fila = db.prepare("SELECT email FROM usuarios").get();
  assert.equal(fila.email, USUARIA_DEMO.email);
});

test("las contraseñas se guardan hasheadas, nunca en texto plano", () => {
  const db = nuevaDB();
  const { password_hash } = db.prepare("SELECT password_hash FROM usuarios").get();
  assert.notEqual(password_hash, USUARIA_DEMO.password);
  assert.ok(auth.verificarPassword(USUARIA_DEMO.password, password_hash));
  assert.ok(!auth.verificarPassword("otraClave1", password_hash));
});

test("validarPassword exige 8+ caracteres con letras y números", () => {
  assert.ok(auth.validarPassword("corta1"));
  assert.ok(auth.validarPassword("solamenteletras"));
  assert.ok(auth.validarPassword("12345678"));
  assert.equal(auth.validarPassword("Rosa1234"), null);
});

test("validarEmail rechaza emails mal formados", () => {
  assert.ok(auth.validarEmail("ana@correo.com"));
  assert.ok(!auth.validarEmail("ana@correo"));
  assert.ok(!auth.validarEmail("sin-arroba.com"));
  assert.ok(!auth.validarEmail(undefined));
});

test("registrar crea la usuaria y no permite emails repetidos", () => {
  const db = nuevaDB();
  const u = auth.registrar(db, { nombre: "Ana", email: "Ana@Correo.com", password: "Clave1234" });
  assert.equal(u.email, "ana@correo.com");
  assert.throws(
    () => auth.registrar(db, { nombre: "Ana 2", email: "ana@correo.com", password: "Clave1234" }),
    { status: 409 },
  );
});

test("iniciarSesion entra con credenciales correctas y devuelve un token", () => {
  const db = nuevaDB();
  const { token, usuario } = auth.iniciarSesion(db, USUARIA_DEMO);
  assert.equal(usuario.email, USUARIA_DEMO.email);
  assert.equal(usuario.password_hash, undefined, "nunca se devuelve el hash");
  assert.deepEqual(auth.usuarioDeSesion(db, token), usuario);
});

test("iniciarSesion rechaza contraseña incorrecta con 401", () => {
  const db = nuevaDB();
  assert.throws(() => auth.iniciarSesion(db, { email: USUARIA_DEMO.email, password: "Mala1234" }), {
    status: 401,
  });
});

test("una inyección SQL en el email no permite entrar", () => {
  const db = nuevaDB();
  assert.throws(() => auth.iniciarSesion(db, { email: "' OR '1'='1", password: "x' OR '1'='1" }), {
    status: 401,
  });
});

test("tras 5 intentos fallidos se bloquea el login (429)", () => {
  const db = nuevaDB();
  for (let i = 0; i < auth.MAX_INTENTOS_FALLIDOS; i++) {
    assert.throws(() => auth.iniciarSesion(db, { email: USUARIA_DEMO.email, password: "Mala1234" }));
  }
  assert.throws(() => auth.iniciarSesion(db, USUARIA_DEMO), { status: 429 });
});

test("cerrarSesion invalida el token", () => {
  const db = nuevaDB();
  const { token } = auth.iniciarSesion(db, USUARIA_DEMO);
  auth.cerrarSesion(db, token);
  assert.equal(auth.usuarioDeSesion(db, token), null);
});

test("una sesión expirada ya no es válida", () => {
  const db = nuevaDB();
  const { token } = auth.iniciarSesion(db, USUARIA_DEMO);
  db.prepare("UPDATE sesiones SET expira_en = ? WHERE token = ?").run(Date.now() - 1, token);
  assert.equal(auth.usuarioDeSesion(db, token), null);
});
