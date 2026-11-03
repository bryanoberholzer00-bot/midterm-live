/* Service worker di midterm-live.
   - I feed dei risultati (NYT o /feed/ del proxy) non passano mai dalla cache.
   - Pagina, script e stili: prima la rete, così gli aggiornamenti arrivano subito; la copia salvata serve solo offline.
   - Contorni (states.js, districts.js, counties/) e icone: prima la cache, perché pesano e non cambiano.
     Se cambiano, aumentare CACHE qui sotto. */
const CACHE = 'midterm-v9';
const CORE = ['./', 'index.html', 'app.js', 'style.css', 'states.js', 'districts.js', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function save(req, res) {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/feed/')) return;
  if (/(states|districts)\.js$|\/counties\/|\.png$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => save(e.request, res))));
    return;
  }
  // cache: 'no-cache' scavalca la cache HTTP di GitHub Pages (10 minuti): pagina e script arrivano sempre nella stessa versione
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => save(e.request, res))
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
