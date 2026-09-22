@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Civilization Mini

if not defined PORT set "PORT=4321"
if exist "runtime\node.exe" goto portable

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请安装 Node.js 24 或更高版本。
  echo https://nodejs.org/
  goto failed
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo [错误] 需要 Node.js 24 或更高版本，当前版本为：
  node --version
  goto failed
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm，请重新安装 Node.js。
  goto failed
)

if not defined PORT set "PORT=4321"
if not exist "node_modules\.bin\tsc.cmd" goto install
if not exist "node_modules\pixi.js-legacy\package.json" goto install
goto launch

:install
echo 正在安装项目依赖，首次启动需要联网……
call npm.cmd ci
if errorlevel 1 goto failed

:launch
echo 正在编译并启动游戏……
echo 服务就绪后，请打开：http://127.0.0.1:%PORT%/start
echo 请保留此窗口；关闭窗口或按 Ctrl+C 可停止服务。
echo 如果提示端口已被占用，请先关闭先前的游戏服务窗口。
echo.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0

:portable
if not exist "dist\apps\board\server.js" (
  echo [错误] 游戏文件不完整，请完整解压压缩包后再启动。
  goto failed
)
set "OPEN_BROWSER=1"
echo 正在启动隐士修所，请保留此窗口。
echo 如浏览器没有自动打开，请访问：http://127.0.0.1:%PORT%/start
echo 关闭此窗口或按 Ctrl+C 可停止游戏服务。
"%~dp0runtime\node.exe" "%~dp0dist\apps\board\server.js"
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo 启动未完成，请查看上方错误信息。
pause
exit /b 1
