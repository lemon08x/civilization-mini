param(
  [Parameter(Mandatory=$true)][string]$Run,
  [Parameter(Mandatory=$true)][string]$Revision,
  [Parameter(Mandatory=$true)][string]$Action,
  [string]$Reason = ""
)
$ErrorActionPreference = 'Stop'
$root = "C:\Users\94202\Desktop\daily\civilizationMini"
$tmp = Join-Path $env:TEMP "act-$PID.json"
& node scripts/player.mjs act --run $Run --revision $Revision --action $Action --reason $Reason --format json *> $tmp
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host "ACT FAILED ($Action) exit=$code"
  Get-Content $tmp -TotalCount 30
  Remove-Item $tmp -ErrorAction SilentlyContinue
  exit $code
}
$raw = Get-Content $tmp -Raw -Encoding UTF8
$raw = $raw.TrimStart([char]0xFEFF)
$d = $raw | ConvertFrom-Json
Write-Host ("OK act={0} rev {1} -> {2}" -f $Action, $Revision, $d.revision)
if ($d.receipt) { Write-Host ("receipt: " + ($d.receipt | ConvertTo-Json -Compress -Depth 4)) }
if ($d.game.status -ne 'active') { Write-Host "STATUS: $($d.game.status)" }
if ($d.recentEvents.Count -gt 0) {
  Write-Host "--- events ---"
  $d.recentEvents | Select-Object -Last 4 | ForEach-Object { Write-Host (" * " + ($_ | ConvertTo-Json -Compress -Depth 5)) }
}
Remove-Item $tmp -ErrorAction SilentlyContinue