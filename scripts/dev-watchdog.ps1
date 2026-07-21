param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$WorkDir,
  [Parameter(Mandatory=$true)][string]$Command,
  [Parameter(Mandatory=$true)][int]$Port,
  [Parameter(Mandatory=$true)][string]$LogFile
)

# Detached, self-restarting runner for a single dev server.
# Launched hidden via Start-Process so it survives even after the
# terminal/session that started it is closed. If the underlying
# command exits (crash, uncaught exception, etc.) it is restarted
# automatically after a short delay, and every restart is logged.

Set-Location $WorkDir

function Write-Log($msg) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] [$Name] $msg"
}

Write-Log "watchdog started (pid=$PID) for port $Port"

while ($true) {
  $inUse = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  if ($inUse) {
    Write-Log "port $Port already in use by pid $($inUse.OwningProcess -join ',') - skipping start, retrying in 10s"
    Start-Sleep -Seconds 10
    continue
  }

  Write-Log "starting: $Command"
  cmd /c $Command *>> $LogFile
  $exitCode = $LASTEXITCODE
  Write-Log "process exited with code $exitCode - restarting in 3s"
  Start-Sleep -Seconds 3
}
