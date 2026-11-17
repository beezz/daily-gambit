"""End-to-end browser test (Playwright + Chrome).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  pip install playwright python-chess
  python3 tests/e2e_lessons.py

Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome), SHOTS (screenshot folder, default /tmp)
"""
import os
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
CHROME=os.environ.get('CHROME') or None
SHOTS=os.environ.get('SHOTS','/tmp')
import asyncio, json
from playwright.async_api import async_playwright
URL=URL
import chess
async def sqxy(pg,sq):
    return await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const black=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1; let x=black?7-f:f, y=black?k:7-k; return [r.left+(x+.5)*r.width/8, r.top+(y+.5)*r.height/8]}""",sq)
async def tap(pg,sq):
    x,y=await sqxy(pg,sq); await pg.mouse.click(x,y)
async def mv(pg,u):
    await tap(pg,u[:2]); await pg.wait_for_timeout(80); await tap(pg,u[2:4]); await pg.wait_for_timeout(120)
    if len(u)==5:
        await pg.click('.promo-choice square:nth-child(1)')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860})
        errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.type+' '+m.text) if m.type=='error' and 'favicon' not in m.text else None)
        await pg.goto(URL); await pg.wait_for_timeout(600)
        await pg.click('[data-act="lang"][data-v="en"]'); await pg.wait_for_timeout(200)
        data=await pg.evaluate("fetch('data/puzzles.json').then(r=>r.json())")
        easy=data['wood']['easy']
        # ---- MONDAY
        await pg.click('[data-act="slot"][data-k="mon"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(600)
        await pg.click('[data-l="start"]')
        for i in range(10):
            await pg.wait_for_timeout(900)
            if await pg.query_selector('.overlay'): break
            moves=easy[i][2].split()
            if i in (1,3,5,6):  # wrong answer: play some other legal move -> click a random own piece? use solution's from-square to a wrong square
                await pg.click('[data-l="endsolve"]') if False else None
                # choose wrong: move solution piece somewhere legal else
                bd=chess.Board(easy[i][1]); bd.push_uci(moves[0])
                wrong=[m.uci() for m in bd.legal_moves if m.uci()!=moves[1] and not (bd.copy().push(m) or False)]
                wrong=[w for w in wrong if not bd.gives_check(chess.Move.from_uci(w))][:1] or wrong[:1]
                await mv(pg,wrong[0])
                await pg.wait_for_timeout(900+800*len(moves))
                msg=await pg.inner_text('#lesson .msg'); print('P',i,'WRONG ->',msg[:70])
                btn=await pg.query_selector('[data-l="next"]')
                if btn: await btn.click()
                continue
            for k in range(1,len(moves),2):
                await mv(pg,moves[k]); await pg.wait_for_timeout(650)
            msg=await pg.inner_text('#lesson .msg'); print('P',i,'->',msg[:70])
            await pg.wait_for_timeout(700)
        ov=await pg.query_selector('.overlay')
        print('circuit overlay shown:', bool(ov))
        await pg.screenshot(path=SHOTS+'/wood_cb.png')
        if ov: await pg.click('[data-l="cbstop"]')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=SHOTS+'/wood_done.png')
        await pg.click('[data-l="log"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=SHOTS+'/today_logged.png',full_page=True)
        st=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state'))")
        s=st['sessions'][0]; print('SESSION', s['slot'], s['wp']['n'], s['wp']['ok'], len(s['wp'].get('items',[])), 'stopped',s['stopped'],'wpPos',st['wpPos'])
        print('\n'.join(errs) or 'no errors'); errs.clear()
        # ---- TUESDAY endgame with engine
        await pg.goto(URL+'#today'); await pg.wait_for_timeout(500)
        await pg.click('[data-act="slot"][data-k="tue"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        for t in range(40):
            txt=await pg.inner_text('#lesson')
            if 'Waking' not in txt: break
            await pg.wait_for_timeout(500)
        print('engine status text:', 'fail' if 'couldn' in txt else 'ok')
        await pg.click('[data-l="pick"][data-v="op1"]'); await pg.wait_for_timeout(300)
        await mv(pg,'e3e4'); await pg.wait_for_timeout(2500)
        print('EG msg:', (await pg.inner_text('#lesson .msg'))[:80])
        await pg.click('[data-l="hint"]'); await pg.wait_for_timeout(2500)
        print('EG hint:', (await pg.inner_text('#lesson .msg'))[:80], await pg.evaluate("[...document.querySelectorAll('#lesson .s.hint')].map(e=>e.dataset.sq)"))
        await pg.screenshot(path=SHOTS+'/eg.png')
        await pg.click('[data-l="menu"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-l="log"]'); await pg.wait_for_timeout(400)
        print('TUE logged', await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('ctq2_state')).sessions;const x=s[s.length-1];return [x.slot,x.min,x.parts,x.acc]})()"))
        print('\n'.join(errs) or 'no errors'); errs.clear()
        # ---- WEDNESDAY guess
        await pg.click('[data-act="slot"][data-k="wed"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-l="go"]'); await pg.wait_for_timeout(16*130+1800)
        msg=await pg.inner_text('#lesson .msg'); print('WED',msg[:90])
        # wrong guess twice: tap a random own piece with a legal move
        for k in range(2):
            sq=await pg.evaluate("""()=>{for(const e of document.querySelectorAll('#lesson .b8 .s')){ if(e.querySelector('svg.pc')) {} } return null}""")
        await pg.screenshot(path=SHOTS+'/wed.png')
        await pg.click('[data-l="stop"]'); await pg.wait_for_timeout(300)
        print('\n'.join(errs) or 'no errors'); errs.clear()
        # ---- FRIDAY
        await pg.click('[data-act="slot"][data-k="fri"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-l="bstart"]'); await pg.wait_for_timeout(300)
        bl=data['blind'][0]; await pg.click(f'[data-l="bans"][data-v="{bl["steps"][0]["san"]}"]'); await pg.wait_for_timeout(300)
        print('BLIND', (await pg.inner_text('#lesson .msg'))[:100])
        await pg.click('[data-l="peek"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=SHOTS+'/blind.png',full_page=True)
        await pg.click('[data-l="tab"][data-v="threat"]'); await pg.click('[data-l="tstart"]'); await pg.wait_for_timeout(300)
        th=data['threat'][0]; await mv(pg,th['ans']); await pg.wait_for_timeout(300)
        print('THREAT', (await pg.inner_text('#lesson .msg'))[:100])
        await pg.screenshot(path=SHOTS+'/threat.png')
        await pg.click('[data-l="log"]'); await pg.wait_for_timeout(300)
        print('\n'.join(errs) or 'no errors'); errs.clear()
        # ---- WEEKEND
        await pg.click('[data-act="slot"][data-k="wk"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-l="play"]'); await pg.wait_for_timeout(500)
        await mv(pg,'e2e4'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS+'/wk_confirm.png')
        await pg.click('[data-l="confirm"]'); await pg.wait_for_timeout(2500)
        print('WK after engine:', (await pg.inner_text('#lesson .msg'))[:60])
        await mv(pg,'g1f3'); await pg.click('[data-l="confirm"]'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=SHOTS+'/wk_play.png')
        await pg.click('[data-l="resign"]'); await pg.wait_for_timeout(500)
        for ply in (1,2,3):
            await pg.click(f'[data-l="goto"][data-v="{ply}"]'); await pg.wait_for_timeout(150)
            await pg.fill('[data-n="cand"]','Nf3, d4'); await pg.click('[data-l="ev"][data-v="="]'); await pg.wait_for_timeout(150)
        await pg.click('[data-l="goto"][data-v="3"]'); await pg.click('[data-l="tag"][data-v="?"]')
        await pg.screenshot(path=SHOTS+'/wk_nb.png',full_page=True)
        await pg.click('[data-l="unlock"]')
        for t in range(30):
            await pg.wait_for_timeout(500)
            if await pg.query_selector('[data-l="tonb"]'): break
        await pg.screenshot(path=SHOTS+'/wk_review.png',full_page=True)
        await pg.click('[data-l="log"]'); await pg.wait_for_timeout(500)
        print('WK logged', await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('ctq2_state')).sessions;const x=s[s.length-1];return [x.slot,x.res,x.blunders,x.engine,x.parts]})()"))
        if await pg.query_selector('[data-act="later"]'): await pg.click('[data-act="later"]'); await pg.wait_for_timeout(300)
        # ---- THURSDAY speed + coord
        await pg.click('[data-act="slot"][data-k="thu"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        print('THU intro:', (await pg.inner_text('#lesson'))[:90].replace('\n',' '))
        await pg.click('[data-l="start"]'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=SHOTS+'/thu.png')
        await pg.click('[data-l="endsolve"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-l="coord"]'); await pg.wait_for_timeout(400)
        await pg.click('[data-l="start"]'); await pg.wait_for_timeout(300)
        for q in range(6):
            txt=await pg.inner_text('#lesson .msg')
            if 'Tap' in txt:
                sq=txt.split()[-1]; await tap(pg,sq)
            elif 'light or dark' in txt:
                await pg.click('[data-l="pick"][data-v="dark"]')
            else:
                btn=await pg.query_selector('[data-l="pick"]'); await btn.click()
            await pg.wait_for_timeout(200)
            if q==2: await pg.screenshot(path=SHOTS+'/coord.png')
            await pg.wait_for_timeout(2300)
        await pg.click('[data-l="end"]'); await pg.click('[data-l="log"]'); await pg.wait_for_timeout(300)
        print('THU logged', await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('ctq2_state')).sessions;const x=s[s.length-1];return [x.slot,x.min,x.parts,x.wp,x.acc]})()"))
        print('pending left', await pg.evaluate("localStorage.getItem('ctq2_pend')"))
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
