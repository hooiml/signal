$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $repoRoot ".tmp\research-tests"

if (Test-Path $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc --target ES2022 --module CommonJS --moduleResolution node --esModuleInterop --skipLibCheck --strict --types node,next --rootDir . --outDir $outDir --noEmit false scripts/harness/research-regression.ts src/lib/research/alerts.ts src/lib/research/decision.ts src/lib/research/discovery-history.ts src/lib/research/discovery-opportunity.ts src/lib/research/discovery-quality.ts src/lib/research/discovery-score.ts src/lib/research/discovery-sectors.ts src/lib/research/input.ts src/lib/research/records.ts src/lib/research/sec-edgar.ts src/lib/research/technicals.ts src/lib/research/valuation.ts src/lib/research/yahoo-research.ts src/lib/types/research.ts src/lib/types/research-alert.ts src/lib/types/research-discovery.ts
    if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed with exit code $LASTEXITCODE" }

    node ".tmp/research-tests/scripts/harness/research-regression.js"
    if ($LASTEXITCODE -ne 0) { throw "Research regression failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
    if (Test-Path $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }
}
