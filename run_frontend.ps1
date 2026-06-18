Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Pothole Detection Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$frontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendPath

Write-Host "Current Directory: $(Get-Location)" -ForegroundColor Yellow

# Get Python path
$pythonPath = $null
if (Test-Path "..\backend\.venv310\Scripts\python.exe") {
  $pythonPath = "..\backend\.venv310\Scripts\python.exe"
} elseif (Test-Path "..\backend\.venv\Scripts\python.exe") {
  $pythonPath = "..\backend\.venv\Scripts\python.exe"
} else {
  $pythonPath = "python"
}

Write-Host "Frontend running at: http://localhost:5501" -ForegroundColor Green
Write-Host "Open in browser: http://127.0.0.1:5501" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $pythonPath -m http.server 5501 --bind 127.0.0.1
