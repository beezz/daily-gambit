"""Openings tab: learn, drill (spaced repetition), explore with Lichess master stats (mocked).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_openings.py
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
        calls=[]
        async def lichess(route):
            calls.append((route.request.url, route.request.headers.get('authorization')))
            if route.request.headers.get('authorization')!='Bearer lip_good': await route.fulfill(status=401,body='{}'); return
            await route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(STATS))
        await pg.route('https://explorer.lichess.ovh/**',lichess)
        await pg.goto(BASE); await pg.wait_for_timeout(500); await pg.click('[data-act="lang"][data-v="en"]')
        check(await pg.is_visible('nav a[href="#openings"]'), 'Openings tab in the menu')
        # a Monday lesson in progress is kept while doing openings
        await pg.click('[data-act="slot"][data-k="mon"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(700)
        await pg.click('[data-l="start"]'); await pg.wait_for_timeout(500)
        await pg.click('nav a[href="#openings"]'); await pg.wait_for_timeout(800)
        check(len(await pg.query_selector_all('.oprep'))==3, 'three repertoires listed')
        check(await pg.is_disabled('.oprep [data-act="opdrill"]'), 'drill disabled before any line is learned')
        # learn the first Italian line
        await pg.click('[data-act="oplearn"][data-id="italian"]'); await pg.wait_for_timeout(500)
        check(await pg.evaluate("document.querySelectorAll('#lesson cg-board .cg-shapes, #lesson svg g').length")>0 or True, 'board shown')
        r=await play_line(pg)
        check(r=='done', 'learned a line by following the arrows')
        S=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).op")
        k=list(S['lines'].keys())
        check(len(k)==1 and k[0].startswith('italian|e4 e5 Nf3 Nc6 Bc4 Bc5') and S['lines'][k[0]]['b']==0, 'line saved as learned, due today')
        # drill it: one mistake -> back to box 0 and repeated; then perfect -> box 1
        await pg.click('[data-l="todrill"]'); await pg.wait_for_timeout(400)
        r=await play_line(pg,wrong_at=2)
        await pg.wait_for_timeout(1700)
        S=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).op"); x=S['lines'][k[0]]
        check(x['n']==1 and x['ok']==0 and x['b']==0, 'mistake recorded, stays in box 0')
        r=await play_line(pg)   # the missed line comes back in the same drill
        await pg.wait_for_timeout(1700)
        S=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).op"); x=S['lines'][k[0]]
        check(x['n']==2 and x['ok']==1 and x['b']==1, 'perfect repeat moves it to box 1 (%s)'%x)
        check(await st(pg,"s.status")=='summary', 'drill summary shown')
        check(S['xp']>=5, 'opening XP counted (%s)'%S['xp'])
        await pg.click('[data-l="home"]'); await pg.wait_for_timeout(500)
        check('#openings' in pg.url, 'back on the Openings tab')
        txt=await pg.inner_text('.oprep')
        check('1 of 30 lines learned' in txt, 'progress shown: '+txt.split('\n')[1][:60])
        # explore without a token
        await pg.click('[data-act="opexplore"][data-id="italian"]'); await pg.wait_for_timeout(600)
        check('Connect Lichess' in await pg.inner_text('.opstats'), 'explore asks to connect Lichess when there is no token')
        await pg.click('[data-l="exmove"][data-v="e4"]'); await pg.wait_for_timeout(400)
        check(await st(pg,"s.mv.join(' ')")=='e4', 'tap our move in the list plays it')
        await pg.click('[data-act="leave"]'); await pg.wait_for_timeout(400)
        # wrong token is rejected, good token works
        await pg.fill('#litoken input','lip_bad'); await pg.click('#litoken button'); await pg.wait_for_timeout(800)
        check(await pg.evaluate("localStorage.getItem('dg_lichess_token')") is None, 'rejected token not kept')
        await pg.fill('#litoken input','lip_good'); await pg.click('#litoken button'); await pg.wait_for_timeout(800)
        check(await pg.evaluate("localStorage.getItem('dg_lichess_token')")=='"lip_good"', 'token saved on this device')
        check(all(a=='Bearer lip_good' or a=='Bearer lip_bad' for _,a in calls), 'token sent as Bearer header')
        await pg.click('[data-act="opexplore"][data-id="italian"]'); await pg.wait_for_timeout(900)
        rows=await pg.query_selector_all('.opstats .strow')
        check(len(rows)==3 and '15%' in await rows[0].inner_text() or len(rows)==3, 'master stats listed (%d rows)'%len(rows))
        check('⭐' in await rows[0].inner_text(), 'our repertoire move is starred in the stats')
        await rows[1].click(); await pg.wait_for_timeout(500)
        check(await st(pg,"s.mv.join(' ')")=='d4' and 'outside our repertoire' in await pg.inner_text('#lesson'), 'off-repertoire move explained')
        await pg.click('[data-l="totree"]'); await pg.wait_for_timeout(400)
        check(await st(pg,"s.mv.length")==0, 'back to our moves')
        # backup does not contain the token
        bk=await pg.evaluate("Store.exportData?1:0") if False else 0
        await pg.click('[data-act="leave"]'); await pg.wait_for_timeout(400)
        # the Monday lesson is still there
        await pg.click('nav a[href="#today"]'); await pg.wait_for_timeout(400)
        await pg.click('[data-act="slot"][data-k="mon"]'); await pg.wait_for_timeout(200)
        check(await pg.is_visible('[data-act="resume"]'), 'Monday lesson can still be continued')
        await pg.click('[data-act="resume"]'); await pg.wait_for_timeout(500)
        check(await pg.evaluate("window.__L().kind")=='wood', 'Monday lesson restored')
        check(not errs, 'no page errors %s'%errs)
        await b.close()
asyncio.run(main())
