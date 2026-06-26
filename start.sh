#!/usr/bin/env bash
# start.sh — arranca backend (FastAPI :8000) y frontend (Vite :5173) juntos.
# Referenciado en docs/09-operations.md. Ctrl-C detiene ambos.
set -euo pipefail

cd "$(dirname "$0")"

# Deps del backend (núcleo + verticales pesadas). Idempotente.
uv sync --extra devteam --extra secondbrain

# Backend en segundo plano; lo paramos al salir.
uv run uvicorn app:app --reload --port "${BACKEND_PORT:-8000}" &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM

# Frontend (instala deps la primera vez).
cd frontend
[ -d node_modules ] || npm install
npm run dev
