param(
  [Parameter(Mandatory=$true)][string]$Run,
  [switch]$Actions,
  [switch]$Full
)
$ErrorActionPreference = 'Stop'
$root = "C:\Users\94202\Desktop\daily\civilizationMini"
$tmp = Join-Path $env:TEMP "obs-$PID.json"
& node --permission "--allow-fs-read=$root\dist" "--allow-fs-read=$root\rulesets" "--allow-fs-read=$root\package.json" "--allow-fs-read=$root\artifacts\runs" "$root\dist\apps\cli\main.js" observe --run $Run --format json *> $tmp
if ($LASTEXITCODE -ne 0) { Write-Host "observe exit=$LASTEXITCODE"; Get-Content $tmp -TotalCount 20; exit 1 }
$raw = Get-Content $tmp -Raw -Encoding UTF8
$raw = $raw.TrimStart([char]0xFEFF)
$d = $raw | ConvertFrom-Json
$g = $d.game
$c = $g.clock
$f = $g.family
$e = $g.economy
$era = $g.era
$w = $g.world
$life = $g.life
Write-Host "=== SUMMARY run=$Run ==="
Write-Host "revision: $($d.revision) | status: $($g.status) | rules: $($g.rulesVersion)"
Write-Host "clock: gen=$($c.generation) turn=$($c.turn) absTurn=$($c.absoluteTurn) (gens=$($c.generations) tpg=$($c.turnsPerGeneration))"
Write-Host "season: $($w.weatherName) weather=$($w.weather) rain=$($w.rain) water=$($w.water) pubWater=$($era.publicWaterAvailable)"
Write-Host "food: $($f.food) | money: $($f.money) | hardship: $($f.hardship)"
Write-Host "life: timeLeft=$($life.timeRemaining)/$($life.timePerSeason) energyBudget=$($life.budget) recovery=$($life.recovery)"
Write-Host "era: stage=$($era.stage) idx=$($era.index) elapsed=$($era.elapsed)/$($era.duration) closed=$($era.closed) settlements=$($d.eraSettlements.Count)"
Write-Host "knowledge: mastered=$($g.person.mastered.Count) heir=$($g.heir.mastered.Count) learning=$($g.person.learning.Count)"
Write-Host "goods: $($e.goods | ConvertTo-Json -Compress -Depth 4)"
Write-Host "equipment: $($e.equipment | ConvertTo-Json -Compress -Depth 3)"
Write-Host "storage: $($e.storage | ConvertTo-Json -Compress -Depth 3)"
Write-Host "field: $($e.field | ConvertTo-Json -Compress -Depth 3)"
Write-Host "prodInv: $($g.production.inventory | ConvertTo-Json -Compress -Depth 3)"
Write-Host "market: $($e.market | ConvertTo-Json -Compress -Depth 3)"
if ($Full) {
  Write-Host "--- FULL world/person ---"
  Write-Host ($w | ConvertTo-Json -Depth 6 -Compress)
  Write-Host ($g.person | ConvertTo-Json -Depth 6 -Compress)
}
if ($Actions) {
  Write-Host "--- ENABLED ACTIONS ---"
  $g.actions | Where-Object { $_.enabled } | ForEach-Object { Write-Host (" {0} | {1} | {2}t/{3}e/{4}money" -f $_.id, $_.label, $_.time, $_.energy, $_.money) }
  Write-Host "--- DISABLED ACTIONS ---"
  $g.actions | Where-Object { -not $_.enabled } | ForEach-Object { Write-Host (" {0} | {1} | {2}" -f $_.id, $_.label, $_.reason) }
}
if ($d.recentEvents.Count -gt 0) {
  Write-Host "--- RECENT EVENTS ---"
  $d.recentEvents | Select-Object -Last 6 | ForEach-Object { Write-Host (" * " + ($_ | ConvertTo-Json -Compress -Depth 5)) }
}
Remove-Item $tmp -ErrorAction SilentlyContinue