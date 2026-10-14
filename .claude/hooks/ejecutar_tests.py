"""HOOK 3 · PostToolUse (Edit|Write)
Después de CADA edición al código del login (backend, frontend o schema.sql)
ejecuta las pruebas del backend automáticamente con `node --test`.

Si fallan → exit 2: el resultado le llega a Claude, que se corrige solo.
Si pasan  → exit 0 + JSON con "systemMessage": el usuario ve un aviso verde.
"""
import json
import os
import re
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

datos = json.loads(sys.stdin.buffer.read().decode("utf-8"))
ruta = datos.get("tool_input", {}).get("file_path", "").replace("\\", "/")

if not (ruta.endswith((".js", ".html", ".sql")) and re.search(r"/(backend|frontend|database)/", ruta)):
    sys.exit(0)  # No es código del login: no hay nada que probar

backend = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), "backend")
resultado = subprocess.run(
    [shutil.which("node") or "node", "--test"],
    cwd=backend,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
    timeout=50,
)
salida = (resultado.stdout + resultado.stderr).strip()
total = re.search(r"tests (\d+)", salida)
pasaron = re.search(r"pass (\d+)", salida)

if resultado.returncode != 0:
    print(
        "❌ El hook ejecutó las pruebas del login después de tu cambio y FALLARON.\n"
        "Revisa el error y corrige el código (las pruebas no se pueden modificar):\n\n"
        + salida[-3000:],
        file=sys.stderr,
    )
    sys.exit(2)

resumen = f"{pasaron.group(1) if pasaron else '?'}/{total.group(1) if total else '?'} pruebas OK"
print(json.dumps({"systemMessage": f"✅ Hook de pruebas del login: {resumen}"}, ensure_ascii=False))
sys.exit(0)
