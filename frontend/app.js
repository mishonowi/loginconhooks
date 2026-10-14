// Lógica del frontend: alterna login/registro y habla con la API del backend.
const $ = (id) => document.getElementById(id);
let modoRegistro = false;

async function api(ruta, datos) {
  const res = await fetch(ruta, {
    method: datos ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cuerpo.error || "Algo salió mal");
  return cuerpo;
}

function mostrarMensaje(texto, ok = false) {
  $("mensaje").textContent = texto;
  $("mensaje").classList.toggle("ok", ok);
}

function cambiarModo() {
  modoRegistro = !modoRegistro;
  $("campo-nombre").hidden = !modoRegistro;
  $("titulo").textContent = modoRegistro ? "Crea tu cuenta" : "¡Hola de nuevo!";
  $("subtitulo").textContent = modoRegistro ? "Solo te toma un minuto" : "Inicia sesión para continuar";
  $("boton").textContent = modoRegistro ? "Registrarme" : "Entrar";
  $("texto-cambiar").textContent = modoRegistro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  $("cambiar").textContent = modoRegistro ? "Inicia sesión" : "Regístrate";
  mostrarMensaje("");
}

function mostrarBienvenida(usuario) {
  $("vista-acceso").hidden = !!usuario;
  $("vista-bienvenida").hidden = !usuario;
  if (usuario) {
    $("nombre-usuario").textContent = usuario.nombre;
    $("email-usuario").textContent = usuario.email;
  }
}

$("formulario").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(evento.target));
  $("boton").disabled = true;
  try {
    if (modoRegistro) {
      await api("/api/register", datos);
      cambiarModo();
      mostrarMensaje("¡Cuenta creada! Ahora inicia sesión 🌷", true);
    } else {
      const { usuario } = await api("/api/login", { email: datos.email, password: datos.password });
      evento.target.reset();
      mostrarBienvenida(usuario);
    }
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    $("boton").disabled = false;
  }
});

$("cambiar").addEventListener("click", cambiarModo);

$("salir").addEventListener("click", async () => {
  await api("/api/logout", {});
  mostrarMensaje("");
  mostrarBienvenida(null);
});

// Si ya hay sesión (cookie), entra directo.
api("/api/me")
  .then(({ usuario }) => mostrarBienvenida(usuario))
  .catch(() => mostrarBienvenida(null));
