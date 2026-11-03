#!/usr/bin/env python3
"""Server locale per midterm-live.

Serve i file statici della cartella e fa da proxy di riserva verso i feed del
New York Times, con una piccola cache di qualche secondo:

  /feed/<senate|house|governor>.json   riepilogo nazionale per ufficio
  /feed/race/<slug>.json               feed di una singola gara (voti per contea)

La pagina prova prima a leggere i feed in modo diretto; usa il proxy solo se il
browser non ci riesce (CORS, rete). L'intestazione Last-Modified del NYT viene
inoltrata, così la pagina può saltare i file che non sono cambiati.

Uso:  python proxy.py [porta]      (default 8787)
"""
import gzip
import http.server
import json
import re
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
BASE = "https://static01.nyt.com/elections-assets/pages/data/2026-11-03/"
OFFICES = {"senate", "house", "governor"}
SLUG = re.compile(r"^results-[a-z0-9-]{3,80}$")
CACHE_SECONDS = 10

_cache = {}
_lock = threading.Lock()


def fetch(name):
    """Ritorna (dati, last_modified) per results-<...>.json, con cache breve."""
    now = time.time()
    with _lock:
        hit = _cache.get(name)
        if hit and now - hit[0] < CACHE_SECONDS:
            return hit[1], hit[2]
    req = urllib.request.Request(
        BASE + name + ".json",
        headers={"User-Agent": "Mozilla/5.0 midterm-live", "Accept-Encoding": "gzip"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
        lm = resp.headers.get("Last-Modified")
    with _lock:
        _cache[name] = (time.time(), data, lm)
        if len(_cache) > 200:
            oldest = sorted(_cache.items(), key=lambda kv: kv[1][0])[:50]
            for k, _ in oldest:
                _cache.pop(k, None)
    return data, lm


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def _json(self, code, data, lm=None):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        if lm:
            self.send_header("Last-Modified", lm)
        accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding") or "")
        if accepts_gzip and len(data) > 2048:
            data = gzip.compress(data, compresslevel=5)
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        name = None
        if path.startswith("/feed/race/") and path.endswith(".json"):
            slug = path[len("/feed/race/"):-len(".json")]
            if SLUG.match(slug):
                name = slug
        elif path.startswith("/feed/") and path.endswith(".json"):
            office = path[len("/feed/"):-len(".json")]
            if office in OFFICES:
                name = "results-" + office
        if path.startswith("/feed/"):
            if not name:
                self._json(404, json.dumps({"error": "feed sconosciuto"}).encode())
                return
            try:
                data, lm = fetch(name)
            except Exception as e:  # noqa: BLE001
                self._json(502, json.dumps({"error": str(e)}).encode())
                return
            self._json(200, data, lm)
            return
        super().do_GET()

    def end_headers(self):
        if self.path.split("?", 1)[0].endswith((".html", ".js", ".css", "/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"midterm-live su http://127.0.0.1:{PORT}  (Ctrl+C per fermare)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
