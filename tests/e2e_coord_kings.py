"""Coordinates quiz: kings on e1 and e8 show the board's orientation, and their squares can be tapped.

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_coord_kings.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html'); BASE=URL.split('#')[0]
CHROME=os.environ.get('CHROME') or None
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: raise SystemExit(1)
# where each king is drawn: 'top' or 'bottom' half of the board
KINGS="""(()=>{const b=document.querySelector('#lesson cg-board'), r=b.getBoundingClientRect(), o={};
  b.querySelectorAll('piece.king').forEach(p=>{const q=p.getBoundingClientRect(); o[p.classList.contains('white')?'w':'b']=(q.top+q.height/2-r.top)<r.height/2?'top':'bottom';}); return o;})()"""
async def tapsq(pg,sq,flip):
    x,y=await pg.evaluate("""([sq,bl])=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1;let X=bl?7-f:f,Y=bl?k:7-k;return [r.left+(X+.5)*r.width/8, r.top+(Y+.5)*r.height/8]}""",[sq,flip])
    await pg.mouse.click(x,y)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(400); await pg.click('[data-act="lang"][data-v="en"]')
        await pg.click('[data-act="slot"][data-k="thu"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-l="coord"]'); await pg.wait_for_timeout(300)
        check('e1 and e8' in await pg.inner_text('#lesson'), 'intro explains the kings')
        for flip,first in [(False,0.9),(True,0.1)]:
            # next question: "Tap e1" (random numbers: view, question type, file, rank)
            if not flip: await pg.evaluate("(seq)=>{const r=Math.random; window.__seq=seq.slice(); Math.random=()=>window.__seq.length?window.__seq.shift():r();}",[first,0.0,0.55,0.0])
            if flip:   # a fresh quiz, so the view is drawn again for the first question
                pg=await b.new_page(viewport={'width':400,'height':860}); pg.on('pageerror',lambda e:errs.append(str(e)))
                await pg.goto(BASE+'#today'); await pg.wait_for_timeout(500)
                await pg.click('[data-act="slot"][data-k="thu"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
                await pg.click('[data-l="coord"]'); await pg.wait_for_timeout(300)
                await pg.evaluate("(seq)=>{const r=Math.random; window.__seq=seq.slice(); Math.random=()=>window.__seq.length?window.__seq.shift():r();}",[first,0.0,0.55,0.0])
            await pg.click('[data-l="start"]')
            await pg.wait_for_timeout(300)
            txt=await pg.inner_text('#lesson .msg')
            check('e1' in txt, ('black' if flip else 'white')+' view: question is "'+txt.strip()+'"')
            k=await pg.evaluate(KINGS)
            exp={'w':'top','b':'bottom'} if flip else {'w':'bottom','b':'top'}
            check(k==exp, ('black' if flip else 'white')+' view: kings on e1/e8 at %s'%k)
            ok0=await pg.evaluate("document.querySelector('.lbar .pill').textContent")
            await tapsq(pg,'e1',flip); await pg.wait_for_timeout(250)
            check('✓' in await pg.inner_text('#lesson .msg'), ('black' if flip else 'white')+' view: tapping the king square e1 counts as correct')
            await pg.wait_for_timeout(900)
        check(not errs, 'no page errors %s'%errs)
        await b.close()
asyncio.run(main())
