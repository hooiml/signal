param(
    [string]$BaseUrl = $(if ($env:SIGNAL_BASE_URL) { $env:SIGNAL_BASE_URL } else { 'http://localhost:3000' }),
    [string]$Secret = $(if ($env:ADMIN_SECRET) { $env:ADMIN_SECRET } else { $env:CRON_SECRET })
)

$ErrorActionPreference = 'Stop'

if (-not $Secret -and $BaseUrl -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$' -and (Test-Path -LiteralPath '.env.local')) {
    $secretLine = Get-Content -LiteralPath '.env.local' |
        Where-Object { $_ -match '^(ADMIN_SECRET|CRON_SECRET)=' } |
        Select-Object -First 1
    if ($secretLine) {
        $Secret = ($secretLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
    }
}

if (-not $Secret) {
    throw 'Set ADMIN_SECRET or CRON_SECRET in the shell, or configure it in .env.local for localhost.'
}

$headers = @{ Authorization = "Bearer $Secret" }
$base = $BaseUrl.TrimEnd('/')

Write-Output 'Refreshing weekly institutional data...'
$institutional = Invoke-RestMethod -Method Post -Uri "$base/api/admin/institutional/refresh" -Headers $headers
if (-not $institutional.success) {
    throw 'Institutional refresh did not succeed.'
}
Write-Output ("AAII updated: {0} at {1}" -f $institutional.updated.value, $institutional.updated.report_date)

Write-Output 'Refreshing all market, mode, and source-toggle snapshots...'
$signals = Invoke-RestMethod -Method Get -Uri "$base/api/signals/refresh?includeSourceOff=true" -Headers $headers
if (-not $signals.success) {
    $failedTargets = @($signals.results | Where-Object { -not $_.success })
    throw ("Signal refresh failed for {0} target(s)." -f $failedTargets.Count)
}

Write-Output ("Signal snapshots refreshed: {0}/{1}" -f $signals.succeeded, $signals.targetCount)
