#!/usr/bin/env python3
"""Genera le icone PNG del sito (emiciclo blu/rosso su fondo scuro) senza librerie esterne.

Uso: python tools/genera_icone.py            (scrive icon-180.png, icon-192.png, icon-512.png)
Le icone rispettano la "zona sicura" delle icone adattive (maskable): il disegno sta
nel cerchio centrale di raggio 40%.
"""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (15, 17, 23)
DEM = (59, 125, 216)
GOP = (214, 69, 69)
TICK = (232, 234, 240)


def color_at(x, y, n):
    cx, cy = n * 0.5, n * 0.63
    r_out, r_in = n * 0.35, n * 0.17
    dx, dy = x - cx, y - cy
    r = (dx * dx + dy * dy) ** 0.5
    if dy <= 0 and r_in <= r <= r_out:
        gap = n * 0.012
        if abs(dx) < gap:
            return TICK if r > r_out - n * 0.05 else BG   # tacca della maggioranza in cima
        return DEM if dx < 0 else GOP
    return BG


def png(n, path):
    rows = []
    sub = [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]   # 4 campioni per pixel: bordi morbidi
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            acc = [0, 0, 0]
            for sx, sy in sub:
                c = color_at(x + sx, y + sy, n)
                acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            row += bytes(v // 4 for v in acc)
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)


if __name__ == "__main__":
    for size in (180, 192, 512):
        png(size, os.path.join(ROOT, f"icon-{size}.png"))
        print(f"icon-{size}.png")
