"""End-to-end browser test (Playwright + Chrome).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  pip install playwright python-chess
  python3 tests/e2e_features.py

Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome), SHOTS (screenshot folder, default /tmp)
"""
import os
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
CHROME=os.environ.get('CHROME') or None
SHOTS=os.environ.get('SHOTS','/tmp')
import asyncio, chess
from playwright.async_api import async_playwright
URL=URL
async def tap(pg,sq):
    x,y=await pg.evaluate("""(sq)=>{const b=document.querySelector('#lesson cg-board');const r=b.getBoundingClientRect();const black=b.closest('.cg-wrap').classList.contains('orientation-black');
      let f='abcdefgh'.indexOf(sq[0]),k=+sq[1]-1; let x=black?7-f:f, y=black?k:7-k; return [r.left+(x+.5)*r.width/8, r.top+(y+.5)*r.height/8]}""",sq)
    await pg.mouse.click(x,y)
async def mv(pg,u):
    await tap(pg,u[:2]); await pg.wait_for_timeout(80); await tap(pg,u[2:4]); await pg.wait_for_timeout(120)
    if len(u)==5: await pg.click('.promo-choice square:nth-child(1)')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860})
        errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and '404' not in m.text else None)
        await pg.goto(URL); await pg.wait_for_timeout(700)
        await pg.screenshot(path=SHOTS+'/k_today_sk.png')
        print('SK bubble:', (await pg.inner_text('.bubble')).replace('\n',' '))
        await pg.click('[data-act="lang"][data-v="en"]'); await pg.wait_for_timeout(200)
        data=await pg.evaluate("fetch('data/puzzles.json').then(r=>r.json())"); easy=data['wood']['easy']
        # ---- Monday: solve 2, fail 1, finish, keep solving
        await pg.click('[data-act="slot"][data-k="mon"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(500)
        await pg.click('[data-l="start"]')
        for i in range(3):
            await pg.wait_for_timeout(900); moves=easy[i][2].split()
            if i==1:
                bd=chess.Board(easy[i][1]); bd.push_uci(moves[0]); w=[m.uci() for m in bd.legal_moves if m.uci()!=moves[1]][0]
                await mv(pg,w); await pg.wait_for_timeout(1200+800*len(moves)); await pg.click('[data-l="next"]'); continue
            for k in range(1,len(moves),2): await mv(pg,moves[k]); await pg.wait_for_timeout(650)
            await pg.wait_for_timeout(700)
        await pg.click('[data-l="endsolve"]'); await pg.wait_for_timeout(900)
        print('retry phase pill:', await pg.inner_text('#lesson .pill'), '| keep btn:', bool(await pg.query_selector('[data-l="keep"]')))
        await pg.click('[data-l="keep"]'); await pg.wait_for_timeout(1000)
        print('after keep:', (await pg.inner_text('#lesson .lbar')).replace('\n',' '), '|', await pg.inner_text('#lesson .msg'))
        moves=easy[3][2].split()
        for k in range(1,len(moves),2): await mv(pg,moves[k]); await pg.wait_for_timeout(650)
        await pg.wait_for_timeout(1500)
        await pg.click('[data-l="endsolve"]'); await pg.wait_for_timeout(1000)
        # in retry for failed puzzle 1? already retried -> should go done
        txt=await pg.inner_text('#lesson'); print('after 2nd finish:', txt[:60].replace('\n',' '))
        if await pg.query_selector('[data-l="skipretry"]'): await pg.click('[data-l="skipretry"]'); await pg.wait_for_timeout(300)
        print('done keep btn:', bool(await pg.query_selector('[data-l="keep"]')))
        await pg.click('[data-l="log"]'); await pg.wait_for_timeout(500)
        await pg.click('#go'); await pg.wait_for_timeout(600)
        print('overlay after partial mon:', bool(await pg.query_selector('.overlay')))
        # ---- Tuesday manual full session -> reward
        await pg.click('[data-act="slot"][data-k="tue"]'); await pg.wait_for_timeout(200)
        await pg.click('details[data-act="openlog"] summary'); await pg.wait_for_timeout(200)
        await pg.check('input[name="p0"]'); await pg.check('input[name="p1"]'); await pg.fill('input[name="acc"]','85')
        print('go label:', await pg.inner_text('#go'))
        await pg.click('#go'); await pg.wait_for_timeout(900)
        await pg.screenshot(path=SHOTS+'/k_reward.png')
        print('reward overlay:', bool(await pg.query_selector('.ptile')))
        await pg.click('.ptile'); await pg.wait_for_timeout(600)
        print('prizes tab:', (await pg.inner_text('.card')).replace('\n',' ')[:120])
        await pg.click('[data-act="give"]'); await pg.wait_for_timeout(150); await pg.click('[data-act="give"]'); await pg.wait_for_timeout(300)
        print('after given:', (await pg.inner_text('.card')).replace('\n',' ')[:120])
        await pg.screenshot(path=SHOTS+'/k_prizes.png',full_page=True)
        # ---- settings: add prize, German
        await pg.goto(URL+'#history'); await pg.wait_for_timeout(400)
        await pg.fill('#addprize input[name="name"]','Ice cream'); await pg.click('#addprize button'); await pg.wait_for_timeout(300)
        print('catalog:', await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state')).catalog.length"))
        await pg.click('[data-act="lang"][data-v="de"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS+'/k_log_de.png',full_page=True)
        # ---- reset with double confirmation
        await pg.click('[data-act="reset1"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="reset2"]'); await pg.wait_for_timeout(200)
        print('reset btn disabled before:', await pg.get_attribute('#resetgo','disabled'))
        await pg.fill('#resetword','loeschen'); await pg.wait_for_timeout(100)
        print('reset btn disabled after:', await pg.get_attribute('#resetgo','disabled'))
        await pg.screenshot(path=SHOTS+'/k_reset.png')
        await pg.click('#resetgo'); await pg.wait_for_timeout(600)
        st=await pg.evaluate("JSON.parse(localStorage.getItem('ctq2_state'))")
        print('after reset sessions:', len(st['sessions']), 'wpPos', st['wpPos'], 'lang', st['lang'], 'rewards', await pg.evaluate("localStorage.getItem('ctq2_rewards')"))
        # ---- German lessons glance
        await pg.click('[data-act="slot"][data-k="fri"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(600)
        await pg.click('[data-l="bstart"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS+'/k_blind_de.png')
        await pg.click('[data-act="leave"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="lang"][data-v="sk"]'); await pg.click('[data-act="slot"][data-k="tue"]'); await pg.click('[data-act="lesson"]'); await pg.wait_for_timeout(2500)
        await pg.click('[data-l="pick"][data-v="luc1"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=SHOTS+'/k_eg_sk.png')
        print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
