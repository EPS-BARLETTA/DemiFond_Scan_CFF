/* DemiFond Scan v2 — fonctionnement hors ligne.
   Page : réseau d'abord (pour recevoir les mises à jour), copie locale si pas de réseau.
   Fichiers versionnés : copie locale d'abord. */
const CACHE = "df-v2-2.0";
const FILES = ["/", "/index.html", "/v2/app.css?v=2.0", "/v2/core.js?v=2.0", "/v2/app.js?v=2.0", "/jsQR.js", "/manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("/index.html", c)); return r; }).catch(() => caches.match("/index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && (url.pathname.startsWith("/v2/") || url.pathname === "/jsQR.js")) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
});
