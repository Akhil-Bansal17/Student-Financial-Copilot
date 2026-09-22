Write-Host "=== Running Backend Tests (Pytest) ===" -ForegroundColor Cyan
$env:PYTHONPATH="backend"
python -m pytest backend/tests
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend tests failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Running Frontend Tests (Vitest) ===" -ForegroundColor Cyan
Push-Location frontend
npm run test -- --run
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend tests failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n=== Running Frontend Build Check (tsc + vite build) ===" -ForegroundColor Cyan
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`nAll tests and build checks passed successfully!" -ForegroundColor Green
