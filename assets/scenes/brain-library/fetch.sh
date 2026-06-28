#!/usr/bin/env bash
# fetch.sh — descarga los assets RAW de Second Brain v2 (grand-classic) desde PixelLab
# para reprocesarlos con process.py. Los .png procesados ya están commiteados; esto es
# para regenerar. Requiere PIXELLAB_API_KEY. Ver MANIFEST.md.
#
# Nota: backblaze.* puede estar bloqueado por egress (403); por eso el personaje se baja
# como ZIP del MCP (rotaciones + animaciones). Los map-objects CADUCAN ~8 h: si dan 404,
# regéneralos con los prompts del MANIFEST y actualiza los IDs aquí.
set -euo pipefail
cd "$(dirname "$0")"
MCP="https://api.pixellab.ai/mcp"
[ -n "${PIXELLAB_API_KEY:-}" ] || { echo "Define PIXELLAB_API_KEY"; exit 1; }
mkdir -p raw char

# --- Personaje (zip: rotaciones + animaciones walk/search/read/deliver) ---
CHAR=de935b60-d210-41de-90e4-33a047256613
echo "↓ librarian.zip (GrandLibrarian)"
curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" -o raw/librarian.zip "$MCP/characters/$CHAR/download"
rm -rf char/* && ( cd char && unzip -q ../raw/librarian.zip )

# --- Fondo + objetos de mapa (EFÍMEROS ~8 h) ---
declare -A OBJ=(
  [background]=1a62ef09-28f5-4d30-aeeb-ab422b5c8437
  [reading-table]=ceaa15f4-ea58-4830-905e-43cb4fa2c742
  [counter]=dc02ff5d-3672-48b9-b73e-d3f23f4cda04
  [globe]=59eca790-5e26-4eb5-ae0e-8ba2f41acb5b
  [pile]=d69890d3-1d0d-4cd5-aab2-85fdf13383a5
  [book]=1f0e03e4-7898-404a-acae-5b6ec8162a1c
)
for name in "${!OBJ[@]}"; do
  echo "↓ $name.png (efímero)"
  curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" \
    -o "raw/$name.png" "$MCP/map-objects/${OBJ[$name]}/download" \
    || echo "  ($name expirado: regenera con MANIFEST.md y actualiza el ID)"
done

echo "Reprocesando a los .png finales…"
python3 process.py
echo "Listo. El frontend detecta los .png automáticamente (scenes.js)."
