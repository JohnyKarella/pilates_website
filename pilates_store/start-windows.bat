@echo off
REM Double-click to start the Pilates store on Windows.
cd /d "%~dp0backend"
if not exist .venv (
  echo Creating a virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate
pip install -q -r requirements.txt
echo.
echo Shop:  http://127.0.0.1:5000
echo Admin: http://127.0.0.1:5000/admin
echo Press Ctrl+C to stop.
python app.py
pause
