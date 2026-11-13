// Service worker van de studietracker. Gegenereerd bij de build: de lijst met
// bestanden en de versie worden ingevuld. Bewaart de hele app, zodat hij
// zonder internet werkt. Studentgegevens staan hier niet in; die staan in IndexedDB.
const BESTANDEN = __BESTANDEN__;
const CACHE = 'studietracker-__VERSIE__';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(BESTANDEN.map((b) => new URL(b, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('studietracker-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const url = new URL(req.url);
      url.search = '';
      if (url.pathname.endsWith('/')) url.pathname += 'index.html';
      const bewaard = await cache.match(url.href);
      if (bewaard) return bewaard;
      return fetch(req);
    })(),
  );
});
