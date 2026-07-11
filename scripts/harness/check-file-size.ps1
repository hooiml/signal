$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$sourceRoot = Join-Path $root "src"
$softLimit = 450

if (-not (Test-Path $sourceRoot)) {
    Write-Host "No src directory found; file size check skipped."
    exit 0
}

$largeFiles = Get-ChildItem -Path $sourceRoot -Recurse -File -Include *.ts,*.tsx |
    Where-Object {
        $lineCount = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
        $_ | Add-Member -NotePropertyName LineCount -NotePropertyValue $lineCount -Force
        $lineCount -gt $softLimit
    } |
    Sort-Object LineCount -Descending

if ($largeFiles.Count -gt 0) {
    Write-Warning "Large source files detected. This is a visibility warning, not a failure."
    foreach ($file in $largeFiles) {
        $relative = Resolve-Path -Relative $file.FullName
        Write-Warning ("{0}: {1} lines" -f $relative, $file.LineCount)
    }
}

Write-Host "File size check passed."
