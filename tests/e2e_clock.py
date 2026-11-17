"""Active-time clock, Pause and End buttons (Playwright + Chrome).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_clock.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio, json
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
CHROME=os.environ.get('CHROME') or None

def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: raise SystemExit(1)

async def secs(pg): return await pg.evaluate("window.__L().clock.secs()")
async def open_slot(pg,k):
    await pg.goto(URL.split('#')[0]+'#today'); await pg.wait_for_timeout(400)
    await pg.click(f'[data-act="slot"][data-k="{k}"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(600)

async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await br.new_page(viewport={'width':400,'height':860})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        await pg.click('[data-act="lang"][data-v="en"]')

        # Endgames: menu does not count, playing counts, pause freezes, End logs active minutes
        await open_slot(pg,'tue')
        for _ in range(60):
            if 'Waking' not in await pg.inner_text('#lesson'): break
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(2000)
        check(await secs(pg)<0.6, 'endgame menu: clock idle (%.1fs)'%await secs(pg))
        check(await pg.is_visible('[data-act="pause"]') and await pg.is_visible('[data-act="end"]'), 'pause & end buttons visible')
        await pg.click('[data-l="pick"][data-v="ks"]'); await pg.wait_for_timeout(2600)
        a=await secs(pg); check(2.0<a<3.5, 'endgame play: clock running (%.1fs)'%a)
        await pg.click('[data-act="pause"]'); await pg.wait_for_timeout(200)
        check(await pg.is_visible('#pausebox') and not await pg.is_visible('#lesson'), 'pause overlay shown, board hidden')
        b=await secs(pg); await pg.wait_for_timeout(2000); c=await secs(pg)
        check(abs(c-b)<0.1, 'paused: clock frozen (%.2f -> %.2f)'%(b,c))
        await pg.click('[data-act="unpause"]'); await pg.wait_for_timeout(1500)
        d=await secs(pg); check(d>c+1.0 and await pg.is_visible('#lesson cg-board'), 'resumed: clock runs and board back (%.1fs)'%d)
        await pg.click('[data-act="end"]'); await pg.wait_for_timeout(600)
        ss=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).sessions")
        check(len(ss)==1 and ss[0]['slot']=='tue' and ss[0]['min']==1 and ss[0]['lesson'], 'end: session logged right away with active minutes (%s)'%[(x['slot'],x['min']) for x in ss])
        check(await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_pend')||'{}').tue")==None, 'end: nothing left pending, no form prefill')
        check('#today' in pg.url, 'end: back on today')
        # a second in-app Tuesday lesson today merges into the same log entry
        await open_slot(pg,'tue'); await pg.wait_for_timeout(800)
        await pg.click('[data-l="pick"][data-v="ks"]'); await pg.wait_for_timeout(1500)
        await pg.click('[data-act="end"]'); await pg.wait_for_timeout(600)
        ss=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).sessions")
        check(len(ss)==1 and ss[0]['min']==2, 'second lesson same day merged (%s)'%[(x['slot'],x['min']) for x in ss])

        # Coordinates: intro idle, quiz counts
        await open_slot(pg,'thu'); await pg.click('[data-l="coord"], [data-act="coord"]') if await pg.query_selector('[data-l="coord"], [data-act="coord"]') else None; await pg.wait_for_timeout(1500)
        check(await secs(pg)<0.6, 'coord intro: clock idle')
        await pg.click('[data-l="start"]'); await pg.wait_for_timeout(1600)
        check(await secs(pg)>1.0, 'coord quiz: clock running (%.1fs)'%await secs(pg))
        # Hidden tab halts the clock
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
        e=await secs(pg); await pg.wait_for_timeout(1200); f=await secs(pg)
        check(abs(f-e)<0.1, 'hidden tab: clock frozen')
        await pg.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
        # Leaving the lesson halts the clock
        await pg.click('[data-act="leave"]'); await pg.wait_for_timeout(300)
        g=await secs(pg); await pg.wait_for_timeout(1200); h=await secs(pg)
        check(abs(h-g)<0.1, 'outside lesson: clock frozen (%.2f -> %.2f, %s)'%(g,h,pg.url))

        # Woodpecker: intro idle, solving counts
        await open_slot(pg,'mon'); await pg.wait_for_timeout(1500)
        check(await secs(pg)<0.6, 'woodpecker intro: clock idle')
        await pg.click('[data-l="start"]'); await pg.wait_for_timeout(2500)
        check(await secs(pg)>1.0, 'woodpecker solving: clock running (%.1fs)'%await secs(pg))

        # Weekend: End before a game just leaves
        await open_slot(pg,'wk'); await pg.wait_for_timeout(1200)
        check(await secs(pg)<0.6, 'weekend menu: clock idle')
        await pg.click('[data-act="end"]'); await pg.wait_for_timeout(400)
        check('#today' in pg.url, 'weekend end with no game: back to today')

        check(not errs, 'no page errors %s'%errs)
        await br.close()
asyncio.run(main())
