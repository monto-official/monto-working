# Starts all Monto AI local dev servers as detached, self-restarting
# processes that do NOT depend on this terminal/session staying open.
# Safe to re-run: it skips any service whose port is already listening.

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$services = @(
  # 0.0.0.0 (not 127.0.0.1) so phones on the same LAN - e.g. the parent-app
  # APK, which is built pointing at this machine's LAN IP - can reach it.
  @{ Name = "backend";    WorkDir = Join-Path $root "backend";    Command = ".\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"; Port = 8000 },
  @{ Name = "frontend";   WorkDir = Join-Path $root "frontend";   Command = "npm run dev";                    Port = 3000 },
  @{ Name = "parent-app"; WorkDir = Join-Path $root "parent-app"; Command = "npm run dev";                    Port = 3001 },
  @{ Name = "admin";      WorkDir = Join-Path $root "admin";      Command = "npm run dev";                    Port = 3002 }
)

foreach ($svc in $services) {
  $logFile = Join-Path $logDir "$($svc.Name).log"
  $watchdog = Join-Path $PSScriptRoot "dev-watchdog.ps1"

  $existing = Get-NetTCPConnection -State Listen -LocalPort $svc.Port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "[$($svc.Name)] port $($svc.Port) already listening (pid $($existing.OwningProcess -join ',')) - leaving as is"
    continue
  }

  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$watchdog`"",
    "-Name", $svc.Name, "-WorkDir", "`"$($svc.WorkDir)`"",
    "-Command", "`"$($svc.Command)`"", "-Port", $svc.Port, "-LogFile", "`"$logFile`""
  )
  Write-Host "[$($svc.Name)] launched detached watchdog -> log: $logFile"
}

# NOTE: the Cloudflare quick tunnel is NOT auto-started here anymore.
# This ISP's DNS resolver was unreliable for trycloudflare.com subdomains,
# causing spurious OFFLINE status in the child app even when the tunnel
# and backend were both healthy - so local dev now points frontend/.env
# straight at http://localhost:8000. For phone/external-network pairing
# testing, run cloudflared-watchdog.ps1 explicitly:
#   powershell -File scripts\cloudflared-watchdog.ps1 -EnvFile frontend\.env -LogFile logs\cloudflared.log
