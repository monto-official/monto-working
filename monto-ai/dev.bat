@echo off
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set VENV=C:\monto-venv

echo.
echo ================================================
echo   Monto AI - Local Dev
echo ================================================
echo.

:: ── Check venv ────────────────────────────────────
if not exist "%VENV%\Scripts\python.exe" (
    echo [SETUP] Creating Python venv at %VENV%...
    python -m venv %VENV%
)

:: ── Install backend deps if needed ────────────────
echo [SETUP] Installing backend dependencies...
%VENV%\Scripts\pip install -q -r "%BACKEND%\requirements.txt"

:: ── Install frontend deps if needed ───────────────
if not exist "%FRONTEND%\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    cd /d "%FRONTEND%"
    npm install
)

:: ── Start backend in new window ───────────────────
echo [START] Backend  ^> http://localhost:8000
start "Monto Backend" cmd /k "cd /d %BACKEND% && %VENV%\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: ── Small delay so backend starts first ──────────
timeout /t 2 /nobreak >nul

:: ── Start frontend in new window ─────────────────
echo [START] Frontend ^> http://localhost:3000
start "Monto Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo ================================================
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo   Frontend : http://localhost:3000
echo ================================================
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.

endlocal
