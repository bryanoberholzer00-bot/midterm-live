#!/usr/bin/env python3
"""Genera counties/<STATO>.json (contorni delle contee, proiezione Albers USA) da us-atlas counties-10m.json.

Uso: python tools/genera_contee.py <percorso counties-10m.json> <cartella di uscita>

Ogni file contiene {"bbox": [x0, y0, x1, y1], "counties": {"<fips contea>": {"n": nome, "d": path, "b": bbox}}}
nello stesso sistema di coordinate di states.js (960x500), così la pagina può ritagliare
lo stato con un viewBox e colorare le contee in base ai risultati.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genera_stati import FIPS, LOWER48, ALASKA, HAWAII  # noqa: E402


def main(path, outdir):
    topo = json.load(open(path, encoding="utf-8"))
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)

    def ring_points(ring):
        out = []
        for idx in ring:
            pts = arcs[~idx][::-1] if idx < 0 else arcs[idx]
            if out and out[-1] == pts[0]:
                pts = pts[1:]
            out.extend(pts)
        return out

    per_state = {}
    for g in topo["objects"]["counties"]["geometries"]:
        st = FIPS.get(g["id"][:2])
        if not st:
            continue
        proj = ALASKA if st == "AK" else HAWAII if st == "HI" else LOWER48
        polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        d_parts = []
        entry = per_state.setdefault(st, {"bbox": [1e9, 1e9, -1e9, -1e9], "counties": {}})
        bb = entry["bbox"]
        cb = [1e9, 1e9, -1e9, -1e9]
        for poly in polys:
            for ring in poly:
                pts = [proj(lon, lat) for lon, lat in ring_points(ring)]
                if len(pts) < 3:
                    continue
                for x, y in pts:
                    for box in (bb, cb):
                        if x < box[0]: box[0] = x
                        if y < box[1]: box[1] = y
                        if x > box[2]: box[2] = x
                        if y > box[3]: box[3] = y
                d_parts.append("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
        entry["counties"][g["id"][2:]] = {"n": g["properties"]["name"], "d": "".join(d_parts),
                                          "b": [round(v, 1) for v in cb]}

    os.makedirs(outdir, exist_ok=True)
    total = 0
    for st, entry in per_state.items():
        entry["bbox"] = [round(v, 1) for v in entry["bbox"]]
        data = json.dumps(entry, separators=(",", ":"), ensure_ascii=False)
        with open(os.path.join(outdir, f"{st}.json"), "w", encoding="utf-8") as f:
            f.write(data)
        total += len(data)
    print(f"{len(per_state)} stati, {total // 1024} KB totali", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
