@echo off
rem Arranca el editor y, en otra ventana, el puente que lee y guarda proyectos .veg con VEGAS Pro 15.
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
if not exist "bridge\VegBridge.cs" (
  echo Falta bridge\VegBridge.cs: sin ese script el puente no puede hablar con VEGAS.
  pause
  exit /b 1
)
echo Iniciando el puente .veg en otra ventana (http://127.0.0.1:5174)...
start "Corte 15 - puente VEGAS" cmd /k node scripts\veg-bridge-server.mjs
echo.
echo Abre http://127.0.0.1:5173/ en tu navegador.
echo Conserva las dos ventanas abiertas. Ctrl+C detiene el editor.
call npm.cmd run dev
pause
