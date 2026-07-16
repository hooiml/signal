$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outRoot = Join-Path $repoRoot ".tmp\research-tests"
$runId = "$PID-$([guid]::NewGuid().ToString('N'))"
$outDir = Join-Path $outRoot $runId

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc --target ES2022 --module CommonJS --moduleResolution node --esModuleInterop --skipLibCheck --strict --types node,next --rootDir . --outDir $outDir --noEmit false scripts/harness/research-regression.ts src/lib/market-alerts.ts src/lib/research/alerts.ts src/lib/research/benchmark.ts src/lib/research/comparison.ts src/lib/research/decision.ts src/lib/research/discovery-filters.ts src/lib/research/discovery-history.ts src/lib/research/discovery-opportunity.ts src/lib/research/discovery-quality.ts src/lib/research/discovery-ranking.ts src/lib/research/discovery-score.ts src/lib/research/discovery-sectors.ts src/lib/research/input.ts src/lib/research/institutional-ownership.ts src/lib/research/records.ts src/lib/research/sec-edgar.ts src/lib/research/snapshot-input.ts src/lib/research/technical-outlook.ts src/lib/research/technical-series.ts src/lib/research/technicals.ts src/lib/research/valuation.ts src/lib/research/yahoo-research.ts src/lib/types/research.ts src/lib/types/research-alert.ts src/lib/types/research-discovery.ts src/lib/types/research-snapshot.ts src/lib/types/signal-v2.ts
    if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed with exit code $LASTEXITCODE" }

    $compiledEntry = Join-Path $outDir "scripts\harness\research-regression.js"
    node $compiledEntry
    if ($LASTEXITCODE -ne 0) { throw "Research regression failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
    if (Test-Path $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }
}
