# Create a clean zip of TactiQ to copy to another computer.
# Leaves out machine-specific folders (.venv, node_modules, caches) - setup.bat rebuilds them there.
# Keeps: source code, knowledge base, embedding model (no re-download), search index, database and .env.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\pack.ps1 [-NoData] [-NoEnv]
#   -NoData  leave out tactiq.db (start with an empty database on the new laptop)
#   -NoEnv   leave out tactiq-api\.env (contains your Gemini key - use this if sharing the zip)
param([switch]$NoData, [switch]$NoEnv)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Parent = Split-Path -Parent $Root
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$Zip = Join-Path $Parent "TactiQ_$Stamp.zip"

$excludeDirs = @(".venv", "node_modules", "__pycache__", ".pytest_cache", "dist", ".idea", ".vscode")
$excludeFiles = @()
if ($NoData) { $excludeFiles += "tactiq.db" }
if ($NoEnv) { $excludeFiles += ".env" }

$staging = Join-Path ([System.IO.Path]::GetTempPath()) "tactiq_pack_$Stamp"
New-Item -ItemType Directory -Force $staging | Out-Null
$dest = Join-Path $staging "TACTIQ"

Write-Host "Copying project (skipping: $($excludeDirs -join ', ') $($excludeFiles -join ' '))..."
$robolog = robocopy $Root $dest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy code $LASTEXITCODE)" }

Write-Host "Compressing to $Zip ..."
Compress-Archive -Path $dest -DestinationPath $Zip -Force
Remove-Item -Recurse -Force $staging

$sizeMb = [math]::Round((Get-Item $Zip).Length / 1MB, 1)
Write-Host "`nDone: $Zip ($sizeMb MB)" -ForegroundColor Green
Write-Host "On the new laptop: unzip, then double-click setup.bat, then start.bat."
if (-not $NoEnv) { Write-Host "Note: the zip contains tactiq-api\.env with your Gemini key - do not share it publicly." -ForegroundColor Yellow }
