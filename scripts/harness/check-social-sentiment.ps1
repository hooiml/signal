$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $repoRoot ".tmp\social-sentiment-tests"

if (Test-Path $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc `
        --target ES2022 `
        --module CommonJS `
        --moduleResolution node `
        --esModuleInterop `
        --skipLibCheck `
        --strict `
        --rootDir . `
        --outDir $outDir `
        --noEmit false `
        scripts/harness/social-sentiment-regression.ts `
        src/lib/social-sentiment.ts

    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript compilation failed with exit code $LASTEXITCODE"
    }

    node ".tmp/social-sentiment-tests/scripts/harness/social-sentiment-regression.js"

    if ($LASTEXITCODE -ne 0) {
        throw "Social sentiment regression failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
    if (Test-Path $outDir) {
        Remove-Item -LiteralPath $outDir -Recurse -Force
    }
}
