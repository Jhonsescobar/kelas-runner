#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Unduh versi LTS di https://nodejs.org lalu jalankan lagi."
  exit 1
fi
node server/index.js
