/* Daily Gambit service worker: full offline use after the first visit.
   build.py fills in CACHE (hash of every file) and FILES (every file in dist/). */
var CACHE = '__CACHE_NAME__';
var FILES = __PRECACHE_LIST__;

// Hosts such as Cloudflare redirect /index.html to /. A redirected response must
// not be served for a page load (Chrome then shows an error), so store a clean copy.
function clean(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

self.addEventListener('install', function (e) {
  // No skipWaiting here: the page shows an "update" pill and asks for it.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error('precache failed: ' + u);
        return clean(res).then(function (ok) {
          var jobs = [c.put(u, ok.clone())];
          if (u === 'index.html') jobs.push(c.put('./', ok.clone()));
          return Promise.all(jobs);
        });
      });
    }));
  }).then(repairIfBroken));
});

// Versions before this fix cached a redirected index.html, which makes every page
// load fail, so the "update" pill could never appear. If an older cache has that
// problem, take over right away instead of waiting for the tap.
function repairIfBroken() {
  return caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('daily-gambit-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.open(k).then(function (c) { return c.match('index.html'); })
        .then(function (r) { return !!(r && r.redirected); }); }));
  }).then(function (broken) {
    if (broken.some(Boolean)) return self.skipWaiting();
  });
}

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
      if (hit) return clean(hit);
      if (req.mode === 'navigate') {
        return c.match('index.html').then(function (idx) { return idx ? clean(idx) : fetch(req); });
      }
      return fetch(req);
    });
  }));
});
