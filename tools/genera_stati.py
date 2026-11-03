#!/usr/bin/env python3
"""Genera states.js (contorni degli stati USA proiettati con Albers USA) da us-atlas states-10m.json.

Uso: python tools/genera_stati.py <percorso states-10m.json> > states.js

Replica la proiezione composita geoAlbersUsa di d3 (48 stati in Albers, Alaska e
Hawaii in conica equivalente riposizionate), su un riquadro 960x500.
"""
import json
import math
import sys

FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
}

RAD = math.pi / 180


def conic_equal_area(y0, y1):
    sy0, sy1 = math.sin(y0), math.sin(y1)
    n = (sy0 + sy1) / 2
    c = 1 + sy0 * (2 * n - sy0)
    r0 = math.sqrt(c) / n

    def project(lam, phi):
        r = math.sqrt(max(0.0, c - 2 * n * math.sin(phi))) / n
        return r * math.sin(lam * n), r0 - r * math.cos(lam * n)

    return project


class Proj:
    """Proiezione conica equivalente in stile d3: rotate, center, parallels, scale, translate."""

    def __init__(self, rotate, center, parallels, scale, translate):
        self.raw = conic_equal_area(parallels[0] * RAD, parallels[1] * RAD)
        self.rot = rotate * RAD
        self.k = scale
        # come in d3: il centro è espresso già nel sistema ruotato, quindi niente rotate qui
        cx, cy = self.raw(center[0] * RAD, center[1] * RAD)
        self.dx = translate[0] - cx * scale
        self.dy = translate[1] + cy * scale

    def _lam(self, lam):
        lam += self.rot
        while lam > math.pi:
            lam -= 2 * math.pi
        while lam < -math.pi:
            lam += 2 * math.pi
        return lam

    def __call__(self, lon, lat):
        x, y = self.raw(self._lam(lon * RAD), lat * RAD)
        return x * self.k + self.dx, self.dy - y * self.k


K = 1070.0
TX, TY = 480.0, 250.0
LOWER48 = Proj(96, (-0.6, 38.7), (29.5, 45.5), K, (TX, TY))
ALASKA = Proj(154, (-2, 58.5), (55, 65), K * 0.35, (TX - 0.307 * K, TY + 0.201 * K))
HAWAII = Proj(157, (-3, 19.9), (8, 18), K, (TX - 0.205 * K, TY + 0.212 * K))


def main(path):
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

    result = {}
    for g in topo["objects"]["states"]["geometries"]:
        st = FIPS.get(g["id"])
        if not st:
            continue
        proj = ALASKA if st == "AK" else HAWAII if st == "HI" else LOWER48
        polys = g["arcs"] if g["type"] == "Polygon" else [p for p in g["arcs"]]
        if g["type"] == "Polygon":
            polys = [polys]
        d_parts = []
        best = (0, None)
        for poly in polys:
            for ri, ring in enumerate(poly):
                pts = [proj(lon, lat) for lon, lat in ring_points(ring)]
                if len(pts) < 3:
                    continue
                d_parts.append("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
                if ri == 0:
                    area = cx = cy = 0.0
                    for i in range(len(pts)):
                        x0, y0 = pts[i]
                        x1, y1 = pts[(i + 1) % len(pts)]
                        cross = x0 * y1 - x1 * y0
                        area += cross
                        cx += (x0 + x1) * cross
                        cy += (y0 + y1) * cross
                    if abs(area) > best[0] and area != 0:
                        best = (abs(area), (cx / (3 * area), cy / (3 * area)))
        result[st] = {"name": g["properties"]["name"], "d": "".join(d_parts),
                      "c": [round(best[1][0], 1), round(best[1][1], 1)] if best[1] else [0, 0]}

    out = json.dumps(result, separators=(",", ":"), ensure_ascii=False)
    sys.stdout.write("// Generato da tools/genera_stati.py (us-atlas states-10m, proiezione Albers USA 960x500)\n")
    sys.stdout.write("window.US_STATES = " + out + ";\n")


if __name__ == "__main__":
    main(sys.argv[1])
