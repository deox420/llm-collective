#!/usr/bin/env bash
# fetch.sh — descarga los assets pixel-art de Council desde PixelLab.
# Ejecútalo desde una máquina con salida a *.pixellab.ai (el entorno remoto de
# generación los bloquea por egress). Ver MANIFEST.md. Idempotente.
set -euo pipefail
cd "$(dirname "$0")"

CDN="https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261"
MCP="https://api.pixellab.ai/mcp"

# Personajes: frame frontal (south). URL pública, sin auth.
declare -A KNIGHTS=(
  [knight-a.png]=c179c5ba-3960-44ac-b9cb-f538dc5f46b0
  [knight-b.png]=984599ba-7768-4d67-b859-5c6f38652e99
  [knight-c.png]=f4d10030-c67b-4645-9918-55e3342645b1
  [king.png]=438e8a36-f8b2-4652-a3c7-0d9c80033e69
)
for out in "${!KNIGHTS[@]}"; do
  echo "↓ $out"
  curl -fSL -o "$out" "$CDN/${KNIGHTS[$out]}/rotations/south.png"
done

# Objetos de mapa: efímeros (~8 h). Requieren la API key. Si han expirado,
# regenéralos con el MCP (ver MANIFEST.md) — no es un error fatal.
if [ -n "${PIXELLAB_API_KEY:-}" ]; then
  for pair in "table.png:6dfb4b19-d672-471e-87f3-8f089c3a2204" "scroll.png:3444c4b8-95e1-402e-834e-52c38bc9f7d7"; do
    out="${pair%%:*}"; id="${pair##*:}"
    echo "↓ $out (efímero)"
    curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" \
      -o "$out" "$MCP/map-objects/$id/download" || echo "  (expirado: regenera con create_map_object, ver MANIFEST.md)"
  done
else
  echo "PIXELLAB_API_KEY no definida: omito table.png/scroll.png (regenéralos con el MCP)."
fi

echo "Listo. El frontend detecta los .png automáticamente (scenes.js)."
