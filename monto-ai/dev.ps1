# Monto AI - Local Dev Script
# Run from project root: .\monto-ai\dev.ps1

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Venv     = "C:\monto-venv"
$Python   = "$Venv\Scripts\python.exe"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Monto AI - Local Dev" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── Check / create venv ───────────────────────────
if (-not (Test-Path $Python)) {
    Write-Host "[SETUP] Creating Python venv at $Venv..." -ForegroundColor Yellow
    python -m venv $Venv
}

# ── Install backend deps ──────────────────────────
Write-Host "[SETUP] Checking backend dependencies..." -ForegroundColor Yellow
& $Python -m pip install -q -r "$Backend\requirements.txt"

# ── Install frontend deps ─────────────────────────
if (-not (Test-Path "$Frontend\node_modules")) {
    Write-Host "[SETUP] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $Frontend
    npm install
    Pop-Location
}

# ── Start backend ─────────────────────────────────
Write-Host "[START] Backend  -> http://localhost:8000" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; & '$Python' -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

# Small delay so backend initialises first
Start-Sleep -Seconds 2

# ── Start frontend ────────────────────────────────
Write-Host "[START] Frontend -> http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Frontend'; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both servers are running in separate windows." -ForegroundColor Gray
Write-Host "Close those windows to stop the servers." -ForegroundColor Gray
Write-Host ""
