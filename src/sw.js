/* Daily Gambit service worker: full offline use after the first visit.
   build.py fills in CACHE (hash of every file) and FILES (every file in dist/). */
var CACHE = '__CACHE_NAME__';
var FILES = __PRECACHE_LIST__;

self.addEventListener('install', function (e) {
  // No skipWaiting here: the page shows an "update" pill and asks for it.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('daily-gambit-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') {
        return c.match('index.html').then(function (idx) { return idx || fetch(req); });
      }
      return fetch(req);
    });
  }));
});
