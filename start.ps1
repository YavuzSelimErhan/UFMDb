# UFMDb - Backend ve Frontend'i tek komutla başlatır
# Kullanım: PowerShell'de bu dosyanın bulunduğu klasörden -> .\start.ps1

$root = $PSScriptRoot

Write-Host "UFMDb Backend baslatiliyor (yeni pencere)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; dotnet run --project src/UFMDb.API"

Start-Sleep -Seconds 2

Write-Host "UFMDb Frontend baslatiliyor (yeni pencere)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Ikisi de ayri pencerelerde acildi:" -ForegroundColor Green
Write-Host "  Backend  -> https://localhost:7001/swagger"
Write-Host "  Frontend -> http://localhost:5173"
