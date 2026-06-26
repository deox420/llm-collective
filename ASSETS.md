# ASSETS.md — Pixel-art con PixelLab

Cómo generar los personajes y escenarios pixel-art de las vistas interactivas usando **PixelLab**, vía su servidor MCP (recomendado para Claude Code) o su API/SDK.

Referencia: [13 · Escenas interactivas](docs/13-interactive-scenes.md) y [ADR-0007](docs/adr/0007-pixellab-assets.md).

---

## 1. Configurar el MCP de PixelLab

Hay dos formas según el cliente que uses. **No pongas tu API key en archivos versionados.**

### Opción A — Claude Code (terminal)

```bash
claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer TU_API_KEY"
```

- `-t http` indica transporte HTTP; `-H` pasa la cabecera de autorización.
- Reinicia Claude Code tras añadirlo para que cargue las herramientas.

A nivel de repo, [`.mcp.json`](.mcp.json) ya deja registrado el servidor usando `${PIXELLAB_API_KEY}` del entorno (exporta esa variable en tu shell o `.env`).

### Opción B — Claude Desktop (JSON)

1. Abre Claude Desktop → Settings → Developer → **Edit MCP Settings**.
2. Pega la configuración de [`claude-desktop-mcp.example.json`](claude-desktop-mcp.example.json), sustituyendo `TU_PIXELLAB_API_KEY` por tu clave.
3. Reinicia Claude Desktop.

Esta variante usa `npx mcp-remote` como puente:

```json
{
  "mcpServers": {
    "pixellab": {
      "command": "npx",
      "args": ["mcp-remote@latest", "https://api.pixellab.ai/mcp",
               "--transport", "http-only", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer TU_PIXELLAB_API_KEY" }
    }
  }
}
```

> Para tu uso local hay un `claude-desktop-mcp.local.json` con la clave ya puesta, **ignorado por git** (no se sube). Si prefieres, regenera la clave en PixelLab y actualiza ese archivo.

Para que Claude encuentre y entienda las herramientas, puedes incluir en el prompt el enlace de overview:

```
@ https://api.pixellab.ai/mcp/docs
```

### Herramientas MCP disponibles (las que usaremos)

- `create_character(description, n_directions)` — personaje en 4 u 8 direcciones.
- `animate_character(character_id, animation)` — añade animación (idle, walk, talk…).
- `create_map_object(description, background_image?)` — objeto con fondo transparente (pergamino, libros, máquina de café…), con *style matching* opcional para casar con la escena.
- Tilesets (`create_topdown_tileset`, etc.) — solo si más adelante hacemos escenarios por tiles.

Alternativa sin MCP: **API REST** (`https://api.pixellab.ai/v1/docs`) o el **SDK de Python** (`pixellab-code/pixellab-python`), útil si automatizamos la generación desde un script del repo.

---

## 2. Convención de salida

Guarda los assets generados así (coincide con `docs/13-interactive-scenes.md` §13.5):

```
assets/scenes/council-round-table/
  background.png        # salón + mesa redonda
  knight-a.sheet.png    # spritesheet caballero A   (+ knight-a.json con frames)
  knight-b.sheet.png
  knight-c.sheet.png
  king.sheet.png        # idle, synthesize, deliver
  scroll.png            # pergamino del veredicto (map object, fondo transparente)
  theme.json            # implementa SceneTheme (§13.4)
```

Estados mínimos por personaje: **idle** y **talk** (caballeros); **idle** y **synthesize** (rey).
Tamaño de sprite recomendado: fija uno (p. ej. 64×64) para todos los personajes de un modo, para que encajen.

---

## 3. Prompts de generación — Council (mesa redonda medieval)

Paleta del modo: teal `#16b8a6` (acento), oro `#e8b923` (rey/veredicto). Estilo: pixel-art retro, paleta limitada, vista frontal/ligero picado.

### Fondo (Create image — PixFlux, tamaño M-XL)

```
medieval stone hall interior, large round wooden table with a gold rim in the center,
lit torches on the stone walls, checkerboard stone floor, symmetrical, warm torchlight,
empty seats around the table, top-down slightly tilted view, pixel art, limited palette
```

Negative: `modern objects, text, people, watermark, blurry, smooth gradients`

### Caballero A — "Knight of the West" (`create_character`)

```
description: medieval knight sitting at a table, blue tunic, polished steel helmet with a blue plume, chainmail shoulders, calm posture, pixel art, limited palette, front view
n_directions: 1   (solo frontal; o 4 si quieres reutilizarlo)
```
Animaciones (`animate_character`): `idle`, luego una de `talking` / `leaning forward, gesturing`.

### Caballero B — "Knight of the Dawn"

```
description: medieval knight sitting at a table, crimson tunic, steel helmet with a red plume, chainmail shoulders, attentive posture, pixel art, limited palette, front view
```
Genera este **condicionado al estilo del Caballero A** (style reference) para mantener coherencia. Animaciones: `idle`, `talking`.

### Caballero C — "Knight of the Dusk"

```
description: medieval knight sitting at a table, green tunic, steel helmet with a green plume, chainmail shoulders, thoughtful posture, pixel art, limited palette, front view
```
Style reference del A. Animaciones: `idle`, `talking`.

### El Rey (Chairman)

```
description: medieval king on a throne, golden crown, red royal mantle with ermine trim, bearded, regal, pixel art, limited palette, front view
```
Style reference del A para que case. Animaciones: `idle`, `synthesize` / `standing up, raising hand`.

### Pergamino del veredicto (`create_map_object`, fondo transparente)

```
description: rolled parchment scroll with a red wax seal, medieval, pixel art, transparent background
```

---

## 4. Cómo se integra en el código (Fase 6)

El contrato `SceneTheme` (`docs/13-interactive-scenes.md` §13.4) ya separa lógica de dibujo. Integrar = tres pasos:

1. Coloca los assets en `assets/scenes/council-round-table/`.
2. En el componente de escena, sustituye el dibujo placeholder de rectángulos por `drawSprite(sheet, frame)` usando los frames del `.json`.
3. Cablea el **mapa etapa→pose** (ya aislado) a los frames: `opinions`→frame talk del que habla; `synthesis`→frame synthesize del rey; etc.

No toques la lógica de etapas ni la de concurrencia al integrar arte.

---

## 5. Prompts de los otros modos (cuando toque)

- **Dev Team (oficina):** fondo de planta de oficina con escritorios + sala de reuniones + máquina de café; personajes "developer" con variantes; objetos: ordenador, taza de café. Estados: `working` (en escritorio), `waiting` (en la cafetera), `handoff` (en la reunión).
- **Second Brain (biblioteca):** fondo de biblioteca con estanterías, mesas de lectura y un mostrador; personaje "librarian"; objetos: libros (map objects). Estados: `searching` (en estanterías), `reading` (en mesa), `delivering` (en mostrador).

Genera cada modo con su propia *style reference* para mantener coherencia interna, y usa la paleta del modo (Dev Team coral/amber, Second Brain púrpura).
