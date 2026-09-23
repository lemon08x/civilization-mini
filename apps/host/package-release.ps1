param(
  [string]$Tag = 'v0.27.0',
  [string]$NodeVersion = 'v24.12.0'
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repoRoot
if ($Tag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+([.-][a-zA-Z0-9.-]+)?$') { throw 'Invalid release tag' }
if ($NodeVersion -notmatch '^v24\.[0-9]+\.[0-9]+$') { throw 'Use a pinned Node.js 24 release' }
$releaseRoot = Join-Path $repoRoot 'artifacts/releases'
$packageName = "CivilizationMini-$Tag-windows-x64"
$bundleRoot = Join-Path $releaseRoot $packageName
$zipPath = "$bundleRoot.zip"
if ((Test-Path -LiteralPath $bundleRoot) -or (Test-Path -LiteralPath $zipPath)) { throw "Release output already exists: $bundleRoot" }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

# Verify the official runtime archive before extracting or executing it.
$nodeArchiveName = "node-$NodeVersion-win-x64.zip"
$nodeArchive = Join-Path $releaseRoot $nodeArchiveName
$checksums = Join-Path $releaseRoot "node-$NodeVersion-SHASUMS256.txt"
& curl.exe --fail --location --retry 2 --max-time 180 "https://nodejs.org/dist/$NodeVersion/SHASUMS256.txt" --output $checksums
if ($LASTEXITCODE -ne 0) { throw 'Could not retrieve Node.js checksums' }
$checksumLine = Get-Content -LiteralPath $checksums | Where-Object { $_ -match ('\s+' + [regex]::Escape($nodeArchiveName) + '$') }
if (@($checksumLine).Count -ne 1) { throw 'Missing official runtime checksum' }
$expectedHash = ($checksumLine -split '\s+')[0]
if (-not (Test-Path -LiteralPath $nodeArchive)) {
  & curl.exe --fail --location --retry 2 --max-time 180 "https://nodejs.org/dist/$NodeVersion/$nodeArchiveName" --output $nodeArchive
  if ($LASTEXITCODE -ne 0) { throw 'Could not download Node.js runtime' }
}
if ((Get-FileHash -LiteralPath $nodeArchive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Node.js checksum mismatch' }
$runtimeExtract = Join-Path $releaseRoot "runtime-$([guid]::NewGuid().ToString('N'))"
Expand-Archive -LiteralPath $nodeArchive -DestinationPath $runtimeExtract
$officialNodeRoot = Join-Path $runtimeExtract "node-$NodeVersion-win-x64"
New-Item -ItemType Directory -Path (Join-Path $bundleRoot 'runtime') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $officialNodeRoot 'node.exe') -Destination (Join-Path $bundleRoot 'runtime/node.exe')
Copy-Item -LiteralPath (Join-Path $officialNodeRoot 'LICENSE') -Destination (Join-Path $bundleRoot 'runtime/LICENSE.txt')

# Explicit allowlist: never ship saves, local caches, tests, or repository credentials.
foreach ($folder in @('dist/src','dist/apps','rulesets/v27')) {
  $destination = Join-Path $bundleRoot $folder
  New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repoRoot $folder) -Destination $destination -Recurse
}
$boardRoot = Join-Path $bundleRoot 'apps/board'
New-Item -ItemType Directory -Path $boardRoot -Force | Out-Null
foreach ($relative in (& git ls-files apps/board)) {
  if ([IO.Path]::GetExtension($relative) -notin @('.html','.css','.png','.jpg','.webp')) { continue }
  $destination = Join-Path $bundleRoot $relative
  New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repoRoot $relative) -Destination $destination
}
foreach ($dependency in @('lunar-typescript','pixi.js-legacy')) {
  $destination = Join-Path $bundleRoot "node_modules/$dependency"
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  foreach ($part in @('dist','package.json','LICENSE')) {
    Copy-Item -LiteralPath (Join-Path $repoRoot "node_modules/$dependency/$part") -Destination (Join-Path $destination $part) -Recurse
  }
}
Copy-Item -LiteralPath (Join-Path $repoRoot '启动游戏.cmd') -Destination $bundleRoot
New-Item -ItemType Directory -Path (Join-Path $bundleRoot 'docs') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/AI_PLAYER.md') -Destination (Join-Path $bundleRoot 'docs/AI_PLAYER.md')
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $bundleRoot 'package.json'), '{"name":"civilization-mini-desktop","version":"0.27.0","private":true,"type":"module"}', $utf8)
$commit = (& git rev-parse HEAD).Trim()
$instructions = @"
隐士修所 · $Tag · Windows x64 桌面试玩版

1. 将整个压缩包解压到一个文件夹，不要直接从压缩包内启动。
2. 双击“启动游戏.cmd”，浏览器会自动打开。
3. 若浏览器没有打开，手动访问 http://127.0.0.1:4321/start 。
4. 保留启动窗口；关闭窗口或按 Ctrl+C 会停止服务。
5. 开始新旅程后，进入“农场 → 土地指南”查看图文教学。

不需要安装 Node.js 或 npm，解压后可离线运行。适用于 Windows 10/11 x64。
若端口已占用，请先关闭之前打开的本游戏启动窗口，再重试。

存档在当前浏览器的本机数据中，并不保存在解压目录。请使用相同浏览器、
相同地址及端口；不要使用无痕模式或清理网站数据。
换电脑、换浏览器或升级前，请通过游戏“选项 → 导出存档”备份。
旧结构存档不迁移；不兼容时请新开旅程，保留原导出文件。

本包供人类玩家试玩；AI 命令行开发请下载 GitHub 提供的 Source code。
规则预研版本，长期平衡仍在完善。没有携带开发者的游戏存档。
Node.js 及依赖许可证分别见 runtime/LICENSE.txt、node_modules 中的 LICENSE。
项目：https://github.com/lemon08x/civilization-mini
来源提交：$commit
运行环境：Node.js $NodeVersion（官方压缩包 SHA-256 已校验）
"@
[IO.File]::WriteAllText((Join-Path $bundleRoot '开始前请读.txt'), $instructions, $utf8)
[IO.File]::WriteAllText((Join-Path $bundleRoot 'release.json'), (@{tag=$Tag;commit=$commit;node=$NodeVersion;platform='win32-x64'} | ConvertTo-Json), $utf8)
Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $releaseRoot "$packageName.sha256"), "$hash  $packageName.zip`n", $utf8)
Write-Output "Bundle: $bundleRoot"
Write-Output "Archive: $zipPath"
Write-Output "SHA256: $hash"
