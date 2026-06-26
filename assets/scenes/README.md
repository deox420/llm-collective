# assets/scenes

Aqui van los assets pixel-art generados con PixelLab (ver `../../ASSETS.md`).

Una carpeta por tema de escena:

- `council-round-table/` — Council: mesa redonda medieval (tema v1)
- `devteam-office/` — Dev Team: oficina (pendiente)
- `brain-library/` — Second Brain: biblioteca (pendiente)

Cada carpeta contiene `background.png`, los `*.sheet.png` + `*.json` de cada personaje,
objetos sueltos (fondo transparente) y un `theme.json` que implementa `SceneTheme`
(ver `docs/13-interactive-scenes.md` §13.4).

Hasta que existan los assets, la vista interactiva usa placeholders de canvas con el
mismo contrato, asi que sustituir placeholder -> sprite no toca la logica.
