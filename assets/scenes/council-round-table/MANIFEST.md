# Council — assets pixel-art (PixelLab)

Generados con el MCP de PixelLab el **2026-06-26** (cuenta del usuario, Tier 1).
Estilo común: 48px, `low top-down`, contorno negro, basic shading, paleta limitada.

> **Por qué faltan los `.png` aquí:** el entorno remoto de generación bloquea por
> política de egress los hosts de descarga de PixelLab (`api.pixellab.ai` y
> `backblaze.pixellab.ai` → 403). Los assets EXISTEN en la cuenta de PixelLab; solo
> hay que descargarlos desde una máquina con salida a esos hosts (tu equipo local) o
> añadiéndolos al allowlist del entorno. El frontend ya está cableado: en cuanto los
> `.png` estén en esta carpeta, la escena los usa (si no, cae a placeholders).

## Personajes (persistentes — URL pública directa del frame frontal `south`)

| Fichero | character_id | Frame a guardar |
|---------|--------------|-----------------|
| `knight-a.png` | `c179c5ba-3960-44ac-b9cb-f538dc5f46b0` | rotación `south` |
| `knight-b.png` | `984599ba-7768-4d67-b859-5c6f38652e99` | rotación `south` |
| `knight-c.png` | `f4d10030-c67b-4645-9918-55e3342645b1` | rotación `south` |
| `king.png`     | `438e8a36-f8b2-4652-a3c7-0d9c80033e69` | rotación `south` |

URL de cada frame:
`https://backblaze.pixellab.ai/file/pixellab-characters/98e80c31-e06c-45b8-bbd0-0b02ba97d261/<character_id>/rotations/south.png`

(El `download` del MCP, `https://api.pixellab.ai/mcp/characters/<id>/download`, da el zip completo con todas las rotaciones si lo prefieres.)

## Objetos de mapa (EFÍMEROS — se autoborran ~8 h tras crearse, sobre las 01:17 UTC del 2026-06-27)

| Fichero | object_id | Descargar / regenerar |
|---------|-----------|------------------------|
| `table.png`  | `6dfb4b19-d672-471e-87f3-8f089c3a2204` | `https://api.pixellab.ai/mcp/map-objects/<id>/download` |
| `scroll.png` | `3444c4b8-95e1-402e-834e-52c38bc9f7d7` | id. |

Si ya expiraron, regenéralos con el MCP (`create_map_object`):
- **table.png** — `large round wooden table with a polished gold rim, medieval, empty, retro pixel art, limited palette` · 160×160 · `high top-down`
- **scroll.png** — `rolled parchment scroll with a red wax seal, medieval verdict, retro pixel art, limited palette` · 64×64 · `high top-down`

## Cómo bajarlos

Desde una máquina con egress a PixelLab:

```bash
cd assets/scenes/council-round-table
./fetch.sh        # baja los 4 personajes (frame south) + intenta los 2 objetos
```

Luego, en el frontend, no hay que tocar nada: `frontend/src/scenes.js` los detecta
vía `import.meta.glob` y `InteractiveScene.jsx` los pinta. `npm run build` los
incluye.
