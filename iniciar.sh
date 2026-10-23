#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo "Instala Node.js 22.13 o posterior desde https://nodejs.org y vuelve a ejecutar este archivo."
  exit 1
fi
exec node "$ROOT/scripts/launch-unix.mjs" "$@"
