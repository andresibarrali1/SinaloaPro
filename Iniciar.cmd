@echo off
rem ---------------------------------------------------------------------------------------------------------------
rem Abre Sinaloa Pro: arranca el servidor local si no está en marcha y abre la aplicación.
rem
rem Si la aplicación está instalada en el escritorio (la PWA de Chrome o Edge) se abre **la instalada**, la misma que
rem se ancla a la barra de tareas; si todavía no está instalada, se abre una ventana de aplicación con el mismo
rem aspecto y se recuerda cómo instalarla.
rem
rem La carpeta del proyecto es SIEMPRE la de este archivo (%~dp0): no hay ninguna ruta absoluta guardada, así que se
rem puede mover el proyecto de sitio. Además apunta la ubicación en %LOCALAPPDATA%\SinaloaPro\ubicacion.txt para que el
rem acceso directo anclado (abrir-sinaloa.ps1) encuentre este script aunque la carpeta cambie.
rem
rem Opciones:
rem   /sin-ventana   arranca el servidor pero no abre ninguna ventana
rem   /navegador     abre el navegador en localhost (lo que se hace por defecto, para poder instalar la aplicación)
rem   /app           abre la ventana sin barras del navegador, en vez de la pestaña
rem   /depurar       muestra lo que haría, sin arrancar el servidor ni abrir nada
rem Variables: CORTE15_PUERTO (por defecto 5173), CORTE15_PERFIL (perfil de Chrome para la ventana) y CORTE15_APP
rem (ruta de un acceso directo concreto, por si hay varias instalaciones).
rem ---------------------------------------------------------------------------------------------------------------
setlocal EnableExtensions EnableDelayedExpansion
set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
cd /d "%RAIZ%"
set "PUERTO=%CORTE15_PUERTO%"
if not defined PUERTO set "PUERTO=5173"
set "URL=http://127.0.0.1:%PUERTO%/"
set "DATOS=%LOCALAPPDATA%\SinaloaPro"
set "ABRIR=1"
set "MODO=navegador"
set "DEPURAR=0"

:opciones
if "%~1"=="" goto listo
if /i "%~1"=="/sin-ventana" set "ABRIR=0"
if /i "%~1"=="/navegador" set "MODO=navegador"
if /i "%~1"=="/app" set "MODO=app"
if /i "%~1"=="/depurar" set "DEPURAR=1"
shift
goto opciones

:listo
if not exist "%DATOS%" mkdir "%DATOS%" >nul 2>nul
>"%DATOS%\ubicacion.txt" echo %RAIZ%
call :buscarAppInstalada
call :buscarNavegador
echo Sinaloa Pro · %RAIZ%
echo Puerto %PUERTO% - la URL es %URL%
if defined APP echo Aplicacion instalada: %APP%

if "%DEPURAR%"=="1" goto depurar

rem Compilar antes de reutilizar el servidor: dist puede contener una versión anterior.
where node >nul 2>nul
if errorlevel 1 goto sinNode
if not exist "node_modules" (
  call npm.cmd ci
  if errorlevel 1 goto fallaDependencias
)
echo Actualizando la compilacion de esta carpeta...
call npm.cmd run build
if errorlevel 1 goto fallaCompilacion

call :responde
if "%RESPUESTA%"=="409" goto puertoOcupado
if "%RESPUESTA%"=="200" goto yaEnMarcha
goto arrancar

:depurar
echo [depurar] se comprobaria %URL% y, si no responde, se arrancaria el servidor con:
echo [depurar]   node scripts\start-production.mjs   puerto %PUERTO%
if defined APP (
  echo [depurar] despues se abriria la aplicacion instalada: %APP%
  goto depurarFin
)
if "%MODO%"=="app" (echo [depurar] despues se abriria la ventana sin barras sobre %URL% - abrir=%ABRIR%) else (echo [depurar] despues se abriria el navegador en %URL%, con la opcion de instalar - abrir=%ABRIR%)
:depurarFin
exit /b 0

:yaEnMarcha
echo El servidor ya estaba en marcha: solo se abre la aplicacion.
goto abrir

:arrancar
where node >nul 2>nul
if errorlevel 1 goto sinNode
if exist "node_modules" goto conDependencias
echo Instalando las dependencias la primera vez. Puede tardar unos minutos...
call npm.cmd ci
if errorlevel 1 goto fallaDependencias
:conDependencias
if exist "dist\index.html" goto conCompilacion
echo Compilando la aplicacion para abrirla sin el servidor de desarrollo...
call npm.cmd run build
if errorlevel 1 goto fallaCompilacion
:conCompilacion
echo Arrancando el servidor local de Sinaloa Pro...
rem El servidor se queda en su propia ventana minimizada (se puede cerrar desde ahi) y su salida va a un registro.
rem Se lanza con Start-Process para que este script termine en cuanto abre la aplicacion, sin atarse a la consola.
powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','node scripts\\start-production.mjs > \"%DATOS%\\servidor.log\" 2>&1' -WorkingDirectory '%RAIZ%' -WindowStyle Minimized"
set "ESPERA=0"
:esperando
ping -n 2 127.0.0.1 >nul
call :responde
if "%RESPUESTA%"=="200" goto abrir
set /a ESPERA+=1
if %ESPERA% lss 25 goto esperando
echo El servidor no respondio en 25 segundos. Revisa el registro %DATOS%\servidor.log
exit /b 1

