#!/usr/bin/env bash
# Start the Pilates store on macOS or Linux:  bash start-mac-linux.sh
set -e
cd "$(dirname "$0")/backend"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
echo "Shop:  http://127.0.0.1:5000"
echo "Admin: http://127.0.0.1:5000/admin"
python app.py
