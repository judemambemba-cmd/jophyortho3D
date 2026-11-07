/* JophyOrtho 3D — service worker : cache hors-ligne de l'application (aucune donnée patient n'est mise en cache réseau) */
const CACHE = 'jophyortho3d-v11';
const FILES = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match('./index.html'))));
});
