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

// A response we may keep: same-origin, OK, and not a Cloudflare Access login page
// (an expired login redirects every request to another origin).
function usable(res) {
  return res && res.ok && res.type !== 'opaqueredirect' && new URL(res.url || self.location.href).origin === self.location.origin;
}
// Redirects are not followed: on Cloudflare a redirect here means the Access login has
// expired (the page itself is fetched as "./" because /index.html redirects to /).
function getFile(u, tries) {
  return fetch(new Request(u === 'index.html' ? './' : u, { cache: 'reload', redirect: 'manual' })).then(function (res) {
    if (res.type === 'opaqueredirect') { var er = new Error('login: ' + u); er.fatal = true; throw er; }
    if (!usable(res)) throw new Error('http ' + (res && res.status) + ': ' + u);
    return res;
  }).catch(function (err) {
    if (tries > 1 && !err.fatal) return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return getFile(u, tries - 1); });
    throw err;
  });
}
function store(c, u, res) {
  return clean(res).then(function (ok) {
    var jobs = [c.put(u, ok.clone())];
    if (u === 'index.html') jobs.push(c.put('./', ok.clone()));
    return Promise.all(jobs);
  });
}

self.addEventListener('install', function (e) {
  // No skipWaiting here: the page shows an "update" pill and asks for it.
  // Every file must arrive, otherwise this version is not installed and the
  // previous one keeps working offline.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) { return getFile(u, 3).then(function (res) { return store(c, u, res); }); }));
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

// Offline first: answer from this version's cache; on a miss use the network and keep
// a copy; if the network fails too, fall back to any copy from any version.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var nav = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(nav ? 'index.html' : req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return clean(hit);
      return fetch(req).then(function (res) {
        if (usable(res) && !nav) c.put(req, res.clone()).catch(function () {});
        return res;
      }).catch(function (err) {
        return caches.match(nav ? 'index.html' : req, { ignoreSearch: true }).then(function (any) {
          if (any) return clean(any);
          throw err;
        });
      });
    });
  }));
});

// The page asks how ready we are for offline use (Log tab → Offline), and can ask us
// to fetch whatever is missing from the cache.
function status() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) { return c.match(u).then(function (r) { return r ? null : u; }); }));
  }).then(function (miss) {
    miss = miss.filter(Boolean);
    return { version: CACHE.replace('daily-gambit-', ''), total: FILES.length, missing: miss };
  });
}
function refill() {
  return caches.open(CACHE).then(function (c) {
    return status().then(function (st) {
      var errs = [];
      return Promise.all(st.missing.map(function (u) {
        return getFile(u, 2).then(function (res) { return store(c, u, res); }).catch(function (er) { errs.push(String(er.message || er)); });
      })).then(function () { return status(); }).then(function (s2) { s2.errors = errs; return s2; });
    });
  });
}
self.addEventListener('message', function (e) {
  var d = e.data || {}, port = e.ports && e.ports[0];
  if (!port || (d.type !== 'STATUS' && d.type !== 'REFILL')) return;
  var job = d.type === 'STATUS' ? status() : refill();
  e.waitUntil(job.then(function (r) { port.postMessage(r); }, function (er) { port.postMessage({ error: String(er) }); }));
});
