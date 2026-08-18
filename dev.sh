#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not on PATH." >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/backend/node_modules" ]]; then
  echo "Warning: backend dependencies not installed. Run: npm install --prefix backend" >&2
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Warning: frontend dependencies not installed. Run: npm install --prefix frontend" >&2
fi

if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  echo "Warning: backend/.env not found. Copy backend/.env.example and configure it." >&2
fi

if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  echo "Warning: frontend/.env.local not found. Copy frontend/.env.local.example and configure it." >&2
fi

echo "Starting KD development servers..."
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:3006"
echo "Press Ctrl+C to stop both."
echo

trap 'kill 0' EXIT INT TERM

npm run dev --prefix backend &
npm run dev --prefix frontend &

wait
