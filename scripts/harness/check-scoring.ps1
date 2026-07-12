$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $repoRoot ".tmp\scoring-tests"

if (Test-Path $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc `
        --target ES2020 `
        --module CommonJS `
        --moduleResolution node `
        --esModuleInterop `
        --skipLibCheck `
        --strict `
        --rootDir . `
        --outDir $outDir `
        --noEmit false `
        scripts/harness/scoring-regression.ts `
        src/lib/market-indicators.ts `
        src/lib/sentiment-calculator-v2.ts `
        src/lib/indicator-registry.ts `
        src/lib/signal-change.ts `
        src/lib/types/signal-v2.ts

    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript compilation failed with exit code $LASTEXITCODE"
    }

    node ".tmp/scoring-tests/scripts/harness/scoring-regression.js"

    if ($LASTEXITCODE -ne 0) {
        throw "Scoring regression failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
    if (Test-Path $outDir) {
        Remove-Item -LiteralPath $outDir -Recurse -Force
    }
    $tmpRoot = Join-Path $repoRoot ".tmp"
    if ((Test-Path $tmpRoot) -and -not (Get-ChildItem -LiteralPath $tmpRoot -Force)) {
        Remove-Item -LiteralPath $tmpRoot -Force
    }
}
