# Council v2 — assets pixel-art (PixelLab) · la mesa redonda

Generados con el MCP de PixelLab el **2026-06-27** (cuenta del usuario). Diseño en
`docs/14-scenes-sdd.md §14.6.1`. Personajes 80px (canvas 112), `low top-down`, sentados
en silla/trono (sin mesa), orientación estricta a la mesa; salón vacío + mesa como sprite
aparte; pergaminos a escala. **Un solo estilo, a proporción.**

> Los `.png` no están aquí: el entorno de generación bloquea por egress la descarga de
> PixelLab (403). Bájalos con `./fetch.sh` desde una máquina con egress (requiere
> `PIXELLAB_API_KEY` para los objetos de mapa y `convert`/ImageMagick para las
> animaciones). El frontend ya está cableado (`scenes.js`/`InteractiveScene.jsx` v2): en
> cuanto los `.png` estén, la escena los usa; si faltan, cae a placeholders.

## Personajes (frame de su dirección de asiento)

| Fichero | character_id | dir |
|---------|--------------|-----|
| `king.png`     | `7d68f799-2f80-41be-a203-6f5037797f69` | south |
| `knight-a.png` | `72b307d0-7eb0-4dba-bdd7-e2e770adfb5e` | east |
| `knight-b.png` | `f704726a-8140-41d6-bb80-9869623231ac` | west |
| `knight-c.png` | `890a84a7-eed9-46c2-a6a8-9c67dd680ea5` | north |

## Animaciones (tira 6×60px; `char_id / anim_id / dir`)

| Fichero | anim_id | dir |
|---------|---------|-----|
| `knight-a.writing.png` | `3f6da357-78ac-474d-86bb-330f0e07c568` | east |
| `knight-a.present.png` | `c1bf69ee-3409-4968-a24b-27e7602de174` | east |
| `knight-b.writing.png` | `f4774dc9-3036-41b3-b94d-07e0794fb46d` | west |
| `knight-b.present.png` | `e66a9d90-b63d-4c1c-ad87-abd8f7fd91c2` | west |
| `knight-c.writing.png` | `80434ccc-a2de-47e5-91f8-57e94d0c4061` | north |
| `knight-c.present.png` | `3975566b-2eb3-4619-932c-72180e57cbf7` | north |
| `king.verdict.png`     | `ad1c35f5-f5b6-4dd7-86a9-e9e08894c066` | south |

`vote` y `breathing_idle` no se generaron como sprite: el motor los cubre con transform
CSS (de pie / respiración). Se pueden añadir luego si se quieren animados.

## Objetos de mapa (EFÍMEROS ~8 h; con `PIXELLAB_API_KEY`)

| Fichero | object_id | Uso |
|---------|-----------|-----|
| `background.png` | `075a1f8d-5f34-4f7c-84df-3a04c0146dec` | salón vacío (muros, estandartes, antorchas, candelabro, alfombra) |
| `table.png` | `8b38f18e-0f5d-4af8-af68-73f4273a248d` | mesa redonda al centro |
| `scroll-blank.png` | `7fea9da1-7f9f-4871-9335-a6172c9468ec` | pergamino en blanco (frente a cada caballero) |
| `scroll-verdict.png` | `32adcc8a-493e-473b-928a-f4da8ebb3c7f` | pergamino del veredicto (centro, en `done`) |

Regenerar (`create_map_object`) si expiran — prompts en inglés en `docs/14-scenes-sdd.md §14.6.1-A`.

## Tras descargar
El frontend los detecta solo (`import.meta.glob`). Es muy probable que haya que **afinar
posiciones/escala** (F-S2) viéndolos compuestos: ajusta `COUNCIL_SEATS`, `tablePos` y los
tamaños en `frontend/src/scenes.js` / `styles.css`.
