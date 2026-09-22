# Developer startup script for Student Financial Copilot
param (
    [switch]$Backend,
    [switch]$Frontend
)

if ($Backend) {
    Write-Host "Starting Backend FastAPI on http://127.0.0.1:8000..." -ForegroundColor Cyan
    $env:PYTHONPATH="backend"
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
} elseif ($Frontend) {
    Write-Host "Starting Frontend Vite dev server on http://localhost:5173..." -ForegroundColor Cyan
    Push-Location frontend
    npm run dev
    Pop-Location
} else {
    Write-Host "Student Financial Copilot - Development Helper" -ForegroundColor Green
    Write-Host "Usage:"
    Write-Host "  .\scripts\dev.ps1 -Backend   # Start FastAPI server on port 8000"
    Write-Host "  .\scripts\dev.ps1 -Frontend  # Start Vite dev server on port 5173"
    Write-Host "  docker compose up            # Start complete stack (DB + Backend + Frontend)"
}
