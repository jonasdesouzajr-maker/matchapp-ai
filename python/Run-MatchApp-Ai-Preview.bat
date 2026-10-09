@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -Command "try { $r=Invoke-WebRequest 'http://127.0.0.1:8899/' -UseBasicParsing -TimeoutSec 2; if ($r.Content -match 'Immersive Python Preview') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:8899/"
  exit /b 0
)
where python >nul 2>&1
if errorlevel 1 (py -u app.py --port 8899) else (python -u app.py --port 8899)
pause
