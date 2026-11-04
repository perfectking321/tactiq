# TactiQ one-time setup for Windows. Safe to re-run.
# Usage (from the project folder):  double-click setup.bat   or   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "tactiq-api"
$Web = Join-Path $Root "tactiq-frontend"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

Step "Checking Python (3.11 - 3.13) and Node.js (20.19+ or 22.12+)"
$py = $null
foreach ($cand in @(@("py", "-3.13"), @("py", "-3.12"), @("py", "-3.11"), @("python"))) {
    $exe = $cand[0]
    $pre = @($cand | Select-Object -Skip 1)
    try {
        $v = & $exe @pre -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $v -match '^3\.(11|12|13)$') { $py = $cand; break }
    } catch {}
}
if (-not $py) { Fail "Python 3.11-3.13 not found. Install from https://www.python.org/downloads/ (tick 'Add to PATH')." }
Write-Host "Python: $($py -join ' ') ($v)"
try { $node = (node --version) } catch { Fail "Node.js not found. Install the LTS version from https://nodejs.org/" }
Write-Host "Node: $node"

Step "Creating Python virtual environment (tactiq-api\.venv)"
$venvPy = Join-Path $Api ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    $pre = @($py | Select-Object -Skip 1)
    & $py[0] @pre -m venv (Join-Path $Api ".venv")
}
& $venvPy -m pip install --upgrade pip --quiet
Step "Installing Python packages (first time takes a few minutes - PyTorch is large)"
& $venvPy -m pip install -r (Join-Path $Api "requirements.txt") --quiet
if ($LASTEXITCODE -ne 0) { Fail "pip install failed." }

Step "Preparing configuration (.env)"
$envFile = Join-Path $Api ".env"
if (-not (Test-Path $envFile)) {
    $secret = & $venvPy -c "import secrets; print(secrets.token_urlsafe(48))"
    (Get-Content (Join-Path $Api ".env.example")) -replace '^JWT_SECRET=$', "JWT_SECRET=$secret" |
        Set-Content -Encoding utf8 $envFile
    Write-Host "Created tactiq-api\.env - open it and paste your Gemini key after GEMINI_API_KEY="
} else {
    Write-Host "tactiq-api\.env already exists - kept as is."
}

Step "Building the knowledge-base index (downloads the embedding model once if missing)"
Push-Location $Api
try {
    & $venvPy -m app.rag.ingest
    if ($LASTEXITCODE -ne 0) { Fail "Index build failed." }
} finally { Pop-Location }

Step "Installing frontend packages"
Push-Location $Web
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm ci failed." }
} finally { Pop-Location }

Step "Setup complete. Start TactiQ with start.bat (or scripts\start.ps1)."
$envText = Get-Content $envFile -Raw
if ($envText -notmatch 'GEMINI_API_KEY=\S') {
    Write-Host "Reminder: GEMINI_API_KEY is still empty in tactiq-api\.env - the AI coach needs it." -ForegroundColor Yellow
}
