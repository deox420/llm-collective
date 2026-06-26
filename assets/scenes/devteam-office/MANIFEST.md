# Dev Team — assets pixel-art (PixelLab) · la oficina

Generados con el MCP de PixelLab el **2026-06-26** (cuenta del usuario, Tier 1).
Paleta del modo: coral/amber. Personajes 48px `low top-down`.

> Igual que Council: los `.png` no están aquí porque el entorno de generación bloquea
> por egress los hosts de descarga de PixelLab (403). Bájalos con `fetch.sh` desde una
> máquina con salida a PixelLab. El frontend ya está cableado (`scenes.js`/`InteractiveScene.jsx`).

## Personajes (frame frontal `south`, URL pública)

| Fichero | character_id |
|---------|--------------|
| `architect.png`  | `64f48626-75fd-43ad-9683-f9c27a22478a` |
| `programmer.png` | `0860e96b-10e8-43b5-9372-052c65098bd3` |
| `reviewer.png`   | `4e0556aa-e619-48e7-b3ad-94a5ef7d0572` |
| `tester.png`     | `67a2aa81-9298-45f3-a782-cb81aa061634` |

`https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261/<id>/rotations/south.png`

## Objetos de mapa (EFÍMEROS ~8 h; con `PIXELLAB_API_KEY`)

| Fichero | object_id | Uso |
|---------|-----------|-----|
| `background.png` | `75242b5c-2b9c-4d25-98ac-b440fa31a132` | oficina diáfana (escritorios, sala de reuniones) — fondo |
| `coffee.png` | `a63cb357-544e-437b-9d25-67cc52e26807` | máquina de café (esquina) |

Regenerar (`create_map_object`) si expiran:
- **background.png** — `modern open plan office floor, rows of desks with computers, glass meeting room, gray carpet, symmetrical…` · 360×240 · `high top-down`, lineless
- **coffee.png** — `office coffee machine…` · 56×80 · `high top-down`
