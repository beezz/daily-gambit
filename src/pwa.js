/* Daily Gambit PWA helper: service worker registration, "new version" pill and
   install pill. Independent of app.js; every failure is swallowed so the app keeps
   working where service workers are not allowed (e.g. sandboxed iframes, file://). */
(function () {
  try {
    var TXT = {
      sk: { install: '📲 Nainštalovať aplikáciu', update: 'Nová verzia — ťukni pre aktualizáciu', close: 'Zavrieť' },
      de: { install: '📲 App installieren', update: 'Neue Version — tippen zum Aktualisieren', close: 'Schließen' },
      en: { install: '📲 Install app', update: 'New version — tap to update', close: 'Close' }
    };
    var DISMISS_KEY = 'dg_install_dismissed';
    function tx(k) {
      var l = String(document.documentElement.lang || 'sk').slice(0, 2).toLowerCase();
      return (TXT[l] || TXT.sk)[k];
    }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function standalone() {
      try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; }
    }

    var style = document.createElement('style');
    style.textContent =
      '.dg-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:40;' +
      'display:flex;align-items:center;gap:4px;background:#8b5e3c;color:#fff;border:0;border-radius:999px;padding:10px 16px;' +
      'font-family:Fredoka,Nunito,system-ui,sans-serif;font-weight:600;font-size:16px;line-height:1.2;white-space:nowrap;max-width:94vw;' +
      'box-shadow:0 4px 14px rgba(59,42,29,.28);cursor:pointer}' +
      '.dg-pill[hidden]{display:none}' +
      '.dg-pill button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}' +
      '.dg-pill .dg-x{margin-left:8px;opacity:.8;font-size:14px;padding:0 2px}';
    (document.head || document.documentElement).appendChild(style);

    var updatePill = null, installPill = null, waiting = null, deferredPrompt = null, wantReload = false;

    function render() {
      try {
        if (waiting && !updatePill) {
          updatePill = document.createElement('button');
          updatePill.className = 'dg-pill';
          updatePill.setAttribute('data-pwa', 'update');
          updatePill.addEventListener('click', function () {
            try { wantReload = true; waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { location.reload(); }
          });
          document.body.appendChild(updatePill);
        }
        if (updatePill) updatePill.textContent = tx('update');

        var showInstall = !!deferredPrompt && !waiting && !standalone() && lsGet(DISMISS_KEY) !== '1';
        if (showInstall && !installPill) {
          installPill = document.createElement('div');
          installPill.className = 'dg-pill';
          installPill.setAttribute('data-pwa', 'install');
          installPill.innerHTML = '<button type="button" class="dg-go"></button><button type="button" class="dg-x">✕</button>';
          installPill.querySelector('.dg-go').addEventListener('click', function () {
            var p = deferredPrompt; deferredPrompt = null; render();
            try { p.prompt(); } catch (e) {}
          });
          installPill.querySelector('.dg-x').addEventListener('click', function (e) {
            e.stopPropagation(); lsSet(DISMISS_KEY, '1'); render();
          });
          document.body.appendChild(installPill);
        }
        if (installPill) {
          installPill.hidden = !showInstall;
          installPill.querySelector('.dg-go').textContent = tx('install');
          installPill.querySelector('.dg-x').setAttribute('aria-label', tx('close'));
        }
      } catch (e) {}
    }

    // Re-label the pills when the app switches language.
    try { new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}

    window.addEventListener('beforeinstallprompt', function (e) {
      try { e.preventDefault(); deferredPrompt = e; render(); } catch (err) {}
    });
    window.addEventListener('appinstalled', function () { deferredPrompt = null; render(); });

    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    var sw = navigator.serviceWorker;

    sw.addEventListener('controllerchange', function () {
      if (wantReload) { wantReload = false; location.reload(); }
    });

    function track(reg) {
      function offer(w) { if (w && sw.controller) { waiting = w; render(); } }
      offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed') offer(reg.waiting || nw); });
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') { try { reg.update().catch(function () {}); } catch (e) {} }
      });
    }

    function register() {
      try { sw.register('sw.js').then(track).catch(function () {}); } catch (e) {}
    }
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  } catch (e) {}
})();
