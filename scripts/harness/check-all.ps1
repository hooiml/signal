$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "Running repo harness checks..."

& (Join-Path $PSScriptRoot "check-docs.ps1")
& (Join-Path $PSScriptRoot "check-commit-message.ps1")
& (Join-Path $PSScriptRoot "generate-repo-map.ps1") -Check
# Runtime-generated files must not make the committed map platform-dependent.
$profileFixture = Join-Path $root ("StartupProfileData-HarnessFixture-" + [guid]::NewGuid().ToString("N"))
try {
    [System.IO.File]::WriteAllText($profileFixture, "Temporary map-invariance fixture.")
    & (Join-Path $PSScriptRoot "generate-repo-map.ps1") -Check
}
finally {
    if (Test-Path -LiteralPath $profileFixture) { Remove-Item -LiteralPath $profileFixture }
}
& (Join-Path $PSScriptRoot "generate-repo-map.ps1") -Check
Write-Host "Map excludes temporary PowerShell startup profile files."
& (Join-Path $PSScriptRoot "check-file-size.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.2.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.3.ps1")
& (Join-Path $PSScriptRoot "check-learn-v0.4.ps1")
& (Join-Path $PSScriptRoot "check-research.ps1")
node (Join-Path $PSScriptRoot "research-currency-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Research currency regression failed with exit code $LASTEXITCODE" }
node (Join-Path $PSScriptRoot "market-request-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Market request regression failed with exit code $LASTEXITCODE" }
node (Join-Path $PSScriptRoot "market-assessment-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Market assessment regression failed with exit code $LASTEXITCODE" }

node (Join-Path $PSScriptRoot "research-trust-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Research trust regression failed with exit code $LASTEXITCODE" }

node (Join-Path $PSScriptRoot "security-search-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Security search regression failed with exit code $LASTEXITCODE" }

node (Join-Path $PSScriptRoot "research-improvements-regression.mjs")
if ($LASTEXITCODE -ne 0) { throw "Research improvements regression failed with exit code $LASTEXITCODE" }

Write-Host "Repo harness checks passed."
