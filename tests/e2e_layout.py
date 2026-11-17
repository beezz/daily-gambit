"""Lesson layout: on landscape tablets/phones the text and buttons sit beside the board (no scrolling);
on portrait screens they stay under it.

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_layout.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html'); BASE=URL.split('#')[0]
CHROME=os.environ.get('CHROME') or None
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: raise SystemExit(1)
async def tap(pg,sq):
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1;return [r.left+(f+.5)*r.width/8, r.top+(7-k+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        for name,(w,h),side in [('tablet landscape',(1280,800),True),('phone landscape',(844,390),True),('tablet portrait',(800,1280),False),('phone portrait',(390,844),False)]:
            pg=await b.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto(BASE); await pg.wait_for_timeout(400); await pg.click('[data-act="lang"][data-v="en"]')
            await pg.click('[data-act="slot"][data-k="tue"]'); await pg.click('[data-act="lesson"]')
            for _ in range(40):
                if await pg.query_selector('[data-l="pick"]'): break
                await pg.wait_for_timeout(300)
            await pg.click('[data-l="pick"][data-v="op1"]'); await pg.wait_for_timeout(500)
            info=await pg.evaluate("""(()=>{const b=document.querySelector('.lboard').getBoundingClientRect(),s=document.querySelector('.lside').getBoundingClientRect();
              return {grid:getComputedStyle(document.querySelector('.lsplit')).display==='grid',beside:s.left>=b.right-1,scroll:document.documentElement.scrollHeight-innerHeight}})()""")
            if side:
                check(info['grid'] and info['beside'], name+': text and buttons beside the board')
                check(info['scroll']<=4, name+': no scrolling needed (%dpx)'%info['scroll'])
            else:
                check(not info['beside'], name+': text and buttons under the board')
            await tap(pg,'e3'); await pg.wait_for_timeout(120); await tap(pg,'e4'); await pg.wait_for_timeout(1500)
            mv=await pg.evaluate("window.__L().state().cur.g.history()[0]||''")
            check(mv=='Ke4', name+': board still takes moves (%s)'%mv)
            check(not errs, name+': no page errors %s'%errs)
            await pg.close()
        await b.close()
asyncio.run(main())
