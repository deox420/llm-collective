#!/usr/bin/env bash
# start.sh — arranca el backend (FastAPI) y el frontend (Vite) juntos.
#
# Referenciado en docs/09-operations.md. Cumple NFR-9 (arranca sin pasos manuales
# extra). Para de ambos procesos con Ctrl-C.
#
#   ./start.sh            # backend :8000 + frontend :5173
#   ./start.sh --backend  # solo backend
set -euo pipefail

cd "$(dirname "$0")"

BACKEND_ONLY=0
[[ "${1:-}" == "--backend" ]] && BACKEND_ONLY=1

# --- backend ---------------------------------------------------------------
# Usa uv si está disponible (gestor recomendado); si no, asume el venv activo.
if command -v uv >/dev/null 2>&1; then
  RUN="uv run"
else
  RUN=""
  echo "[start] uv no encontrado; usando el python del entorno activo." >&2
fi

echo "[start] backend en http://localhost:8000  (/health, /api/health)"
$RUN uvicorn app:app --reload --port 8000 &
BACKEND_PID=$!

cleanup() {
  echo
  echo "[start] parando…"
  kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- frontend --------------------------------------------------------------
if [[ "$BACKEND_ONLY" -eq 0 ]]; then
  if [[ -d frontend/node_modules ]]; then
    echo "[start] frontend en http://localhost:5173  (proxy /api → :8000)"
    (cd frontend && npm run dev) &
    FRONTEND_PID=$!
  else
    echo "[start] frontend sin dependencias: corre 'cd frontend && npm install' primero." >&2
    echo "[start] (arrancando solo el backend)" >&2
  fi
fi

wait
