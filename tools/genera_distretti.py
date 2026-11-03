#!/usr/bin/env python3
"""Genera districts.js: i confini dei distretti della Camera in vigore per il voto 2026.

Fonte: Census Bureau, TIGERweb, layer "120th Congressional Districts" (vintage 1 gennaio
2026, include le mappe ridisegnate a metà decennio). Il servizio restituisce già geometrie
semplificate in GeoJSON; lo script le proietta con la stessa Albers USA di states.js
(riquadro 960x500) e scrive:

  window.US_DISTRICTS = { "TX": { "15": {"d": path, "c": [x, y], "b": [x0, y0, x1, y1]}, ... }, ... }

Il distretto unico degli stati con un solo seggio ha chiave "1" (come nel feed del NYT).

Uso: python tools/genera_distretti.py > districts.js
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genera_stati import FIPS, LOWER48, ALASKA, HAWAII  # noqa: E402

LAYER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query"
OFFSET = 0.003       # tolleranza di semplificazione in gradi (~300 m)


def query(state_fips):
    params = {
        "where": f"GEOID LIKE '{state_fips}%'",
        "outFields": "GEOID,BASENAME,CDSESSN",
        "returnGeometry": "true",
        "outSR": "4326",
        "maxAllowableOffset": str(OFFSET),
        "geometryPrecision": "4",
        "f": "geojson",
    }
    url = LAYER + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "midterm-live"}), timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print(f"  {state_fips}: tentativo {attempt + 1} fallito ({e})", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError(f"impossibile scaricare lo stato {state_fips}")


def ring_path(ring, proj):
    pts = []
    for lon, lat in ring:
        x, y = proj(lon, lat)
        p = (round(x, 1), round(y, 1))
        if not pts or pts[-1] != p:
            pts.append(p)
    if len(pts) < 3:
        return None, pts
    return "M" + " ".join(f"{x},{y}" for x, y in pts) + "Z", pts


def main():
    out = {}
    total = 0
    for fips, st in sorted(FIPS.items()):
        if st == "DC":
            continue  # il delegato di Washington non vota e non è nel feed
        proj = ALASKA if st == "AK" else HAWAII if st == "HI" else LOWER48
        fc = query(fips)
        feats = fc.get("features", [])
        districts = {}
        for f in feats:
            geoid = f["properties"]["GEOID"]
            cd = geoid[2:]
            if not cd.isdigit() or cd == "98":
                continue  # ZZ = acque non assegnate, 98 = delegato
            key = "1" if cd == "00" else str(int(cd))
            g = f.get("geometry") or {}
            polys = [g["coordinates"]] if g.get("type") == "Polygon" else g.get("coordinates", [])
            parts, best, bb = [], (0, None), [1e9, 1e9, -1e9, -1e9]
            for poly in polys:
                for ri, ring in enumerate(poly):
                    d, pts = ring_path(ring, proj)
                    if not d:
                        continue
                    parts.append(d)
                    for x, y in pts:
                        bb = [min(bb[0], x), min(bb[1], y), max(bb[2], x), max(bb[3], y)]
                    if ri == 0:
                        a = cx = cy = 0.0
                        for i in range(len(pts)):
                            x0, y0 = pts[i]
                            x1, y1 = pts[(i + 1) % len(pts)]
                            c = x0 * y1 - x1 * y0
                            a += c
                            cx += (x0 + x1) * c
                            cy += (y0 + y1) * c
                        if a and abs(a) > best[0]:
                            best = (abs(a), (round(cx / (3 * a), 1), round(cy / (3 * a), 1)))
            if parts:
                districts[key] = {"d": "".join(parts), "c": list(best[1] or (0, 0)), "b": [round(v, 1) for v in bb]}
        out[st] = districts
        total += len(districts)
        print(f"{st}: {len(districts)} distretti", file=sys.stderr)
    print(f"totale: {total} distretti", file=sys.stderr)
    sys.stdout.write("// Generato da tools/genera_distretti.py (Census TIGERweb, 120th Congressional Districts, vintage 2026)\n")
    sys.stdout.write("window.US_DISTRICTS = " + json.dumps(out, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
