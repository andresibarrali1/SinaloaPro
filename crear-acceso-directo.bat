@echo off
rem ---------------------------------------------------------------------------------------------------------------
rem Crea el acceso directo de Sinaloa Pro para la barra de tareas y lo deja listo para anclar.
rem
rem El acceso apunta al lanzador estable (%LOCALAPPDATA%\SinaloaPro\abrir-sinaloa.ps1), no a la carpeta del proyecto:
rem así, si se mueve el proyecto de sitio, el icono anclado sigue funcionando porque el lanzador busca Iniciar.cmd.
rem Vuelve a ejecutar este archivo después de mover el proyecto (o simplemente abre Iniciar.cmd desde la carpeta nueva,
rem que también apunta la ubicación).
rem ---------------------------------------------------------------------------------------------------------------
setlocal EnableExtensions
set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "DATOS=%LOCALAPPDATA%\SinaloaPro"

if not exist "%RAIZ%\Iniciar.cmd" (
  echo Falta Iniciar.cmd en %RAIZ%: ejecuta este archivo desde la carpeta del proyecto.
  pause
  exit /b 1
)
if not exist "%RAIZ%\abrir-sinaloa.ps1" (
  echo Falta abrir-sinaloa.ps1 en %RAIZ%: ejecuta este archivo desde la carpeta del proyecto.
  pause
  exit /b 1
)

if not exist "%DATOS%" mkdir "%DATOS%" >nul 2>nul
copy /y "%RAIZ%\abrir-sinaloa.ps1" "%DATOS%\abrir-sinaloa.ps1" >nul
>"%DATOS%\ubicacion.txt" echo %RAIZ%
if exist "%RAIZ%\public\icons\sinaloa-pro.ico" copy /y "%RAIZ%\public\icons\sinaloa-pro.ico" "%DATOS%\sinaloa-pro.ico" >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$lnk=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Sinaloa Pro.lnk';" ^
  "$sh=New-Object -ComObject WScript.Shell;" ^
  "$s=$sh.CreateShortcut($lnk);" ^
  "$s.TargetPath='powershell.exe';" ^
  "$s.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DATOS%\abrir-sinaloa.ps1\"';" ^
  "$s.WorkingDirectory='%DATOS%';" ^
  "if (Test-Path '%DATOS%\sinaloa-pro.ico') { $s.IconLocation='%DATOS%\sinaloa-pro.ico' };" ^
  "$s.Description='Abre Sinaloa Pro (arranca el servidor local si hace falta)';" ^
  "$s.Save();" ^
  "Write-Output ('Acceso directo creado en ' + $lnk)"
if errorlevel 1 (
  echo No se pudo crear el acceso directo.
  pause
  exit /b 1
)

echo.
echo Listo. En el escritorio está «Sinaloa Pro».
echo Para tenerlo en la barra de tareas: clic derecho en «Sinaloa Pro» ^> Anclar a la barra de tareas
echo ^(o arrástralo hasta la barra^). Al pulsarlo, si el servidor no está en marcha, lo arranca.
echo.
pause
