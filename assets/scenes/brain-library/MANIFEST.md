# Second Brain — assets pixel-art (PixelLab) · la biblioteca (grand-classic, v2)

Escena interactiva de Second Brain: una **gran biblioteca clásica** (caoba oscura y
oro, ventanales en arco, alfombra púrpura con greca dorada). Acento del modo: **púrpura**.
Diseño en `docs/14-scenes-sdd.md §14.6.3` + ADR-0011 (coreografía de escena).

Generado con el MCP de PixelLab el **2026-06-28** (cuenta del usuario, Tier 1). Los `.png`
**procesados están commiteados** en esta carpeta. `process.py` reconstruye los finales a
partir de los crudos en `raw/`. Perspectiva **coherente con Council**: estanterías
EMPOTRADAS en el muro del fondo (parte del fondo, frontal); en el suelo (cenital) solo
piezas vistas **desde arriba** (mesa, mostrador) y accesorios planos (globo, pila de
libros). El bibliotecario va en 3/4 y CAMINA entre zonas.

> Egress: `api.pixellab.ai` es alcanzable con `PIXELLAB_API_KEY`; la descarga directa de
> `backblaze.*` está bloqueada (403) → se usan los **zips** del MCP
> (`/mcp/characters/<id>/download`) y `/mcp/map-objects/<id>/download`. Los map-objects
> **caducan ~8 h**: si expiran, regenéralos con los prompts de abajo (`fetch.sh` los baja).

## Personaje — Bibliotecario (8 dir, 80px, low top-down)

| slug | character_id |
|------|--------------|
| `librarian` (GrandLibrarian) | `de935b60-d210-41de-90e4-33a047256613` |

Descripción: *"a distinguished elderly librarian in a long refined dark purple robe with
gold trim, round spectacles, neat grey hair, holding an old leather-bound book"*.
Ficheros (lienzo uniforme 100×120 anclado abajo; tiras 6×100px):
`librarian.png` (sur), `librarian.walk-{s,e,n,w}.png`, `librarian.search.png` (norte,
busca en la estantería), `librarian.read.png` (sur, lee), `librarian.deliver.png` (sur,
entrega). Animaciones: `walk` (template, S/E/N/O) + v3 custom search/read/deliver.

## Fondo + objetos de mapa (EFÍMEROS ~8 h)

| Fichero | object_id | Uso |
|---------|-----------|-----|
| `background.png` | `1a62ef09-28f5-4d30-aeeb-ab422b5c8437` | gran salón: muro del fondo con estanterías empotradas + 3 ventanales en arco, suelo de caoba, alfombra púrpura con greca dorada (vacío, sin muebles sueltos) |
| `reading-table.png` | `ceaa15f4-ea58-4830-905e-43cb4fa2c742` | mesa de lectura **cenital** (tapa con libro abierto + flexo verde) |
| `counter.png` | `dc02ff5d-3672-48b9-b73e-d3f23f4cda04` | mostrador de circulación **cenital** (tablero con libros) |
| `globe.png` | `59eca790-5e26-4eb5-ae0e-8ba2f41acb5b` | globo terráqueo (accesorio de ambiente, izq.) |
| `pile.png` | `d69890d3-1d0d-4cd5-aab2-85fdf13383a5` | pila de libros + pergamino en el suelo (accesorio, der.) |
| `book.png` | `1f0e03e4-7898-404a-acae-5b6ec8162a1c` | libro (prop dinámico: uno por nota recuperada) |

Prompts (todos `retro pixel art, rich warm palette`; muebles `high top-down` "desde arriba"):
- **background** (`360×240`, `low top-down`, lineless): *grand old library hall, the entire
  back wall lined with tall floor-to-ceiling dark mahogany bookshelves packed with colorful
  books, two tall arched windows glowing warm light, dark polished wood floor, large ornate
  deep-purple rug with gold woven border, no free-standing furniture, no people.*
- **reading-table** (`200×140`): *rectangular dark oak library reading table viewed straight
  from directly above, flat tabletop with an open book and a green banker's lamp.*
- **counter** (`230×130`): *long rectangular library circulation counter viewed from directly
  above, flat countertop with a small stack of books and papers.*
- **globe** (`90×90`): *antique terrestrial globe in a low circular wooden stand, viewed from
  a high overhead angle.*
- **pile** (`90×90`): *wide low stack of large old leather books and a couple of rolled
  scrolls lying on the floor, viewed from directly above.*
- **book** (`64×56`): *small stack of old leather-bound books with gold lettering.*

## Procesado (`process.py`)
- Objetos de mapa: recorte del borde transparente (bbox) → PNG ajustado (el frontend los
  escala por % con la proporción correcta).
- Fondo: aplanado sobre opaco a 360×240.
- Personaje: estático + tiras a lienzo **uniforme 100×120 anclado abajo**, usando una
  **ventana común** sobre todos los frames (estático + walk 4 dir + search/read/deliver)
  para que no salten; tiras horizontales de 6×100px (CSS `steps(6)`/`iscene-play6v2`).

## Tras descargar/regenerar
El frontend los detecta solos (`import.meta.glob` en `scenes.js`). Posiciones/escala de los
muebles y waypoints del bibliotecario en `frontend/src/scenes.js` (`brain` + `BRAIN_WP`).
