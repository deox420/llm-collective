#!/usr/bin/env bash
# fetch.sh — descarga los assets pixel-art de Dev Team (la oficina) desde PixelLab.
# Ejecútalo desde una máquina con salida a *.pixellab.ai. Ver MANIFEST.md. Idempotente.
set -euo pipefail
cd "$(dirname "$0")"

CDN="https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261"
MCP="https://api.pixellab.ai/mcp"

# Personajes: frame frontal (south). URL pública, sin auth.
declare -A CHARS=(
  [architect.png]=64f48626-75fd-43ad-9683-f9c27a22478a
  [programmer.png]=0860e96b-10e8-43b5-9372-052c65098bd3
  [reviewer.png]=4e0556aa-e619-48e7-b3ad-94a5ef7d0572
  [tester.png]=67a2aa81-9298-45f3-a782-cb81aa061634
)
for out in "${!CHARS[@]}"; do
  echo "↓ $out"
  curl -fSL -o "$out" "$CDN/${CHARS[$out]}/rotations/south.png"
done

# Objetos de mapa: efímeros (~8 h). Requieren la API key. Regenera si expiran (MANIFEST.md).
if [ -n "${PIXELLAB_API_KEY:-}" ]; then
  for pair in \
    "background.png:75242b5c-2b9c-4d25-98ac-b440fa31a132" \
    "coffee.png:a63cb357-544e-437b-9d25-67cc52e26807"; do
    out="${pair%%:*}"; id="${pair##*:}"
    echo "↓ $out (efímero)"
    curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" \
      -o "$out" "$MCP/map-objects/$id/download" || echo "  (expirado: regenera, ver MANIFEST.md)"
  done
else
  echo "PIXELLAB_API_KEY no definida: omito background.png/coffee.png (regenéralos con el MCP)."
fi

echo "Listo. El frontend detecta los .png automáticamente (scenes.js)."
