# Start the TactiQ API (port 8000) and web app (port 5173) in two windows, then open the browser.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "tactiq-api"
$Web = Join-Path $Root "tactiq-frontend"
$venvPy = Join-Path $Api ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy) -or -not (Test-Path (Join-Path $Web "node_modules"))) {
    Write-Host "TactiQ is not set up on this computer yet. Run setup.bat first." -ForegroundColor Red
    exit 1
}

Start-Process powershell -WorkingDirectory $Api -ArgumentList @(
    "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TactiQ API'; & '$venvPy' -m uvicorn app.main:app --port 8000"
)
Start-Process powershell -WorkingDirectory $Web -ArgumentList @(
    "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='TactiQ Web'; npm run dev"
)

Write-Host "Starting... the app will open at http://localhost:5173 (close the two windows to stop it)."
Start-Sleep -Seconds 6
Start-Process "http://localhost:5173"
