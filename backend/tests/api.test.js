// Pruebas de la API HTTP de punta a punta (servidor real en un puerto libre).
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearServidor } = require("../src/server");
const { abrirBaseDeDatos, USUARIA_DEMO } = require("../src/db");

let servidor;
let base;

test.before(async () => {
  servidor = crearServidor(abrirBaseDeDatos(":memory:"));
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(() => servidor.close());

const post = (ruta, cuerpo, cookie) =>
  fetch(base + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(cuerpo),
  });

test("GET / sirve el frontend", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<form/);
});

test("no se puede leer archivos fuera del frontend", async () => {
  const res = await fetch(base + "/..%2fbackend%2fsrc%2fauth.js");
  assert.notEqual(res.status, 200);
});

test("flujo completo: registro → login → /api/me → logout", async () => {
  let res = await post("/api/register", { nombre: "Lola", email: "lola@rosa.com", password: "Lola1234" });
  assert.equal(res.status, 201);

  res = await post("/api/login", { email: "lola@rosa.com", password: "Lola1234" });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  assert.match(res.headers.get("set-cookie"), /HttpOnly/);

  res = await fetch(base + "/api/me", { headers: { Cookie: cookie } });
  assert.equal((await res.json()).usuario.nombre, "Lola");

  res = await post("/api/logout", {}, cookie);
  assert.equal(res.status, 200);

  res = await fetch(base + "/api/me", { headers: { Cookie: cookie } });
  assert.equal(res.status, 401);
});

test("login con contraseña incorrecta responde 401 con mensaje", async () => {
  const res = await post("/api/login", { email: USUARIA_DEMO.email, password: "Mala1234" });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, "Email o contraseña incorrectos");
});

test("JSON inválido responde 400", async () => {
  const res = await fetch(base + "/api/login", { method: "POST", body: "{no es json" });
  assert.equal(res.status, 400);
});
