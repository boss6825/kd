#!/usr/bin/env bash
# Idempotent Cloud Agent install for KD.
#
# Prepares the repository so both apps can run:
#   - LibreOffice (soffice) for DOC/DOCX -> PDF conversion (backend/src/lib/convert.ts)
#   - backend + frontend npm dependencies
#   - local env files seeded from the committed examples (they are gitignored,
#     so a fresh checkout has none). The examples ship working demo values.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# --- System dependency: LibreOffice (headless doc conversion) ----------------
if ! command -v soffice >/dev/null 2>&1; then
  echo "[install] Installing LibreOffice (soffice) for document conversion..."
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libreoffice-writer
else
  echo "[install] LibreOffice already present: $(soffice --version | head -1)"
fi

# --- App dependencies --------------------------------------------------------
echo "[install] Installing backend dependencies..."
npm install --prefix backend

echo "[install] Installing frontend dependencies..."
npm install --prefix frontend

# --- Local env files (gitignored; seed from committed examples) --------------
if [[ ! -f backend/.env ]]; then
  echo "[install] Seeding backend/.env from backend/.env.example"
  cp backend/.env.example backend/.env
fi

if [[ ! -f frontend/.env.local ]]; then
  echo "[install] Seeding frontend/.env.local from frontend/.env.local.example"
  cp frontend/.env.local.example frontend/.env.local
fi

echo "[install] Done."
