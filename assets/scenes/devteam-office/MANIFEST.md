# Dev Team v2 — assets pixel-art (PixelLab) · la oficina

Generados con el MCP de PixelLab el **2026-06-28**. Diseño en `docs/14-scenes-sdd.md §14.6.2`.
Personajes 80px (canvas 112), `low top-down`, 8 direcciones; **caminan** entre 3 zonas
(reuniones izq · café centro · estaciones der). Un solo estilo, a escala.

> Los `.png` **están commiteados** en esta carpeta (procesados a lienzo uniforme 100×120
> bottom-anchored; tiras de marcha 6×100px). Este manifiesto es para regenerarlos. La
> descarga usa los endpoints del MCP (`api.pixellab.ai`, con `PIXELLAB_API_KEY`) — la
> ruta `backblaze` directa puede estar bloqueada por egress.

## Personajes (8 dir + walk S/E/N/W + type + talk)

| slug | character_id |
|------|--------------|
| `architect` | `49b7028d-92a3-42fd-9a65-fb74a6b2ae42` |
| `programmer` | `499f274d-ee6b-41c0-90c8-221cae2619b8` |
| `reviewer` | `304d2a4b-1e9f-4b48-a48d-2b4621a68776` |
| `tester` | `dc2898ba-fc0e-4e26-815d-216afed782a0` |

Ficheros por dev: `<slug>.png` (sur), `<slug>.walk-{s,e,n,w}.png` (tira 6 frames),
`<slug>.type.png`, `<slug>.talk.png`.

## Fondo

| Fichero | object_id |
|---------|-----------|
| `background.png` (oficina: reuniones izq · sofá/café centro · escritorios der) | `fe5c0cdf-fa54-432f-86c3-9933cc47f1bc` (efímero ~8 h) |

Regenerar fondo (`create_map_object`, 360×240, `high top-down`, lineless):
`top-down view of a modern office floor divided in three zones: LEFT a meeting room with
a long table and chairs, CENTER a break area with a coffee machine and a small sofa, RIGHT
an open workspace with a row of desks with computers, grey carpet and wooden floor, walls,
symmetrical, retro pixel art, limited palette`

## Procesado
Cada personaje: descargar zip del MCP, recortar a la ventana común (estático + walk 4 dir
+ type + talk), escalar y pegar BOTTOM-ANCHORED en 100×120; ensamblar tiras 6×100px. El
frontend (`scenes.js`/`InteractiveScene.jsx`) los detecta vía glob; ajusta posiciones en
`DT` (waypoints) si cambias el fondo.
