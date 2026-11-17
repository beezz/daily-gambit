"""Smoke test: every lesson opens without errors, Stockfish starts, and the app works offline.

Run from the repo root:
  python3 build.py && (python3 tests/cf_like_server.py 8765 &)
  pip install playwright && playwright install chromium   # or set CHROME=/path/to/chrome
  python3 tests/smoke.py

Exits non-zero on the first failure. Env: DG_URL (default http://localhost:8765/), CHROME, SHOTS.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = os.environ.get('DG_URL', 'http://localhost:8765/')
CHROME = os.environ.get('CHROME') or None
SHOTS = os.environ.get('SHOTS', '/tmp')


def check(cond, what):
    print(('PASS ' if cond else 'FAIL ') + what)
    if not cond:
        sys.exit(1)


async def open_lesson(pg, slot):
    await pg.goto(URL + '#today')
    await pg.wait_for_timeout(300)
    await pg.click(f'[data-act="slot"][data-k="{slot}"]')
    await pg.click('[data-act="lesson"]')
    await pg.wait_for_selector('#lesson', timeout=15000)
    await pg.wait_for_timeout(600)
    return await pg.inner_text('#lesson')


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': 400, 'height': 860})
        pg = await ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))

        await pg.goto(URL)
        await pg.wait_for_selector('.hero', timeout=15000)
        await pg.click('[data-act="lang"][data-v="en"]')
        check(await pg.query_selector('.mission') is not None, 'Today screen renders')

        txt = await open_lesson(pg, 'mon')
        check(await pg.query_selector('[data-l="start"]') is not None, 'Monday: Woodpecker lesson loads puzzles')
        await pg.click('[data-l="start"]')
        await pg.wait_for_selector('#lesson cg-board', timeout=10000)
        check(True, 'Monday: puzzle board appears')

        txt = await open_lesson(pg, 'tue')
        for _ in range(120):
            txt = await pg.inner_text('#lesson')
            if 'Waking' not in txt:
                break
            await pg.wait_for_timeout(500)
        check('Waking' not in txt and 'couldn' not in txt, 'Tuesday: Stockfish starts')

        txt = await open_lesson(pg, 'wed')
        check(await pg.query_selector('[data-l="go"]') is not None, 'Wednesday: master games load')

        txt = await open_lesson(pg, 'thu')
        check(await pg.query_selector('[data-l="coord"],[data-l="start"]') is not None, 'Thursday: lesson opens')

        txt = await open_lesson(pg, 'fri')
        check(await pg.query_selector('[data-l="bstart"]') is not None, 'Friday: blindfold drills open')

        txt = await open_lesson(pg, 'wk')
        check(await pg.query_selector('[data-l="play"]') is not None, 'Weekend: game setup opens')

        # offline (only when the build ships a service worker)
        has_sw = await pg.evaluate("fetch('sw.js',{method:'HEAD'}).then(r=>r.ok).catch(()=>false)")
        if has_sw:
            await pg.goto(URL)
            ready = await pg.evaluate("""async()=>{ if(!('serviceWorker' in navigator)) return false;
                await navigator.serviceWorker.ready;
                for(let i=0;i<120;i++){ const ks=await caches.keys(); if(ks.length){ const c=await caches.open(ks[ks.length-1]); const n=(await c.keys()).length; if(n>20) return n; } await new Promise(r=>setTimeout(r,500)); }
                return false; }""")
            check(bool(ready), f'Service worker installed and cached {ready} files')
            for i in range(2):  # normal reloads go through the service worker (regression: redirected index.html)
                await pg.reload()
                await pg.wait_for_selector('.hero', timeout=15000)
            check(True, 'Normal reloads through the service worker work')
            await ctx.set_offline(True)
            await pg.reload()
            await pg.wait_for_selector('.hero', timeout=15000)
            check(True, 'Offline: app loads')
            await open_lesson(pg, 'mon')
            check(await pg.query_selector('[data-l="start"]') is not None, 'Offline: puzzles load')
            txt = await open_lesson(pg, 'tue')
            for _ in range(120):
                txt = await pg.inner_text('#lesson')
                if 'Waking' not in txt:
                    break
                await pg.wait_for_timeout(500)
            check('Waking' not in txt and 'couldn' not in txt, 'Offline: Stockfish starts')
            await ctx.set_offline(False)
        else:
            print('SKIP offline checks (no sw.js in this build)')

        await pg.screenshot(path=os.path.join(SHOTS, 'smoke.png'))
        check(not errors, 'No page errors' + ('' if not errors else ': ' + '; '.join(errors[:3])))
        await browser.close()


asyncio.run(main())
