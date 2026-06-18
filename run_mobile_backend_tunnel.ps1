param(
  [int]$Port = 8000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Backend Tunnel for Mobile Access" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$cloudflaredPath = Join-Path $PSScriptRoot "tools\cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
  $cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cloudflaredCmd) {
    $cloudflaredPath = $cloudflaredCmd.Source
  } else {
    Write-Host "ERROR: cloudflared not found." -ForegroundColor Red
    Write-Host "Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "Tunneling Backend from http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "This will provide a public URL for mobile access" -ForegroundColor Green
Write-Host "You'll see the tunnel URL in the output below" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $cloudflaredPath tunnel --url "http://127.0.0.1:$Port"

