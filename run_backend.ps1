Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Pothole Detection Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "Current Directory: $(Get-Location)" -ForegroundColor Yellow

# Activate virtual environment
$pythonPath = $null
if (Test-Path ".\.venv310\Scripts\Activate.ps1") {
  Write-Host "Activating .venv310..." -ForegroundColor Green
  & ".\.venv310\Scripts\Activate.ps1"
  $pythonPath = ".\.venv310\Scripts\python.exe"
} elseif (Test-Path ".\.venv\Scripts\Activate.ps1") {
  Write-Host "Activating .venv..." -ForegroundColor Green
  & ".\.venv\Scripts\Activate.ps1"
  $pythonPath = ".\.venv\Scripts\python.exe"
} else {
  Write-Host "No virtual environment found. Using system Python..." -ForegroundColor Yellow
  $pythonPath = "python"
}

Write-Host "Backend running at: http://localhost:8000" -ForegroundColor Green
Write-Host "API Docs at: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $pythonPath -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
