#!/usr/bin/env bash
# fetch.sh — assets v2 de Council (la mesa redonda, SDD §14.6.1) desde PixelLab.
# Ejecútalo desde una máquina con salida a *.pixellab.ai (el entorno remoto los
# bloquea por egress). Ver MANIFEST.md. Idempotente.
set -euo pipefail
cd "$(dirname "$0")"

CDN="https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261"
MCP="https://api.pixellab.ai/mcp"

# --- Personajes: frame en la dirección de su asiento (orientación estricta) ---
#   king→south · A→east · B→west · C→north
declare -A CHARS=(
  [king.png]="7d68f799-2f80-41be-a203-6f5037797f69 south"
  [knight-a.png]="72b307d0-7eb0-4dba-bdd7-e2e770adfb5e east"
  [knight-b.png]="f704726a-8140-41d6-bb80-9869623231ac west"
  [knight-c.png]="890a84a7-eed9-46c2-a6a8-9c67dd680ea5 north"
)
for out in "${!CHARS[@]}"; do
  read -r cid dir <<< "${CHARS[$out]}"
  echo "↓ $out"
  curl -fSL -o "$out" "$CDN/$cid/rotations/$dir.png"
done

# --- Animaciones: tira horizontal de 6×60px (frames 1..6) que el motor reproduce
#     con steps(6). "char_id anim_id dir". Requiere ImageMagick (convert). ---------
declare -A ANIM=(
  [knight-a.writing.png]="72b307d0-7eb0-4dba-bdd7-e2e770adfb5e 3f6da357-78ac-474d-86bb-330f0e07c568 east"
  [knight-a.present.png]="72b307d0-7eb0-4dba-bdd7-e2e770adfb5e c1bf69ee-3409-4968-a24b-27e7602de174 east"
  [knight-b.writing.png]="f704726a-8140-41d6-bb80-9869623231ac f4774dc9-3036-41b3-b94d-07e0794fb46d west"
  [knight-b.present.png]="f704726a-8140-41d6-bb80-9869623231ac e66a9d90-b63d-4c1c-ad87-abd8f7fd91c2 west"
  [knight-c.writing.png]="890a84a7-eed9-46c2-a6a8-9c67dd680ea5 80434ccc-a2de-47e5-91f8-57e94d0c4061 north"
  [knight-c.present.png]="890a84a7-eed9-46c2-a6a8-9c67dd680ea5 3975566b-2eb3-4619-932c-72180e57cbf7 north"
  [king.verdict.png]="7d68f799-2f80-41be-a203-6f5037797f69 ad1c35f5-f5b6-4dd7-86a9-e9e08894c066 south"
)
if command -v convert >/dev/null 2>&1; then
  for out in "${!ANIM[@]}"; do
    read -r cid aid dir <<< "${ANIM[$out]}"
    echo "↓ $out (animación)"
    tmp="$(mktemp -d)"; ok=1
    for n in 1 2 3 4 5 6; do
      curl -fSL -o "$tmp/$n.png" "$CDN/$cid/animations/$aid/$dir/$n.png" || ok=0
    done
    [ "$ok" = 1 ] && convert "$tmp/1.png" "$tmp/2.png" "$tmp/3.png" "$tmp/4.png" "$tmp/5.png" "$tmp/6.png" \
      -background none -resize 60x60 +append "$out" || echo "  (frames incompletos: regenera, ver MANIFEST.md)"
    rm -rf "$tmp"
  done
else
  echo "ImageMagick (convert) no instalado: omito las tiras de animación (el motor usa el sprite estático con transform CSS)."
fi

# --- Objetos de mapa: efímeros (~8 h). Requieren la API key. ---------------------
if [ -n "${PIXELLAB_API_KEY:-}" ]; then
  for pair in \
    "background.png:075a1f8d-5f34-4f7c-84df-3a04c0146dec" \
    "table.png:8b38f18e-0f5d-4af8-af68-73f4273a248d" \
    "scroll-blank.png:7fea9da1-7f9f-4871-9335-a6172c9468ec" \
    "scroll-verdict.png:32adcc8a-493e-473b-928a-f4da8ebb3c7f"; do
    out="${pair%%:*}"; id="${pair##*:}"
    echo "↓ $out (efímero)"
    curl -fSL -H "Authorization: Bearer $PIXELLAB_API_KEY" \
      -o "$out" "$MCP/map-objects/$id/download" || echo "  (expirado: regenera, ver MANIFEST.md)"
  done
else
  echo "PIXELLAB_API_KEY no definida: omito background/table/scroll-* (regenéralos con el MCP)."
fi

echo "Listo. El frontend detecta los .png automáticamente (scenes.js v2)."
