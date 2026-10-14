# 🌸 Login con Hooks

Mini login rosa con **frontend**, **backend** y una pequeña **base de datos**, protegido por
**hooks de Claude Code** adaptados de [Jhosep2022/hooks](https://github.com/Jhosep2022/hooks).

No necesita `npm install`: usa solo módulos nativos de Node.js (`node:http`, `node:sqlite`, `node:crypto`, `node:test`).

## Estructura

```
backend/          API en Node.js (sin dependencias)
  src/server.js   servidor HTTP + archivos estáticos del frontend
  src/auth.js     reglas del login: validaciones, hash scrypt, sesiones, bloqueo por intentos
  src/db.js       conexión SQLite, aplica schema.sql y crea la usuaria demo
  tests/          pruebas con node:test (PROTEGIDAS por los hooks)
frontend/         HTML + CSS rosa + JS
database/
  schema.sql      tablas: usuarios, sesiones, intentos_login
  login.db        se crea sola al arrancar (ignorada por git)
.claude/
  settings.json   registro de los hooks
  hooks/          los 4 hooks en Python
  agents/         subagentes: revisor, generador de tests, depurador, documentador
hooks/verificar_push.py   corre las pruebas antes de cualquier git push
```

## Cómo ejecutarlo

Requisitos: Node.js 22.13+ (para `node:sqlite`) y Python 3 (para los hooks).

```bash
cd backend
npm start      # → http://localhost:3000
npm test       # 16 pruebas
```

Usuaria demo: **rosa@demo.com** / **Rosa1234**

## API

| Método | Ruta            | Cuerpo                          | Respuesta                                  |
|--------|-----------------|---------------------------------|--------------------------------------------|
| POST   | `/api/register` | `{ nombre, email, password }`   | 201 `{ usuario }` · 400 inválido · 409 email repetido |
| POST   | `/api/login`    | `{ email, password }`           | 200 `{ usuario }` + cookie `sid` · 401 · 429 |
| GET    | `/api/me`       | — (cookie `sid`)                | 200 `{ usuario }` · 401                    |
| POST   | `/api/logout`   | — (cookie `sid`)                | 200 `{ ok: true }`                         |

## Reglas del login

- Contraseña: mínimo 8 caracteres, con letras y números. Se guarda con **scrypt + sal**, nunca en texto plano.
- Email único (sin distinguir mayúsculas).
- 5 intentos fallidos en 15 minutos → login bloqueado (429).
- La sesión dura 2 horas y viaja en una cookie `HttpOnly; SameSite=Strict`.
- Todo el SQL usa consultas parametrizadas (`?`).

## Hooks (adaptados del repo de ejemplo)

| # | Evento | Archivo | Qué hace en este login |
|---|--------|---------|------------------------|
| 1 | `PreToolUse` Edit\|Write | `proteger_archivos.py` | Bloquea editar `backend/tests/`, archivos `.env` y la base de datos (`*.db`) |
| 2 | `PreToolUse` Bash\|PowerShell | `bloquear_comandos.py` | Bloquea `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `DELETE FROM usuarios` sin `WHERE` y borrar `login.db`. Antes de un `git push` corre las pruebas y bloquea si fallan |
| 3 | `PostToolUse` Edit\|Write | `ejecutar_tests.py` | Tras editar `.js`/`.html`/`.sql` del login corre `node --test`; si falla, Claude recibe el error y se corrige solo |
| 4 | `PostToolUse` * + `SubagentStop` | `auditoria.py` | Registra cada acción en `.claude/auditoria.log` |

Diferencias con el repo de ejemplo: las pruebas son de Node (`node --test` en `backend/`) en vez de
`unittest` en `proyecto-demo/`, se protege también la base de datos y se bloquean borrados masivos de usuarias.

Los hooks se activan solos al abrir esta carpeta con Claude Code. GitHub Actions (`.github/workflows/tests.yml`)
corre las mismas pruebas en cada push.

### Probar un hook a mano

```bash
echo '{"tool_input":{"command":"git push --force"}}' | python .claude/hooks/bloquear_comandos.py
```
