"""Guess-the-move: the board never gets out of step with the game.

Regression for a real bug: double-tapping "Continue" after a revealed move ran the opponent's move
twice; the second attempt failed but the move counter still advanced, so later the app judged correct
moves as wrong ("The master played Kg7" in a position where that was impossible).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_guess_sync.py
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
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const bl=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1;let X=bl?7-f:f,Y=bl?k:7-k;return [r.left+(X+.5)*r.width/8, r.top+(Y+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y); await pg.wait_for_timeout(80)
async def S(pg,e): return await pg.evaluate("(()=>{const s=window.__L().state();return "+e+"})()")
async def wait_guess(pg):
    for _ in range(80):
        if await S(pg,"s.status")=='guess': return True
        await pg.wait_for_timeout(150)
    return False
async def in_sync(pg): return await S(pg,"s.g.history().length===s.p")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1280,'height':800}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(400)
        await pg.click('[data-act="slot"][data-k="wed"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(800); await pg.click('[data-l="go"]')
        for rnd in range(3):
            check(await wait_guess(pg), 'round %d: waiting for a guess'%rnd)
            for k in range(2):   # two wrong guesses -> the master's move is revealed
                mv=await S(pg,"(()=>{const m=s.list[s.p]; const o=s.g.moves({verbose:true}).find(x=>x.from!==m.from||x.to!==m.to); return [o.from,o.to]})()")
                await tap(pg,mv[0]); await tap(pg,mv[1]); await pg.wait_for_timeout(250)
            check(await S(pg,"s.status")=='reveal', 'round %d: master move revealed'%rnd)
            await pg.click('[data-l="cont"]',click_count=3,delay=40)          # impatient triple tap
            await pg.wait_for_timeout(1800)
            check(await in_sync(pg), 'round %d: board still matches the game after a triple tap (p=%s, moves=%s)'%(rnd,await S(pg,"s.p"),await S(pg,"s.g.history().length")))
        # the right move is accepted
        check(await wait_guess(pg), 'waiting for a guess')
        m=await S(pg,"[s.list[s.p].from,s.list[s.p].to]"); first=await S(pg,"s.first")
        await tap(pg,m[0]); await tap(pg,m[1]); await pg.wait_for_timeout(300)
        check(await S(pg,"s.first")==first+1, 'the master move is accepted as correct')
        # a board that somehow got out of step repairs itself
        await pg.wait_for_timeout(1500); await wait_guess(pg)
        await pg.evaluate("window.__L().state().g.undo()")
        await pg.click('[data-l="nav"][data-v="prev"]'); await pg.click('[data-l="nav"][data-v="last"]')
        m=await S(pg,"[s.list[s.p].from,s.list[s.p].to]")
        await tap(pg,m[0]); await tap(pg,m[1]); await pg.wait_for_timeout(1600)
        check(await in_sync(pg), 'an out-of-step board repairs itself')
        check(not errs, 'no page errors %s'%errs)
        await b.close()
asyncio.run(main())
