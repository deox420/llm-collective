# Second Brain — assets pixel-art (PixelLab) · la biblioteca

Generados con el MCP de PixelLab el **2026-06-26** (cuenta del usuario, Tier 1).
Paleta del modo: púrpura. Personaje 48px `low top-down`.

> Igual que Council: los `.png` no están aquí porque el entorno de generación bloquea
> por egress los hosts de descarga de PixelLab (403). Bájalos con `fetch.sh` desde una
> máquina con salida a PixelLab. El frontend ya está cableado.

## Personajes (frame frontal `south`, URL pública)

| Fichero | character_id |
|---------|--------------|
| `librarian.png` | `19dd61be-cdf8-40c5-8971-5e499594ad3c` |

`https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261/<id>/rotations/south.png`

## Objetos de mapa (EFÍMEROS ~8 h; con `PIXELLAB_API_KEY`)

| Fichero | object_id | Uso |
|---------|-----------|-----|
| `background.png` | `3590f6e1-1299-4363-9d24-5f67dc59bb08` | biblioteca (estanterías, mesas, lámparas) — fondo |
| `books.png` | `9d57aa8e-8771-4fbe-b908-045aa0761178` | pila de libros (notas recuperadas) |
| `candle.png` | `bbdb657d-f921-47cf-8db0-07302b92f627` | vela sobre la mesa |

Regenerar (`create_map_object`) si expiran:
- **background.png** — `cozy library interior, tall wooden bookshelves full of colorful books, reading tables, warm lamplight, wooden floor, symmetrical…` · 360×240 · `high top-down`, lineless
- **books.png** — `stack of colorful old books…` · 64×64 · `high top-down`
- **candle.png** — `lit candle on a brass holder, warm glow…` · 40×56 · `high top-down`
