#!/bin/sh
# Lanzador para macOS y Linux.
#
# Encuentra Node aunque el shell no lo tenga en el PATH (un .command abierto con doble clic desde el
# Finder no hereda el PATH de tu terminal, así que Homebrew, nvm, Volta o pnpm quedan fuera), comprueba
# la versión y arranca el editor. Con --diagnostico cuenta lo que ve y sale sin arrancar nada.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

for dir in /opt/homebrew/bin /usr/bin /bin /usr/sbin /sbin /usr/local/bin /opt/local/bin "$HOME/.volta/bin" "$HOME/.local/bin" "$HOME/Library/pnpm" "$HOME/.asdf/shims"; do
  [ -d "$dir" ] && PATH="$dir:$PATH"
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  ultima=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sed 's/^v//' | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1 || true)
  if [ -n "${ultima:-}" ] && [ -d "$HOME/.nvm/versions/node/v$ultima/bin" ]; then
    PATH="$HOME/.nvm/versions/node/v$ultima/bin:$PATH"
  fi
fi
export PATH

pausa() {
  if [ -t 0 ]; then
    printf '\nPulsa Enter para cerrar esta ventana. '
    read -r _ || true
  fi
}

if ! command -v node >/dev/null 2>&1; then
  cat <<'TEXTO'
No encuentro Node.js en este equipo.

Instala la versión LTS desde https://nodejs.org (instalador .pkg: continuar, continuar, instalar).
Después cierra esta ventana, abre Terminal y comprueba con:

    node -v

Debe decir v22.13.0 o posterior. Luego vuelve a ejecutar:

    sh iniciar.sh
TEXTO
  pausa
  exit 1
fi

version=$(node -v 2>/dev/null || echo desconocida)
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
  printf 'Node.js %s es demasiado antiguo: el editor necesita 22.13 o posterior.\n' "$version"
  printf 'Instala la versión LTS desde https://nodejs.org y vuelve a intentarlo.\n'
  pausa
  exit 1
fi

if [ "${1:-}" = "--diagnostico" ]; then
  printf 'Sistema:        %s %s\n' "$(uname -s)" "$(uname -m)"
  printf 'Carpeta:        %s\n' "$ROOT"
  printf 'Node.js:        %s (%s)\n' "$version" "$(command -v node)"
  printf 'npm:            %s\n' "$(command -v npm || echo 'no está en el PATH; se usará el que viene con Node')"
  if [ -d '/Applications/Google Chrome.app' ]; then
    printf 'Navegador:      Google Chrome instalado\n'
  else
    printf 'Navegador:      el predeterminado del sistema\n'
  fi
  if [ -d node_modules ]; then
    printf 'Dependencias:   instaladas\n'
  else
    printf 'Dependencias:   pendientes (se instalan al arrancar)\n'
  fi
  if [ -f dist/index.html ]; then
    printf 'Compilado:      sí (dist/index.html)\n'
  else
    printf 'Compilado:      no; se compila al arrancar\n'
  fi
  exit 0
fi

estado=0
node "$ROOT/scripts/launch-unix.mjs" "$@" || estado=$?
if [ "$estado" -ne 0 ]; then
  printf '\nEl arranque falló. Copia el mensaje anterior si necesitas ayuda.\n'
  pausa
  exit "$estado"
fi
