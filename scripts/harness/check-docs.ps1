$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$required = @(
    "AGENTS.md",
    "docs/ARCHITECTURE.md",
    "docs/TESTING.md",
    "docs/QUALITY.md",
    "docs/HARNESS.md",
    "docs/WORKFLOWS.md",
    "docs/signal-scoring.md",
    "docs/generated/repo-map.md"
)

$missing = @()
foreach ($path in $required) {
    if (-not (Test-Path (Join-Path $root $path))) {
        $missing += $path
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing required harness docs: " + ($missing -join ", "))
}

$agents = Get-Content -Raw (Join-Path $root "AGENTS.md")
$links = [regex]::Matches($agents, '``([^``]+\.md)``') | ForEach-Object { $_.Groups[1].Value }
$broken = @()
foreach ($link in $links) {
    if (-not (Test-Path (Join-Path $root $link))) {
        $broken += $link
    }
}

if ($broken.Count -gt 0) {
    Write-Error ("AGENTS.md points to missing docs: " + ($broken -join ", "))
}

Write-Host "Docs check passed."
