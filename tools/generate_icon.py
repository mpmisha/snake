#!/usr/bin/env python3
"""Generates the Snake app icon.

Original artwork in the shared beveled-candy style: a twilight gradient plate
with a small green candy-block snake curving toward a glossy candy treat.

Usage:
    python3 tools/generate_icon.py

Writes: icons/icon-1024.png, icon-512.png, icon-192.png, icon-180.png
"""

from __future__ import annotations

import colorsys
import os

from PIL import Image, ImageDraw

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

BACKGROUND_TOP = (92, 120, 219)
BACKGROUND_BOTTOM = (56, 66, 153)

GREEN = (82, 201, 102)      # Candy green — snake body
GREEN_HEAD = (96, 214, 116)
PINK = (247, 102, 166)      # treat


def scale_rgb(rgb, factor):
    r, g, b = (c / 255.0 for c in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    v = max(0.0, min(1.0, v * factor))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r * 255), int(g * 255), int(b * 255))


def blend_white(rgb, amount):
    return tuple(int(c + (255 - c) * amount) for c in rgb)


def draw_gradient(image):
    draw = ImageDraw.Draw(image)
    for y in range(SIZE):
        ratio = y / (SIZE - 1)
        color = tuple(
            int(BACKGROUND_TOP[i] + (BACKGROUND_BOTTOM[i] - BACKGROUND_TOP[i]) * ratio)
            for i in range(3)
        )
        draw.line([(0, y), (SIZE, y)], fill=color)


def draw_block(overlay, cx, cy, side, color, corner=0.30):
    """Draws one beveled candy block centered at (cx, cy)."""
    draw = ImageDraw.Draw(overlay)
    x = cx - side / 2
    y = cy - side / 2
    radius = side * corner

    body = [x, y, x + side, y + side]
    draw.rounded_rectangle(body, radius=radius, fill=scale_rgb(color, 0.62) + (255,))

    inset = side * 0.12
    face = [x + inset, y + inset * 0.7, x + side - inset, y + side - inset * 1.8]
    draw.rounded_rectangle(face, radius=radius * 0.7, fill=color + (255,))

    gloss_bottom = face[1] + (face[3] - face[1]) * 0.4
    draw.rounded_rectangle(
        [face[0], face[1], face[2], gloss_bottom],
        radius=radius * 0.6,
        fill=blend_white(color, 0.22) + (255,),
    )

    hs = side * 0.2
    hx = face[0] + side * 0.08
    hy = face[1] + side * 0.08
    draw.rounded_rectangle([hx, hy, hx + hs, hy + hs * 0.6], radius=hs * 0.3,
                           fill=blend_white(color, 0.6) + (255,))


def draw_treat(overlay, cx, cy, r, color):
    draw = ImageDraw.Draw(overlay)
    draw.ellipse([cx - r, cy - r + r * 0.05, cx + r, cy + r + r * 0.05],
                 fill=scale_rgb(color, 0.6) + (255,))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
    # gloss cap
    gr = r * 0.72
    draw.ellipse([cx - gr, cy - r * 0.72, cx + gr, cy - r * 0.72 + gr * 1.1],
                 fill=blend_white(color, 0.35) + (200,))
    # glint
    draw.ellipse([cx - r * 0.5, cy - r * 0.52, cx - r * 0.5 + r * 0.28, cy - r * 0.52 + r * 0.22],
                 fill=blend_white(color, 0.8) + (255,))


def draw_eyes(overlay, cx, cy, side):
    draw = ImageDraw.Draw(overlay)
    er = side * 0.11
    pr = side * 0.055
    for sx in (-1, 1):
        ex = cx + sx * side * 0.18
        ey = cy - side * 0.05
        draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 255, 255, 255))
        draw.ellipse([ex - pr, ey - pr + er * 0.2, ex + pr, ey + pr + er * 0.2],
                     fill=(32, 38, 79, 255))


def main():
    image = Image.new("RGB", (SIZE, SIZE), BACKGROUND_TOP)
    draw_gradient(image)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Twilight plate.
    plate = ImageDraw.Draw(overlay)
    m = SIZE * 0.14
    plate.rounded_rectangle([m, m, SIZE - m, SIZE - m], radius=SIZE * 0.14,
                            fill=(38, 45, 96, 235))

    cell = SIZE * 0.145
    # Snake body path — an L/curve of segments, head last.
    body = [
        (0, 2), (0, 1), (0, 0), (1, 0), (2, 0),
    ]
    # Map grid coords to canvas, roughly centered-left.
    ox = SIZE * 0.34
    oy = SIZE * 0.36
    pts = [(ox + gx * cell, oy + gy * cell) for (gx, gy) in body]

    for i, (px, py) in enumerate(pts):
        is_head = i == len(pts) - 1
        color = GREEN_HEAD if is_head else (GREEN if i % 2 == 0 else blend_white(GREEN, 0.08))
        draw_block(overlay, px, py, cell * 0.94, color, corner=0.42 if is_head else 0.3)
    # Eyes on head.
    hx, hy = pts[-1]
    draw_eyes(overlay, hx, hy, cell)

    # Treat ahead of the head (to the right).
    tx = hx + cell * 1.05
    ty = hy
    draw_treat(overlay, tx, ty, cell * 0.34, PINK)

    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

    os.makedirs(OUT_DIR, exist_ok=True)
    master = os.path.join(OUT_DIR, "icon-1024.png")
    image.save(master, "PNG")
    print(f"Wrote {master} ({SIZE}x{SIZE})")
    for size in (512, 192, 180):
        resized = image.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        resized.save(path, "PNG")
        print(f"Wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
