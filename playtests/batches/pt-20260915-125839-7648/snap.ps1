# compact snapshot helper: formats observe output only, never chooses actions
param(
  [Parameter(Mandatory = $true)][string]$Run
)
$out = node scripts/player.mjs observe --run $Run | Out-String
$j = $out | ConvertFrom-Json
$g = $j.game
Write-Output ("=== REV {0} | gen {1} turn {2} abs {3} | {4} year {5} ===" -f $j.revision, $g.clock.generation, $g.clock.turn, $g.clock.absoluteTurn, $g.life.calendar.year, $g.life.calendar.season)
Write-Output ("life: timeLeft {0}/{1} energy {2}/{3} health {4} age {5} | heir {6}" -f $g.life.timeRemaining, $g.life.timePerSeason, $g.life.person.energy, $g.life.person.maxEnergy, $g.life.person.health, $g.life.person.ageYears, $g.life.heir.ageYears)
Write-Output ("family: food {0} money {1} hardship {2}" -f $g.family.food, $g.family.money, $g.family.hardship)
Write-Output ("weather: {0} rain {1} water {2}" -f $g.world.weatherName, $g.world.rain, $g.world.water)
Write-Output ("goods: {0}" -f ($g.economy.goods | ConvertTo-Json -Compress))
Write-Output ("knowledge: {0}" -f ($g.economy.knowledge | ConvertTo-Json -Compress))
Write-Output ("field: {0}" -f ($g.economy.field | ConvertTo-Json -Compress))
Write-Output ("equipment: {0}" -f ($g.economy.equipment | ConvertTo-Json -Compress))
Write-Output ("era: stage={0} elapsed={1} remaining={2} goal={3} complete={4}" -f $g.era.stage.name, $g.era.elapsed, $g.era.remaining, $g.era.goal.id, $g.era.goal.complete)
Write-Output ("projection: {0}" -f ($g.era.projection | ConvertTo-Json -Compress))
Write-Output ("socialFood: policy={0} need={1} purchase={2} cost={3} expectedReserve={4}" -f $g.socialFood.policy, $g.socialFood.need, $g.socialFood.purchase, $g.socialFood.cost, $g.socialFood.expectedReserve)
Write-Output ("operations: {0}" -f ($g.economy.operations | ConvertTo-Json -Compress))
Write-Output "enabled actions:"
$g.actions | Where-Object { $_.enabled } | ForEach-Object { Write-Output ("  - {0} [{1}]" -f $_.id, $_.label) }
Write-Output "--- recent events ---"
$j.recentEvents | ForEach-Object { Write-Output ($_ | ConvertTo-Json -Compress -Depth 5) }