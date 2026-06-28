#!/usr/bin/env bash
# fetch.sh — descarga los assets RAW de Dev Team v2 (zips de personaje + fondo) desde
# PixelLab para reprocesarlos. Los .png ya procesados están commiteados; esto es para
# regenerar. Requiere PIXELLAB_API_KEY. Ver MANIFEST.md. El ensamblado a lienzo uniforme
# 100x120 (bottom-anchored) + tiras lo hace el helper de procesado (no incluido aquí).
set -euo pipefail
cd "$(dirname "$0")"
MCP="https://api.pixellab.ai/mcp"
[ -n "${PIXELLAB_API_KEY:-}" ] || { echo "Define PIXELLAB_API_KEY"; exit 1; }

declare -A CHARS=(
  [architect]=49b7028d-92a3-42fd-9a65-fb74a6b2ae42
  [programmer]=499f274d-ee6b-41c0-90c8-221cae2619b8
  [reviewer]=304d2a4b-1e9f-4b48-a48d-2b4621a68776
  [tester]=dc2898ba-fc0e-4e26-815d-216afed782a0
)
mkdir -p raw
for slug in "${!CHARS[@]}"; do
  echo "↓ $slug.zip (rotaciones + animaciones)"
  curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" -o "raw/$slug.zip" "$MCP/characters/${CHARS[$slug]}/download"
done
echo "↓ background.png (efímero ~8 h)"
curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" -o background.png "$MCP/map-objects/fe5c0cdf-fa54-432f-86c3-9933cc47f1bc/download" \
  || echo "  (fondo expirado: regenera con create_map_object, ver MANIFEST.md)"
echo "Listo. Reprocesa los zips a 100x120 bottom-anchored + tiras (ver MANIFEST.md §Procesado)."
