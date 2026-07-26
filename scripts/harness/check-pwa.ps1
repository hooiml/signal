$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outRoot = Join-Path $repoRoot ".tmp\pwa-tests"
$runId = "$PID-$([guid]::NewGuid().ToString('N'))"
$outDir = Join-Path $outRoot $runId

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $repoRoot
try {
    npx tsc --target ES2022 --module Node16 --moduleResolution Node16 --esModuleInterop --skipLibCheck --strict --types node,next --rootDir . --outDir $outDir --noEmit false scripts/harness/pwa-regression.ts src/lib/pwa/push-contract.ts src/lib/pwa/push-security.ts src/lib/pwa/push-payload.ts src/lib/pwa/push-delivery-policy.ts src/lib/research/backup.ts src/lib/research/sync-vault.ts src/lib/research/notification-delivery.ts src/lib/types/research-inbox.ts src/lib/types/research-notification-settings.ts
    if ($LASTEXITCODE -ne 0) { throw "PWA regression compilation failed with exit code $LASTEXITCODE" }

    $compiledEntry = Join-Path $outDir "scripts\harness\pwa-regression.js"
    node $compiledEntry
    if ($LASTEXITCODE -ne 0) { throw "PWA regression failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $outDir) { Remove-Item -LiteralPath $outDir -Recurse -Force }
}
