"""End-to-end browser test (Playwright + Chrome).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  pip install playwright python-chess
  python3 tests/e2e_endgames.py

Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome), SHOTS (screenshot folder, default /tmp)
"""
import os
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
CHROME=os.environ.get('CHROME') or None
SHOTS=os.environ.get('SHOTS','/tmp')
import asyncio, chess, chess.engine
from playwright.async_api import async_playwright
SF=chess.engine.SimpleEngine.popen_uci(['node',os.path.join(os.path.dirname(__file__),'..','public','engine','stockfish-17.1-lite-single-03e3232.js')])
async def tap(pg,sq):
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const black=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1; let x=black?7-f:f, y=black?k:7-k; return [r.left+(x+.5)*r.width/8, r.top+(y+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y)
async def mv(pg,u):
    await tap(pg,u[:2]); await pg.wait_for_timeout(80); await tap(pg,u[2:4]); await pg.wait_for_timeout(150)
    if len(u)==5: await pg.click('.promo-choice square:nth-child(1)')
async def state(pg): return await pg.evaluate("(()=>{const s=window.__L().state();const c=s.cur;return c?{fen:c.g.fen(),status:c.status,msg:c.msg,kid:c.kid,moves:c.kidMoves}:null})()")
async def waitplay(pg,limit=40):
    for _ in range(limit):
        s=await state(pg)
        if s['status'] not in ('think','check'): return s
        await pg.wait_for_timeout(250)
    return await state(pg)
async def pick(pg,eid):
    await pg.click('[data-l="menu"]') if await pg.query_selector('[data-l="menu"]') else None
    await pg.wait_for_timeout(200); await pg.click(f'[data-l="pick"][data-v="{eid}"]'); await pg.wait_for_timeout(300)
async def play_best(pg,maxmoves=40):
    for i in range(maxmoves):
        s=await waitplay(pg)
        if s['status']!='play': return s
        b=chess.Board(s['fen']); r=SF.play(b,chess.engine.Limit(time=0.5)); await mv(pg,r.move.uci())
    return await waitplay(pg)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await br.new_page(viewport={'width':400,'height':860})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(500)
        await pg.click('[data-act="lang"][data-v="en"]')
        await pg.click('[data-act="slot"][data-k="tue"]'); await pg.click('[data-act="lesson"]')
        for _ in range(60):
            if 'Waking' not in await pg.inner_text('#lesson'): break
            await pg.wait_for_timeout(500)
        # 1 Vancura Rxa6
        await pick(pg,'van'); await mv(pg,'f6a6'); await pg.wait_for_timeout(300); s=await waitplay(pg); await pg.wait_for_timeout(1500)
        print('VAN Rxa6 ->', s['status'], '|', (await state(pg))['msg'])
        await pg.screenshot(path=SHOTS+'/eg_fail.png')
        await pg.click('[data-l="takeback"]'); await pg.wait_for_timeout(300); s=await state(pg); print('takeback ->', s['status'], s['fen'], '|', s['msg'])
        # play correct defence to completion
        s=await play_best(pg,40); print('VAN best play ->', s['status'], s['moves'], '|', s['msg'])
        # 2 op1 mistake Kd3 (draw)
        await pick(pg,'op1'); await mv(pg,'e3d3'); s=await waitplay(pg); await pg.wait_for_timeout(1500); print('OP1 Kd3 ->', s['status'], '|', (await state(pg))['msg'])
        # 3 op1 best play to win
        await pg.click('[data-l="retry"]'); await pg.wait_for_timeout(300)
        s=await play_best(pg,40); print('OP1 best ->', s['status'], s['moves'], '|', s['msg'])
        # 4 Lucena blunder Rc2
        await pick(pg,'luc1'); await mv(pg,'c1c2'); s=await waitplay(pg); await pg.wait_for_timeout(1500); print('LUC Rc2 ->', s['status'], '|', (await state(pg))['msg'])
        # 5 Philidor best play
        await pick(pg,'phi'); s=await play_best(pg,40); print('PHI best ->', s['status'], s['moves'], '|', s['msg'])
        await pg.screenshot(path=SHOTS+'/eg_phi.png')
        print(errs or 'no errors')
        await br.close()
    SF.quit()
asyncio.run(main())
