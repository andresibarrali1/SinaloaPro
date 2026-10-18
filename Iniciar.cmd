@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22.13 o posterior desde https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Abre http://127.0.0.1:5173/ en tu navegador.
echo Conserva esta ventana abierta mientras editas. Ctrl+C detiene el servidor.
call npm.cmd run dev
pause
