$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outRoot = Join-Path $repoRoot ".tmp\learn-v0.3-tests"
$runId = "$PID-$([guid]::NewGuid().ToString('N'))"
$outDir = Join-Path $outRoot $runId

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc --target ES2022 --module CommonJS --moduleResolution node --esModuleInterop --skipLibCheck --strict --types node,next --rootDir . --outDir $outDir --noEmit false scripts/harness/learn-v0.3-regression.ts src/lib/learn/v0-3.ts
    if ($LASTEXITCODE -ne 0) { throw "Signal Learn v0.3 compilation failed with exit code $LASTEXITCODE" }

    node (Join-Path $outDir "scripts\harness\learn-v0.3-regression.js")
    if ($LASTEXITCODE -ne 0) { throw "Signal Learn v0.3 regression failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
    if (Test-Path $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }
}
