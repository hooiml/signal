$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$hook = Join-Path $repoRoot ".githooks\commit-msg"
$tempRoot = Join-Path $repoRoot ".tmp\commit-message-tests"

if (-not (Test-Path -LiteralPath $hook)) {
    throw "Commit-message hook is missing: $hook"
}

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

function Assert-CommitMessage {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [Parameter(Mandatory = $true)][bool]$ExpectedValid,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $messagePath = Join-Path $tempRoot "$([guid]::NewGuid().ToString('N')).txt"
    [System.IO.File]::WriteAllText($messagePath, "$Message`n", [System.Text.UTF8Encoding]::new($false))

    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $repoRoot -c core.hooksPath=.githooks hook run commit-msg -- $messagePath 2>$null | Out-Null
        $actualValid = $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorPreference
    }

    if ($actualValid -ne $ExpectedValid) {
        throw "$Label failed for subject: $Message"
    }
}

try {
    Assert-CommitMessage "feat(research): add decision workflow" $true "Scoped feature subject"
    Assert-CommitMessage "fix(provider)!: require authenticated requests" $true "Breaking scoped fix subject"
    Assert-CommitMessage "Implement requested project changes" $false "Generic subject rejection"
    Assert-CommitMessage "feat: missing required scope" $false "Missing scope rejection"
    Assert-CommitMessage "feat(Research): uppercase scope" $false "Uppercase scope rejection"
    Write-Host "Commit-message hook checks passed."
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTemp = (Resolve-Path -LiteralPath $tempRoot).Path
        $expectedRoot = (Join-Path $repoRoot ".tmp")
        if (-not $resolvedTemp.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected temporary path: $resolvedTemp"
        }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}
