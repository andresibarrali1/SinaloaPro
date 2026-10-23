# Abre Sinaloa Pro desde el acceso directo anclado a la barra de tareas.
#
# El icono anclado apunta a **este archivo**, que vive en %LOCALAPPDATA%\SinaloaPro y no cambia de sitio, así que mover
# la carpeta del proyecto no rompe el acceso directo: aquí se **busca** el lanzador del proyecto (`Iniciar.cmd`) y se
# ejecuta desde su carpeta. Se admite también un `iniciar.bat` antiguo, por si el proyecto no se ha actualizado.
param(
  # Solo dice dónde está el lanzador, sin ejecutarlo (para comprobar que la búsqueda funciona tras mover el proyecto).
  [switch]$Buscar
)
$ErrorActionPreference = 'Stop'
$datos = Join-Path $env:LOCALAPPDATA 'SinaloaPro'
$registro = Join-Path $datos 'ubicacion.txt'
$lanzadores = @('Iniciar.cmd', 'iniciar.cmd', 'iniciar.bat')

function Lanzador-En([string]$carpeta) {
  if (-not $carpeta) { return $null }
  foreach ($nombre in $lanzadores) {
    $ruta = Join-Path $carpeta $nombre
    if (Test-Path -LiteralPath $ruta) { return $ruta }
  }
  return $null
}

# La carpeta es de Sinaloa Pro si tiene el lanzador y además alguna de sus señas: el creador del acceso directo, el
# paquete con su nombre o el editor. Así no se confunde con otro lanzador que haya en el equipo.
function Es-Proyecto([string]$carpeta) {
  if (-not $carpeta) { return $false }
  if (-not (Lanzador-En $carpeta)) { return $false }
  if (Test-Path -LiteralPath (Join-Path $carpeta 'crear-acceso-directo.bat')) { return $true }
  if (Test-Path -LiteralPath (Join-Path $carpeta 'abrir-corte15.ps1')) { return $true }
  if (Test-Path -LiteralPath (Join-Path $carpeta 'abrir-sinaloa.ps1')) { return $true }
  if (Test-Path -LiteralPath (Join-Path $carpeta 'components\editor\editor.tsx')) { return $true }
  $paquete = Join-Path $carpeta 'package.json'
  if (Test-Path -LiteralPath $paquete) {
    try { return ((Get-Content -LiteralPath $paquete -Raw) -match 'corte15-editor-local') } catch { return $false }
  }
  return $false
}

function Buscar-Lanzador {
  # 1) Donde se anotó la última vez.
  if (Test-Path -LiteralPath $registro) {
    $anotada = (Get-Content -LiteralPath $registro -Raw -ErrorAction SilentlyContinue)
    if ($anotada) {
      $carpeta = $anotada.Trim()
      if (Es-Proyecto $carpeta) { return (Lanzador-En $carpeta) }
    }
  }
  # 2) La carpeta del usuario y las de siempre, un nivel por debajo.
  $raices = @((Join-Path $env:USERPROFILE 'Desktop'), (Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Documents'), (Join-Path $env:USERPROFILE 'OneDrive'), $env:USERPROFILE)
  foreach ($base in $raices) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    $hijos = Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue
    foreach ($hijo in $hijos) {
      if (Es-Proyecto $hijo.FullName) { return (Lanzador-En $hijo.FullName) }
    }
  }
  # 3) Si el proyecto se movió más adentro, se busca unos niveles abajo (solo carpetas de Sinaloa Pro).
  foreach ($base in $raices[0..3]) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    $encontrado = Get-ChildItem -LiteralPath $base -Filter 'crear-acceso-directo.bat' -File -Recurse -Depth 4 -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($encontrado) { return (Lanzador-En (Split-Path -Parent $encontrado.FullName)) }
  }
  return $null
}

$lanzador = Buscar-Lanzador
if (-not $lanzador) {
  $mensaje = "No encontré Iniciar.cmd de Sinaloa Pro. Abre la carpeta del proyecto y ejecuta crear-acceso-directo.bat para volver a enlazar este acceso."
  if (-not $Buscar) { (New-Object -ComObject WScript.Shell).Popup($mensaje, 20, 'Sinaloa Pro', 48) | Out-Null }
  Write-Output $mensaje
  exit 1
}

$carpeta = Split-Path -Parent $lanzador
New-Item -ItemType Directory -Force -Path $datos | Out-Null
Set-Content -Path $registro -Value $carpeta -Encoding UTF8

if ($Buscar) {
  Write-Output $lanzador
  exit 0
}

# Se lanza en una ventana oculta: el servidor sigue vivo en segundo plano y no aparece ningún console.
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ('"' + $lanzador + '"') -WindowStyle Hidden
