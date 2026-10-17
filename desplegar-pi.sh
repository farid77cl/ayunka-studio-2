#!/usr/bin/env bash
# Publica Ayünka Studio en la Pi: http://ayunka-pi/studio/ (unico lugar donde vive; GitHub Pages esta apagado).
# Uso: bash desplegar-pi.sh [host]   (por defecto: pi)
set -euo pipefail
HOST=${1:-pi}
cd "$(dirname "$0")"
tar cf - index.html sw.js manifest.webmanifest css datos js fuentes icono plantillas \
  | ssh "$HOST" 'sudo tar xf - -C /srv/portada/studio --no-same-owner && sudo chmod -R a+rX /srv/portada/studio'
echo "==> studio: $(ssh "$HOST" 'curl -s -o /dev/null -w "%{http_code}" http://localhost/studio/')"
