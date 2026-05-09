$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "Running repo harness checks..."

& (Join-Path $PSScriptRoot "check-docs.ps1")
& (Join-Path $PSScriptRoot "generate-repo-map.ps1") -Check
& (Join-Path $PSScriptRoot "check-file-size.ps1")

Write-Host "Repo harness checks passed."