:abrir
if "%ABRIR%"=="0" (
  echo El servidor esta en marcha en %URL% y no se abre ninguna ventana, como se pidio.
  exit /b 0
)
if defined APP goto abrirInstalada
if "%MODO%"=="navegador" goto pestana
if not defined NAVEGADOR goto sinNavegador
powershell -NoProfile -Command "if ($env:CORTE15_PERFIL) { Start-Process -FilePath $env:NAVEGADOR -ArgumentList '--app=%URL%','--window-size=1600,1000',('--user-data-dir=' + $env:CORTE15_PERFIL) } else { Start-Process -FilePath $env:NAVEGADOR -ArgumentList '--app=%URL%','--window-size=1600,1000' }"
echo Abriendo Sinaloa Pro en una ventana de aplicacion.
echo Para tenerla como aplicacion instalada, pulsa el icono de instalar del navegador.
exit /b 0

:abrirInstalada
powershell -NoProfile -Command "$sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($env:APP); Start-Process -FilePath $s.TargetPath -ArgumentList $s.Arguments"
echo Abriendo la aplicacion instalada de Sinaloa Pro.
exit /b 0

:pestana
if not defined NAVEGADOR goto sinNavegador
powershell -NoProfile -Command "if ($env:CORTE15_PERFIL) { Start-Process -FilePath $env:NAVEGADOR -ArgumentList '%URL%',('--user-data-dir=' + $env:CORTE15_PERFIL) } else { Start-Process -FilePath $env:NAVEGADOR -ArgumentList '%URL%' }"
echo Se abre en el navegador, en %URL%.
echo Para tenerla como aplicacion: icono de instalar de la barra de direcciones, o el boton
echo «Instalar Sinaloa Pro en el escritorio» del editor. A partir de ahi se abrira como una aplicacion.
exit /b 0

:sinNavegador
echo No encontre Chrome ni Edge: se abre en el navegador predeterminado, con su barra.
powershell -NoProfile -Command "Start-Process '%URL%'"
exit /b 0

:sinNode
echo No encuentro Node.js 22.13 o posterior. Instalalo desde https://nodejs.org/ y vuelve a intentarlo.
pause
exit /b 1

:fallaDependencias
echo No se pudieron instalar las dependencias.
pause
exit /b 1

:fallaCompilacion
echo No se pudo compilar.
pause
exit /b 1

rem Devuelve en RESPUESTA el codigo HTTP de la aplicacion (200 si sirve, 0 si no responde).
:responde
node scripts\check-local-server.mjs
set "RESULTADO=%ERRORLEVEL%"
set "RESPUESTA=0"
if "%RESULTADO%"=="0" set "RESPUESTA=200"
if "%RESULTADO%"=="2" set "RESPUESTA=409"
exit /b 0

:puertoOcupado
echo El puerto %PUERTO% sirve otra version o aplicacion. No se abrira esa copia.
echo Cierra el servidor anterior y vuelve a iniciar desde esta carpeta: %RAIZ%
exit /b 1

rem Deja en NAVEGADOR la ruta de Chrome o Edge, si estan instalados.
:buscarNavegador
set "NAVEGADOR="
for %%N in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) do if not defined NAVEGADOR if exist %%N set "NAVEGADOR=%%~N"
exit /b 0

rem Busca la aplicacion instalada: un acceso directo con el nombre de la app cuyo destino sea Chrome o Edge, que es el
rem que crea el navegador al instalarla. Se descarta el acceso de este lanzador, que apunta a powershell.exe. El
rem resultado se escribe en un archivo para leerlo con `set /p` sin lios de comillas.
:buscarAppInstalada
set "APP="
if defined CORTE15_APP if exist "%CORTE15_APP%" set "APP=%CORTE15_APP%"
if defined APP exit /b 0
set "LISTA=%DATOS%\app-instalada.txt"
powershell -NoProfile -Command "$sh = New-Object -ComObject WScript.Shell; $raices = @((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'), (Join-Path $env:USERPROFILE 'Desktop'), (Join-Path $env:USERPROFILE 'OneDrive\Escritorio'), [Environment]::GetFolderPath('Desktop')); foreach ($raiz in $raices) { if (-not $raiz) { continue }; if (-not (Test-Path -LiteralPath $raiz)) { continue }; $enlaces = Get-ChildItem -LiteralPath $raiz -Filter 'Sinaloa*.lnk' -Recurse -ErrorAction SilentlyContinue; foreach ($enlace in $enlaces) { try { $acceso = $sh.CreateShortcut($enlace.FullName); if ($acceso.TargetPath -match 'chrome\.exe|msedge\.exe') { Write-Output $enlace.FullName; exit } } catch { } } }" > "%LISTA%" 2>nul
set "APP="
if exist "%LISTA%" set /p APP=<"%LISTA%"
del "%LISTA%" >nul 2>nul
exit /b 0
