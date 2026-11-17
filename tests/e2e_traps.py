"""Traps in the Openings tab: spring a trap, avoid a trap, drill traps.

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_traps.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio, json
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html'); BASE=URL.split('#')[0]
CHROME=os.environ.get('CHROME') or None
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: raise SystemExit(1)

STATS={"white":1000,"draws":1500,"black":700,"opening":None,"moves":[
  {"uci":"e2e4","san":"e4","white":480,"draws":600,"black":320,"averageRating":2400},
  {"uci":"d2d4","san":"d4","white":400,"draws":700,"black":250,"averageRating":2410},
  {"uci":"g1f3","san":"Nf3","white":120,"draws":200,"black":130,"averageRating":2400}]}

async def tap(pg,sq):
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const black=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1; let x=black?7-f:f, y=black?k:7-k; return [r.left+(x+.5)*r.width/8, r.top+(y+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y)
async def st(pg,expr): return await pg.evaluate("(()=>{const s=window.__L().st;return "+expr+"})()")
async def expected(pg):   # from/to of the repertoire move now expected
    return await pg.evaluate("""(()=>{const s=window.__L().st, C=window.ChessJS.Chess||window.ChessJS, g=new C(s.g.fen()); const m=g.move(s.plies[s.i]); return [m.from,m.to]})()""")
async def wait_move(pg,limit=40):
    for _ in range(limit):
        if await st(pg,"s.status") in ('move','done','summary','lineend'): return await st(pg,"s.status")
        await pg.wait_for_timeout(150)
    return await st(pg,"s.status")
async def play_line(pg,wrong_at=None):
    k=0
    while True:
        s=await wait_move(pg)
        if s!='move': return s
        f,t=await expected(pg)
        if wrong_at is not None and k==wrong_at:
            # play some other legal move of ours first
            other=await pg.evaluate("""(()=>{const s=window.__L().st, ms=s.g.moves({verbose:true}); const C=window.ChessJS.Chess||window.ChessJS; const e=new C(s.g.fen()).move(s.plies[s.i]); const o=ms.find(m=>m.from!==e.from||m.to!==e.to); return [o.from,o.to]})()""")
            await tap(pg,other[0]); await pg.wait_for_timeout(80); await tap(pg,other[1]); await pg.wait_for_timeout(300)
            check(await st(pg,"s.mcls")=='no' and await st(pg,"s.status")=='move', 'wrong move is rejected and shown')
        await tap(pg,f); await pg.wait_for_timeout(80); await tap(pg,t); await pg.wait_for_timeout(250); k+=1

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(500); await pg.click('[data-act="lang"][data-v="en"]')
        await pg.click('nav a[href="#openings"]'); await pg.wait_for_timeout(800)
        rows=await pg.query_selector_all('.traprow')
        check(len(rows)==9, '9 traps listed (%d)'%len(rows))
        check(await pg.is_disabled('[data-act="opdrill"][data-id="traps"]'), 'trap drill disabled before learning')
        # spring Scholar's mate
        await pg.click('[data-act="oplearn"][data-id="trap-scholar-set"]'); await pg.wait_for_timeout(400)
        check('f7' in await pg.inner_text('.msg.story'), 'trap story shown')
        r=await play_line(pg)
        msg=await pg.inner_text('#lesson .msg.ok')
        check(r=='done' and 'Trap sprung' in msg, 'scholar mate sprung: '+msg.replace('\n',' ')[:80])
        fen=await st(pg,"s.g.fen()")
        check(await pg.evaluate("(f)=>{const C=window.ChessJS.Chess||window.ChessJS; return new C(f).isCheckmate()}",fen), 'board ends in checkmate')
        # next line continues with the next trap side (avoid it): first moves play themselves
        await pg.click('[data-l="next"]'); await pg.wait_for_timeout(200)
        check(await st(pg,"s.line")=='e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6', "next is: avoid Scholar's mate")
        s0=await wait_move(pg)
        check(await st(pg,"s.i")==5, 'opening moves played automatically up to the critical moment (ply %s)'%await st(pg,"s.i"))
        r=await play_line(pg)
        check(r=='done' and 'Trap avoided' in await pg.inner_text('#lesson .msg.ok'), 'scholar mate avoided')
        # drill traps: one mistake then repeat
        await pg.click('[data-l="todrill"]'); await pg.wait_for_timeout(400)
        check('Traps' in await pg.inner_text('.lhead h2'), 'trap drill title')
        r=await play_line(pg,wrong_at=0); await pg.wait_for_timeout(2900)
        r=await play_line(pg); await pg.wait_for_timeout(2900)
        r=await play_line(pg); await pg.wait_for_timeout(2900)
        check(await st(pg,"s.status")=='summary', 'trap drill finished')
        op=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).op.lines")
        tk={k:v for k,v in op.items() if k.startswith('trap-')}
        check(len(tk)==2 and sorted(v['b'] for v in tk.values())==[1,1] and sum(v['n'] for v in tk.values())==3, 'trap results saved %s'%tk)
        await pg.click('[data-l="home"]'); await pg.wait_for_timeout(500)
        txt=await pg.inner_text('#root')
        check('2 of 18 learned' in txt, 'trap progress shown')
        check(not errs, 'no page errors %s'%errs)
        await b.close()
asyncio.run(main())
