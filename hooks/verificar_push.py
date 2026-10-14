"""Validación previa al push para los hooks de Claude Code; no ejecuta Git.
Antes de cualquier `git push` corre las pruebas del backend del login (node --test).
Si fallan o no hay pruebas → exit 2 y el push queda bloqueado.
"""
from pathlib import Path
import re
import shutil
import subprocess
import sys


def verificar_push(comando):
    # Incluye git push, git.exe push y opciones globales como git -C ruta push.
    if not re.search(r"\bgit(?:\.exe)?\b[^\r\n;&|]*\bpush\b", comando, re.IGNORECASE):
        return

    backend = Path(__file__).resolve().parents[1] / "backend"
    node = shutil.which("node")
    if not node:
        print("PUSH BLOQUEADO: no se encontró Node.js para ejecutar las pruebas.", file=sys.stderr)
        sys.exit(2)

    try:
        resultado = subprocess.run(
            [node, "--test"],
            cwd=backend,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=50,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        print(f"PUSH BLOQUEADO: no se pudieron verificar las pruebas: {error}", file=sys.stderr)
        sys.exit(2)

    salida = resultado.stdout + resultado.stderr
    if resultado.returncode != 0 or not re.search(r"tests [1-9]\d*", salida):
        print(
            "PUSH BLOQUEADO: las pruebas del login fallaron o no se encontraron pruebas.\n"
            "Corrige el código sin modificar los tests. Vuelve a ejecutar las pruebas, "
            "incluye las correcciones en un nuevo commit y reintenta el push.\n\n"
            + salida[-6000:],
            file=sys.stderr,
        )
        sys.exit(2)

    print("Hook previo al push: pruebas del login aprobadas; se permite continuar.", file=sys.stderr)
