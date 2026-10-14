// Servidor HTTP: API del login + archivos estáticos del frontend.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { abrirBaseDeDatos } = require("./db");
const { ErrorAuth, registrar, iniciarSesion, usuarioDeSesion, cerrarSesion } = require("./auth");

const FRONTEND = path.resolve(__dirname, "..", "..", "frontend");
const TIPOS = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
const COOKIE = "sid";

function responderJSON(res, status, datos, cabeceras = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...cabeceras });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let cuerpo = "";
    req.on("data", (trozo) => {
      cuerpo += trozo;
      if (cuerpo.length > 10_000) reject(new ErrorAuth("Petición demasiado grande", 413));
    });
    req.on("end", () => {
      try {
        resolve(cuerpo ? JSON.parse(cuerpo) : {});
      } catch {
        reject(new ErrorAuth("JSON inválido", 400));
      }
    });
  });
}

function leerToken(req) {
  const cookies = req.headers.cookie || "";
  const par = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return par ? par.slice(COOKIE.length + 1) : null;
}

function cookieSesion(token, maxAge) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function servirEstatico(req, res) {
  const pedido = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const archivo = path.join(FRONTEND, pedido === "/" ? "index.html" : pedido);
  if (!archivo.startsWith(FRONTEND + path.sep)) return responderJSON(res, 403, { error: "Prohibido" });
  fs.readFile(archivo, (error, contenido) => {
    if (error) return responderJSON(res, 404, { error: "No encontrado" });
    res.writeHead(200, { "Content-Type": `${TIPOS[path.extname(archivo)] || "text/plain"}; charset=utf-8` });
    res.end(contenido);
  });
}

function crearServidor(db = abrirBaseDeDatos()) {
  return http.createServer(async (req, res) => {
    const ruta = new URL(req.url, "http://x").pathname;
    try {
      if (req.method === "POST" && ruta === "/api/register") {
        const usuario = registrar(db, await leerCuerpo(req));
        return responderJSON(res, 201, { usuario });
      }
      if (req.method === "POST" && ruta === "/api/login") {
        const { token, usuario } = iniciarSesion(db, await leerCuerpo(req));
        return responderJSON(res, 200, { usuario }, { "Set-Cookie": cookieSesion(token, 7200) });
      }
      if (req.method === "GET" && ruta === "/api/me") {
        const usuario = usuarioDeSesion(db, leerToken(req));
        if (!usuario) return responderJSON(res, 401, { error: "No has iniciado sesión" });
        return responderJSON(res, 200, { usuario });
      }
      if (req.method === "POST" && ruta === "/api/logout") {
        const token = leerToken(req);
        if (token) cerrarSesion(db, token);
        return responderJSON(res, 200, { ok: true }, { "Set-Cookie": cookieSesion("", 0) });
      }
      if (ruta.startsWith("/api/")) return responderJSON(res, 404, { error: "Ruta no encontrada" });
      if (req.method === "GET") return servirEstatico(req, res);
      return responderJSON(res, 405, { error: "Método no permitido" });
    } catch (error) {
      if (error instanceof ErrorAuth) return responderJSON(res, error.status, { error: error.message });
      console.error(error);
      return responderJSON(res, 500, { error: "Error interno del servidor" });
    }
  });
}

if (require.main === module) {
  const puerto = Number(process.env.PORT) || 3000;
  crearServidor().listen(puerto, () => console.log(`🌸 Login rosa en http://localhost:${puerto}`));
}

module.exports = { crearServidor };
