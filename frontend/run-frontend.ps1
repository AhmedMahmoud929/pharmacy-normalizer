# Run frontend in PRODUCTION mode (lighter than `pnpm dev` / `npm run dev`).
# Usage:
#   .\run-frontend.ps1              # install if needed, build, start
#   .\run-frontend.ps1 -Reinstall   # wipe node_modules + .next, fresh install
#   .\run-frontend.ps1 -SkipBuild   # start only (requires existing .next build)

param(
    [switch]$Reinstall,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Limit Node memory to reduce laptop freeze from swapping
$env:NODE_OPTIONS = "--max-old-space-size=2048"

if ($Reinstall) {
    Write-Host "Removing node_modules and .next ..."
    Remove-Item -Recurse -Force node_modules, .next -ErrorAction SilentlyContinue
}

if (-not (Test-Path node_modules)) {
    Write-Host "Installing dependencies with npm (one time) ..."
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$buildId = Join-Path ".next" "BUILD_ID"
if (-not $SkipBuild -and -not (Test-Path $buildId)) {
    Write-Host "Building production bundle (2-5 min, CPU will spike briefly) ..."
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Frontend: http://localhost:3005"
Write-Host "Mode: production (no hot reload, much lighter than dev)"
Write-Host "Stop with Ctrl+C"
Write-Host ""

npm run start
