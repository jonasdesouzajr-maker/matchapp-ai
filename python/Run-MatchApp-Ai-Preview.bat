@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (py -u app.py --port 8899) else (python -u app.py --port 8899)
pause
