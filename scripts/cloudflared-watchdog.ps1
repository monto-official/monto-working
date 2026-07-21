param(
  [string]$CloudflaredExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  [Parameter(Mandatory=$true)][string]$EnvFile,
  [Parameter(Mandatory=$true)][string]$LogFile,
  [int]$FrontendPort = 3000
)

# Detached, self-restarting runner for the cloudflared quick tunnel that
# exposes the local backend (:8000) to the internet.
#
# Quick tunnels (trycloudflare.com) get a BRAND NEW random URL every time
# the process (re)starts - there is no stable URL. So every time this loop
# restarts the tunnel, it parses the fresh URL out of cloudflared's own
# output, writes it into frontend/.env's NEXT_PUBLIC_API_URL, and bounces
# the frontend dev server (killing its port so the frontend's own watchdog
# restarts it) so the new URL actually takes effect - Next.js only reads
# NEXT_PUBLIC_* vars at dev-server startup.
#
# cloudflared.exe is invoked directly (not via cmd.exe /c) with native
# -RedirectStandardOutput/-RedirectStandardError, because passing a quoted
# "C:\Program Files (x86)\..." path through Start-Process -ArgumentList as
# a cmd.exe command-line string silently mangles the quoting and cmd fails
# with "'C:\Program' is not recognized".

function Write-Log($msg) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] [cloudflared] $msg"
}

Write-Log "watchdog started (pid=$PID)"

while ($true) {
  $stdoutTmp = [System.IO.Path]::GetTempFileName()
  $stderrTmp = [System.IO.Path]::GetTempFileName()
  Write-Log "starting tunnel -> http://localhost:8000"
  $proc = Start-Process -FilePath $CloudflaredExe -ArgumentList @("tunnel", "--url", "http://localhost:8000") `
    -RedirectStandardOutput $stdoutTmp -RedirectStandardError $stderrTmp -NoNewWindow -PassThru

  $url = $null
  $deadline = (Get-Date).AddSeconds(30)
  while (-not $url -and (Get-Date) -lt $deadline -and -not $proc.HasExited) {
    Start-Sleep -Seconds 1
    $combined = (Get-Content $stderrTmp -Raw -ErrorAction SilentlyContinue) + (Get-Content $stdoutTmp -Raw -ErrorAction SilentlyContinue)
    if ($combined -match "(https://[a-z0-9-]+\.trycloudflare\.com)") { $url = $matches[1] }
  }

  # Fold the tunnel's own output into the persistent watchdog log for later debugging.
  Get-Content $stderrTmp -ErrorAction SilentlyContinue | Add-Content -Path $LogFile
  Get-Content $stdoutTmp -ErrorAction SilentlyContinue | Add-Content -Path $LogFile

  if ($url) {
    Write-Log "detected tunnel URL: $url"
    if (Test-Path $EnvFile) {
      $envContent = Get-Content $EnvFile -Raw
      if ($envContent -match "NEXT_PUBLIC_API_URL=(\S*)") {
        $current = $matches[1]
        if ($current -ne $url) {
          $updated = $envContent -replace "NEXT_PUBLIC_API_URL=\S*", "NEXT_PUBLIC_API_URL=$url"
          Set-Content -Path $EnvFile -Value $updated -NoNewline
          Write-Log "updated $EnvFile ($current -> $url), bouncing frontend so it picks up the new URL"
          $fe = Get-NetTCPConnection -State Listen -LocalPort $FrontendPort -ErrorAction SilentlyContinue
          foreach ($f in $fe) { Stop-Process -Id $f.OwningProcess -Force -ErrorAction SilentlyContinue }
        } else {
          Write-Log "URL unchanged, no restart needed"
        }
      }
    }
  } else {
    Write-Log "WARNING: could not detect tunnel URL within 30s"
  }

  Remove-Item $stdoutTmp, $stderrTmp -ErrorAction SilentlyContinue
  Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue
  Write-Log "tunnel process exited - restarting in 3s"
  Start-Sleep -Seconds 3
}
