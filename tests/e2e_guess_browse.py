"""Guess-the-move: browse played moves with arrow keys, buttons and the move list (like Lichess).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_guess_browse.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html'); BASE=URL.split('#')[0]
CHROME=os.environ.get('CHROME') or None
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: raise SystemExit(1)
# pieces on the board as {square:piece} read from chessground
BOARD="""(()=>{const b=document.querySelector('#lesson cg-board'), r=b.getBoundingClientRect(), black=b.closest('.cg-wrap').classList.contains('orientation-black'), o={};
  b.querySelectorAll('piece').forEach(p=>{ if(p.classList.contains('ghost')||p.classList.contains('fading')) return; const q=p.getBoundingClientRect(); let x=Math.floor((q.left+q.width/2-r.left)/(r.width/8)), y=Math.floor((q.top+q.height/2-r.top)/(r.height/8));
    const f=black?7-x:x, k=black?y:7-y; o['abcdefgh'[f]+(k+1)]=p.className.replace(' ',':'); }); return o; })()"""
EXPECT="""(n)=>{const s=window.__L().state(), C=window.ChessJS.Chess||window.ChessJS, g=new C(); for(let i=0;i<n;i++){const m=s.list[i]; g.move({from:m.from,to:m.to,promotion:m.promotion});}
  const o={}; g.board().forEach((row,ri)=>row.forEach((sq,fi)=>{ if(sq) o['abcdefgh'[fi]+(8-ri)]=(sq.color==='w'?'white':'black')+':'+{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[sq.type]; })); return o;}"""
async def tap(pg,sq):
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const black=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1; let x=black?7-f:f, y=black?k:7-k; return [r.left+(x+.5)*r.width/8, r.top+(y+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        for vp in [(400,860),(1280,800)]:
            pg=await b.new_page(viewport={'width':vp[0],'height':vp[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto(BASE); await pg.wait_for_timeout(400); await pg.click('[data-act="lang"][data-v="en"]')
            await pg.click('[data-act="slot"][data-k="wed"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(800)
            await pg.click('[data-l="go"]')
            for _ in range(60):
                if await pg.evaluate("window.__L().state().status")=='guess': break
                await pg.wait_for_timeout(500)
            P=await pg.evaluate("window.__L().state().p"); tag='%dx%d'%vp
            check(P>=16, tag+': opening played, guessing at ply %d'%P)
            await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==P-3, tag+': ArrowLeft x3 steps back 3 plies')
            check(await pg.evaluate(BOARD)==await pg.evaluate(EXPECT,P-3), tag+': board shows that position')
            check(await pg.is_visible('text=Back to the game'), tag+': "back to the game" shown while browsing')
            await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==P-2, tag+': ArrowRight steps forward')
            await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==0 and await pg.evaluate(BOARD)==await pg.evaluate(EXPECT,0), tag+': ArrowUp jumps to the start')
            await pg.click('[data-l="ply"][data-v="5"]'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==5 and await pg.evaluate(BOARD)==await pg.evaluate(EXPECT,5), tag+': clicking a move in the list jumps there')
            check(await pg.evaluate("document.querySelector('.mlist .cur').dataset.v")=='5', tag+': current move highlighted')
            await pg.click('[data-l="nav"][data-v="next"]'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==6, tag+': ▶ button steps forward')
            await pg.click('[data-l="nav"][data-v="last"]'); await pg.wait_for_timeout(500)
            check(await pg.evaluate("window.__L().state().vi")==None and await pg.evaluate(BOARD)==await pg.evaluate(EXPECT,P), tag+': ⏭ returns to the live game')
            await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(150)
            check(await pg.evaluate("window.__L().state().vi")==None, tag+': cannot browse past the game (no spoilers)')
            m=await pg.evaluate("(()=>{const s=window.__L().state();return s.list[s.p]})()")
            await tap(pg,m['from']); await pg.wait_for_timeout(100); await tap(pg,m['to']); await pg.wait_for_timeout(600)
            check(await pg.evaluate("window.__L().state().first")==1, tag+': guessing still works after browsing')
            check(not errs, tag+': no page errors %s'%errs)
            await pg.close()
        await b.close()
asyncio.run(main())
