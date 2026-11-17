"""End-to-end test of the installable/offline PWA (Playwright + Chrome).

Run from the repo root:
  pip install playwright
  python3 tests/e2e_pwa.py

It builds a throw-away copy of the repo in a temp folder (so the repo is never
touched), serves its dist/ on PORT, then checks: service worker + full precache,
manifest, install pill, fully offline use (server killed + browser offline:
app, fonts, Monday puzzles, Stockfish wasm), a new cache name after a rebuild,
and the "new version" pill.

Env: CHROME (default /usr/bin/google-chrome), PORT (default 8890)
"""
import json, os, re, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = int(os.environ.get('PORT', '8890'))
URL = 'http://localhost:%d/' % PORT
TMP = tempfile.mkdtemp(prefix='dg-pwa-test-')
for d in ('src', 'public'):
    shutil.copytree(os.path.join(ROOT, d), os.path.join(TMP, d))
shutil.copy(os.path.join(ROOT, 'build.py'), TMP)
DIST = os.path.join(TMP, 'dist')
fails = []


def check(ok, what):
    print(('PASS ' if ok else 'FAIL ') + what)
    if not ok:
        fails.append(what)


def build():
    subprocess.run([sys.executable, os.path.join(TMP, 'build.py')], check=True, stdout=subprocess.DEVNULL)
    sw = open(os.path.join(DIST, 'sw.js'), encoding='utf8').read()
    name = re.search(r"var CACHE = '([^']+)'", sw).group(1)
    files = json.loads(re.search(r'var FILES = (\[.*?\]);', sw, re.S).group(1))
    return name, files


def serve():
    return subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', DIST], cwd=DIST,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


cache1, files = build()
on_disk = sorted(os.path.relpath(os.path.join(d, f), DIST).replace(os.sep, '/')
                 for d, _, fs in os.walk(DIST) for f in fs)
check(sorted(files) == sorted(f for f in on_disk if f not in ('_headers', 'sw.js')),
      'precache list = every file in dist/ except _headers and sw.js (%d files)' % len(files))
srv = serve()
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 400, 'height': 860})
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.goto(URL)
        pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
        n = 0
        for _ in range(120):
            n = pg.evaluate("caches.open(%s).then(c=>c.keys()).then(k=>k.length)" % json.dumps(cache1))
            if n >= len(files) and pg.evaluate("!!navigator.serviceWorker.controller"):
                break
            pg.wait_for_timeout(500)
        check(n == len(files), 'cache %s holds all %d precache entries (%d)' % (cache1, len(files), n))
        check(pg.evaluate("!!navigator.serviceWorker.controller"), 'page is controlled by the service worker')

        man = pg.evaluate("fetch('manifest.webmanifest').then(r=>r.text()).then(t=>JSON.parse(t))")
        check(man['name'] == 'Daily Gambit' and man['display'] == 'standalone' and
              any(i.get('purpose') == 'maskable' for i in man['icons']), 'manifest parses and looks right')
        for ic in man['icons']:
            st = pg.evaluate("fetch(%s).then(r=>r.status)" % json.dumps(ic['src']))
            check(st == 200, 'icon %s served' % ic['src'])

        # install pill (Chrome headless does not fire beforeinstallprompt, so fake one)
        pg.evaluate("""()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__prompted=1};
                       e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e)}""")
        pill = pg.locator('[data-pwa="install"]')
        check(pill.is_visible() and 'Nainštalovať' in pill.inner_text(), 'install pill shown (sk): %r' % pill.inner_text())
        pg.click('[data-pwa="install"] .dg-x')
        check(not pill.is_visible() and pg.evaluate("localStorage.getItem('dg_install_dismissed')") == '1',
              'install pill dismissed and remembered')

        # ---------- fully offline ----------
        srv.terminate(); srv.wait()
        ctx.set_offline(True)
        pg.reload()
        pg.wait_for_timeout(1000)
        check(len(pg.inner_html('#root')) > 200, 'offline: app renders')
        check(pg.evaluate("document.fonts.ready.then(()=>document.fonts.check('600 16px Fredoka'))"), 'offline: Fredoka loaded')
        check(pg.evaluate("document.fonts.check('800 16px Nunito')"), 'offline: Nunito loaded')
        pg.click('[data-act="slot"][data-k="mon"]'); pg.click('[data-act="lesson"]')
        pg.wait_for_selector('[data-l="start"]', timeout=15000)
        check(True, 'offline: Monday lesson opens (puzzles.json from cache)')
        pg.click('[data-act="leave"]')
        pg.click('[data-act="slot"][data-k="tue"]'); pg.click('[data-act="lesson"]')
        txt = ''
        for _ in range(80):
            txt = pg.inner_text('#root')
            if 'Budím Stockfish' not in txt or 'nespustil' in txt:
                break
            pg.wait_for_timeout(500)
        check('Budím Stockfish' not in txt and 'nespustil' not in txt and 'couldn' not in txt,
              'offline: Stockfish (js + wasm) starts from cache')
        check(not errs, 'no page errors (%s)' % errs)

        # ---------- update flow ----------
        ctx.set_offline(False)
        with open(os.path.join(TMP, 'src', 'pwa.js'), 'a', encoding='utf8') as f:
            f.write('\n/* test change */\n')
        cache2, _ = build()
        check(cache2 != cache1, 'rebuild after a change gives a new cache name (%s -> %s)' % (cache1, cache2))
        srv = serve(); time.sleep(0.8)
        pg.goto(URL)
        upd = pg.locator('[data-pwa="update"]')
        upd.wait_for(state='visible', timeout=30000)
        check('Nová verzia' in upd.inner_text(), 'update pill shown: %r' % upd.inner_text())
        with pg.expect_navigation(timeout=15000):
            upd.click()
        pg.wait_for_timeout(800)
        keys = pg.evaluate("caches.keys()")
        check(keys == [cache2], 'after update only the new cache remains: %s' % keys)
        check(pg.locator('[data-pwa="update"]').count() == 0, 'update pill gone after reload')

        # file:// (no service worker allowed) must stay harmless
        fp = b.new_page(); ferrs = []
        fp.on('pageerror', lambda e: ferrs.append(str(e)))
        fp.goto('file://' + os.path.join(DIST, 'index.html')); fp.wait_for_timeout(800)
        check(not ferrs, 'file:// load has no page errors from pwa.js (%s)' % ferrs)
        b.close()
finally:
    srv.terminate()
    shutil.rmtree(TMP, ignore_errors=True)
print('\nALL PASS' if not fails else '\n%d FAILED' % len(fails))
sys.exit(1 if fails else 0)
