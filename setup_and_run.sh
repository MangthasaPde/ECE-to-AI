#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PYTHON="${GAUNTLET_PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "Install Python 3.11 or 3.12 from python.org, then rerun this command."; exit 1
fi
"$PYTHON" -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11+ is required; Python 3.12 recommended"'
if [ ! -d .venv ]; then "$PYTHON" -m venv .venv; fi
source .venv/bin/activate
if [ ! -f .venv/.requirements-installed ] || ! cmp -s requirements.txt .venv/.requirements-installed; then
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
  cp requirements.txt .venv/.requirements-installed
fi
mkdir -p workspace data
if [ ! -f .env ]; then cp .env.example .env; fi
echo ""
echo "ECE-to-AI: THE GAUNTLET"
echo "Open http://localhost:8000  |  Ctrl+C to stop"
echo "Edit quest files inside $(pwd)/workspace"
echo "Verification runs your Python as your Mac user. Run only code you trust."
echo ""
exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
