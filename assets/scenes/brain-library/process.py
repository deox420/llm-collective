#!/usr/bin/env python3
"""process.py — procesa los assets RAW de PixelLab a los PNG finales de la escena
Second Brain (la biblioteca). Ver MANIFEST.md.

- Objetos de mapa (mobiliario/props): recorta el borde transparente (bbox) → PNG
  ajustado, para que el frontend los escale por % con la proporción correcta.
- Fondo: aplana sobre opaco (sin transparencias) a 360×240.
- Bibliotecario (personaje): normaliza estático + tiras de animación a un lienzo
  UNIFORME 100×120 anclado abajo (pies al fondo), usando una VENTANA COMÚN de
  recorte sobre todos los frames (estático + walk 4 dir + search/read/deliver) para
  que no "salten"; ensambla tiras horizontales de 6 frames × 100px (600×120).

Uso: python3 process.py            (procesa lo que haya en raw/ y char/)
"""
from __future__ import annotations
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
CHAR = os.path.join(HERE, "char")   # frames del personaje extraídos del zip

CANVAS_W, CANVAS_H = 100, 120        # lienzo uniforme del sprite (igual que council/devteam)
STRIP_FRAMES = 6                     # tira = 6 frames (CSS steps(6) / iscene-play6v2)


def content_bbox(im: Image.Image):
    """bbox del contenido no transparente (banda alfa)."""
    return im.split()[3].getbbox()


# ── Objetos de mapa: recorta el borde transparente ──────────────────────────
def process_objects():
    names = ["reading-table", "counter", "globe", "pile", "book"]
    for name in names:
        src = os.path.join(RAW, f"{name}.png")
        if not os.path.exists(src):
            print(f"  (falta raw/{name}.png, omito)")
            continue
        im = Image.open(src).convert("RGBA")
        bb = content_bbox(im)
        if bb:
            im = im.crop(bb)
        im.save(os.path.join(HERE, f"{name}.png"))
        print(f"  {name}.png  {im.size}")


# ── Fondo: aplana sobre opaco a 360×240 ─────────────────────────────────────
def process_background():
    src = os.path.join(RAW, "background.png")
    if not os.path.exists(src):
        print("  (falta raw/background.png, omito)")
        return
    im = Image.open(src).convert("RGBA")
    if im.size != (360, 240):
        # recorta/encajha a 3:2 conservando la parte superior (muro) + suelo
        im = im.resize((360, 240), Image.NEAREST) if im.size[0] / im.size[1] == 1.5 else im.crop((0, 0, 360, 240))
    # rellena cualquier transparencia con el color de una esquina (muro/suelo)
    fill = im.getpixel((2, 2))[:3]
    flat = Image.new("RGBA", im.size, fill + (255,))
    flat.alpha_composite(im)
    flat.convert("RGBA").save(os.path.join(HERE, "background.png"))
    print(f"  background.png {flat.size} fill={fill}")


# ── Personaje: lienzo uniforme 100×120 anclado abajo + tiras de 6 frames ─────
# Estructura del zip de PixelLab: <Nombre>/rotations/<dir>.png y
# <Nombre>/animations/<accion>/<dir>/frame_NNN.png (walk: 6f; v3: 7f = 1 ref + 6).
def _char_root():
    """detecta la subcarpeta del personaje dentro de char/ (la que tiene rotations/)."""
    if not os.path.isdir(CHAR):
        return None
    for name in sorted(os.listdir(CHAR)):
        p = os.path.join(CHAR, name)
        if os.path.isdir(p) and os.path.isdir(os.path.join(p, "rotations")):
            return p
    return None


ROOT = _char_root() or os.path.join(CHAR, "Librarian")
# prefijo de carpeta de cada acción v3 (los nombres son la descripción truncada)
ACT_DIR = {
    "search": ("reaching_up_with_one_arm_to_pull_a_book_from_a_hig", "north"),
    "read": ("standing_and_reading_an_open_book_held_in_both_han", "south"),
    "deliver": ("holding_out_a_book_with_both_hands_presenting_it_f", "south"),
}


def _load_dir(direction_dir):
    """carga todos los frame_*.png de un directorio, ordenados."""
    if not os.path.isdir(direction_dir):
        return []
    files = sorted(f for f in os.listdir(direction_dir) if f.startswith("frame_") and f.endswith(".png"))
    return [Image.open(os.path.join(direction_dir, f)).convert("RGBA") for f in files]


def process_character():
    if not os.path.isdir(ROOT):
        print("  (falta char/Librarian/, omito personaje — extrae el zip primero)")
        return
    static = Image.open(os.path.join(ROOT, "rotations", "south.png")).convert("RGBA")
    builds = {}  # dest_name -> [frames]
    # tiras de marcha (6 frames) por dirección cardinal
    for short, full in {"s": "south", "e": "east", "n": "north", "w": "west"}.items():
        fr = _load_dir(os.path.join(ROOT, "animations", "walking", full))
        if len(fr) >= 6:
            builds[f"librarian.walk-{short}.png"] = fr[:6]
    # acciones v3 (7 frames → 6: descartamos el frame 0 de referencia)
    for act, (folder, direction) in ACT_DIR.items():
        fr = _load_dir(os.path.join(ROOT, "animations", folder, direction))
        if len(fr) >= 7:
            builds[f"librarian.{act}.png"] = fr[1:7]
        elif len(fr) == 6:
            builds[f"librarian.{act}.png"] = fr

    # VENTANA COMÚN: union de bboxes de TODOS los frames usados + estático.
    all_frames = [static] + [f for fr in builds.values() for f in fr]
    boxes = [content_bbox(f) for f in all_frames if content_bbox(f)]
    L = min(b[0] for b in boxes); T = min(b[1] for b in boxes)
    R = max(b[2] for b in boxes); Bm = max(b[3] for b in boxes)
    win = (L, T, R, Bm)
    win_w, win_h = R - L, Bm - T
    scale = min(CANVAS_W / win_w, CANVAS_H / win_h)
    sw, sh = max(1, round(win_w * scale)), max(1, round(win_h * scale))
    ox = (CANVAS_W - sw) // 2
    oy = CANVAS_H - sh   # anclado abajo (pies al fondo)
    print(f"  ventana común={win} ({win_w}x{win_h}) scale={scale:.3f} -> {sw}x{sh} @({ox},{oy})")

    def normalize(im):
        c = im.crop(win).resize((sw, sh), Image.NEAREST)
        canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        canvas.alpha_composite(c, (ox, oy))
        return canvas

    # estático (south)
    normalize(static).save(os.path.join(HERE, "librarian.png"))
    print("  librarian.png (estático south)")
    # tiras
    for dest, frames in builds.items():
        strip = Image.new("RGBA", (CANVAS_W * STRIP_FRAMES, CANVAS_H), (0, 0, 0, 0))
        for i, f in enumerate(frames[:STRIP_FRAMES]):
            strip.alpha_composite(normalize(f), (i * CANVAS_W, 0))
        strip.save(os.path.join(HERE, dest))
        print(f"  {dest} ({STRIP_FRAMES}×{CANVAS_W}px)")


if __name__ == "__main__":
    print("Objetos:");      process_objects()
    print("Fondo:");        process_background()
    print("Personaje:");    process_character()
    print("Listo.")
