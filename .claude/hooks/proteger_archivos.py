"""HOOK 1 · PreToolUse (Edit|Write)
Bloquea cualquier intento de modificar las pruebas del login, los secretos o la base de datos.

Entrada (stdin): JSON con tool_name y tool_input.file_path
Salida:  exit 0 → se permite  |  exit 2 → se BLOQUEA y el mensaje de stderr le llega a Claude
"""
import json
import sys

sys.stderr.reconfigure(encoding="utf-8")

datos = json.loads(sys.stdin.buffer.read().decode("utf-8"))
ruta = datos.get("tool_input", {}).get("file_path", "").replace("\\", "/")
nombre = ruta.rsplit("/", 1)[-1]

if "/backend/tests/" in ruta:
    print(
        f"⛔ BLOQUEADO por hook: '{nombre}' es una prueba del login y las pruebas están protegidas. "
        "Las pruebas definen las reglas del login (hash, validaciones, bloqueo por intentos): "
        "si una falla, corrige el código, no la prueba.",
        file=sys.stderr,
    )
    sys.exit(2)

if nombre.startswith(".env"):
    print(f"⛔ BLOQUEADO por hook: '{nombre}' contiene secretos y no se puede modificar.", file=sys.stderr)
    sys.exit(2)

if nombre.endswith((".db", ".sqlite", ".sqlite3", ".db-journal")):
    print(
        f"⛔ BLOQUEADO por hook: '{nombre}' es la base de datos de usuarias. "
        "No se edita a mano: cambia database/schema.sql o usa la API del backend.",
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
