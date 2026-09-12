$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "Running repo harness checks..."

& (Join-Path $PSScriptRoot "check-docs.ps1")
& (Join-Path $PSScriptRoot "check-commit-message.ps1")
& (Join-Path $PSScriptRoot "generate-repo-map.ps1") -Check
& (Join-Path $PSScriptRoot "check-file-size.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.2.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.3.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.4.ps1")
& (Join-Path $PSScriptRoot "check-research.ps1")
node (Join-Path $PSScriptRoot "market-request-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Market request regression failed with exit code $LASTEXITCODE" }

Write-Host "Repo harness checks passed."
