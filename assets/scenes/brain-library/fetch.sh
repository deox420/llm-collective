#!/usr/bin/env bash
# fetch.sh — descarga los assets pixel-art de Second Brain (la biblioteca) desde PixelLab.
# Ejecútalo desde una máquina con salida a *.pixellab.ai. Ver MANIFEST.md. Idempotente.
set -euo pipefail
cd "$(dirname "$0")"

CDN="https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261"
MCP="https://api.pixellab.ai/mcp"

# Personajes: frame frontal (south). URL pública, sin auth.
declare -A CHARS=(
  [librarian.png]=19dd61be-cdf8-40c5-8971-5e499594ad3c
)
for out in "${!CHARS[@]}"; do
  echo "↓ $out"
  curl -fSL -o "$out" "$CDN/${CHARS[$out]}/rotations/south.png"
done

# Objetos de mapa: efímeros (~8 h). Requieren la API key. Regenera si expiran (MANIFEST.md).
if [ -n "${PIXELLAB_API_KEY:-}" ]; then
  for pair in \
    "background.png:3590f6e1-1299-4363-9d24-5f67dc59bb08" \
    "books.png:9d57aa8e-8771-4fbe-b908-045aa0761178" \
    "candle.png:bbdb657d-f921-47cf-8db0-07302b92f627"; do
    out="${pair%%:*}"; id="${pair##*:}"
    echo "↓ $out (efímero)"
    curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" \
      -o "$out" "$MCP/map-objects/$id/download" || echo "  (expirado: regenera, ver MANIFEST.md)"
  done
else
  echo "PIXELLAB_API_KEY no definida: omito background/books/candle (regenéralos con el MCP)."
fi

echo "Listo. El frontend detecta los .png automáticamente (scenes.js)."
