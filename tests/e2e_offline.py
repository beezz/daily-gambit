"""Offline use of the installed app behind a Cloudflare Access-like login wall.

  python3 build.py && (python3 tests/access_like_server.py 8767 dist &)
  python3 tests/e2e_offline.py
Env: DG_URL (default http://localhost:8767/), CHROME (path to Chrome)

Covers: first visit caches everything; the app opens offline; an expired login doesn't break
the cached app; a new version that can't download (expired login) leaves the old one working
and is reported; missing cache files are reported and can be downloaded again.
"""
import os, asyncio, shutil, tempfile, urllib.request
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8767/'); CHROME=os.environ.get('CHROME') or None
DIST=os.path.join(os.path.dirname(__file__),'..','dist')
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: raise SystemExit(1)
COOKIE=[{'name':'CF_Authorization','value':'ok','url':URL}]
async def offcard(pg):
    await pg.goto(URL+'#today'); await pg.wait_for_timeout(200)
    await pg.goto(URL+'#history'); await pg.wait_for_timeout(1200)
    return await pg.inner_text('#offcard')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        urllib.request.urlopen(URL+'__serve?dir='+os.path.abspath(DIST)).read()   # start from the current build
        c=await b.new_context(); await c.add_cookies(COOKIE)
        pg=await c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(500); await pg.click('[data-act="lang"][data-v="en"]')
        for _ in range(60):
            if await pg.evaluate("!!navigator.serviceWorker.controller"): break
            await pg.wait_for_timeout(250)
        check(await pg.evaluate("!!navigator.serviceWorker.controller"), 'service worker installed and in control')
        txt=await offcard(pg)
        check('Ready for offline use' in txt, 'Log tab says ready for offline: '+txt.split('\n')[1][:70])
        # 1) offline, fresh window (like opening the installed app)
        await c.set_offline(True)
        p2=await c.new_page(); await p2.goto(URL,timeout=10000); await p2.wait_for_timeout(1200)
        check('Today' in await p2.inner_text('nav'), 'app opens offline')
        await p2.click('[data-act="slot"][data-k="mon"]'); await p2.click('[data-act="lesson"]'); await p2.wait_for_timeout(1200)
        check(await p2.query_selector('#lesson cg-board') is not None or await p2.query_selector('[data-l="start"]') is not None, 'a lesson opens offline (puzzles data from the cache)')
        txt=await offcard(p2); check('offline now' in txt and 'Ready' in txt, 'offline card while offline')
        await p2.close(); await c.set_offline(False)
        # 2) login expired + a new version deployed: the cached app still opens, the update fails and is reported
        tmp=tempfile.mkdtemp(); d2=os.path.join(tmp,'dist2'); shutil.copytree(DIST,d2)
        open(os.path.join(d2,'app.js'),'a').write('\n/* v2 */\n')
        sw=open(os.path.join(d2,'sw.js')).read().replace("var CACHE = 'daily-gambit-","var CACHE = 'daily-gambit-2"); open(os.path.join(d2,'sw.js'),'w').write(sw)
        urllib.request.urlopen(URL+'__serve?dir='+d2).read()
        await c.clear_cookies()
        p3=await c.new_page(); await p3.goto(URL); await p3.wait_for_timeout(800)
        check('Today' in await p3.inner_text('nav'), 'expired login: the cached app still opens')
        await p3.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{})"); await p3.wait_for_timeout(2500)
        txt=await offcard(p3)
        check('login has probably expired' in txt and 'Ready' in txt, 'failed update reported, current version still ready: '+txt.replace('\n',' | '))
        await c.set_offline(True)
        p4=await c.new_page(); await p4.goto(URL,timeout=10000); await p4.wait_for_timeout(1000)
        check('Today' in await p4.inner_text('nav'), 'still opens offline after the failed update')
        await c.set_offline(False); await p4.close(); await p3.close()
        # 3) files missing from the cache are reported and can be downloaded again (login needed)
        await pg.evaluate("window.dgOffline.info().then(i=>caches.open('daily-gambit-'+i.cache.version)).then(cc=>Promise.all(['data/games.json','sound/Move.mp3'].map(u=>cc.delete(u))))")
        txt=await offcard(pg)
        check('2 of' in txt and 'missing' in txt, 'missing files reported: '+txt.replace('\n',' | '))
        await pg.click('[data-act="offfill"]'); await pg.wait_for_timeout(2500)
        check('login has expired' in await pg.inner_text('#toast'), 'download without login explains the expired login')
        await c.add_cookies(COOKIE)
        await pg.evaluate("1")
        txt=await offcard(pg)
        # the v2 files are now served, but the active worker still lists v1 files with the same names
        await pg.click('[data-act="offfill"]'); await pg.wait_for_timeout(3000)
        txt=await offcard(pg)
        check('Ready for offline use' in txt, 'missing files downloaded again')
        check(not errs, 'no page errors %s'%errs)
        await b.close()
asyncio.run(main())
