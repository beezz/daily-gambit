"""Players: add, switch, isolation and delete — on-device storage and the claude.ai db (mocked).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  python3 tests/e2e_users.py
Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome)
"""
import os, asyncio, json
from playwright.async_api import async_playwright
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
BASE=URL.split('#')[0]
CHROME=os.environ.get('CHROME') or None

# claude.ai db mock that survives reloads (kept in sessionStorage)
MOCK=r"""
(function(){
 const store=JSON.parse(sessionStorage.getItem('__mockdb')||'{}'); const subs=[];
 function save(){ sessionStorage.setItem('__mockdb',JSON.stringify(store)); }
 function notify(){ subs.forEach(s=>s()); }
 function docs(path){ return Object.keys(store).filter(k=>k.startsWith(path+'/')&&k.split('/').length===2).map(k=>({id:k.split('/')[1],exists:true,data:()=>store[k]})); }
 function docRef(path){ return {path, get:async()=>({exists:path in store,data:()=>store[path]}),
   set:async(d)=>{ store[path]=JSON.parse(JSON.stringify(d)); save(); setTimeout(notify,10); },
   delete:async()=>{ delete store[path]; save(); setTimeout(notify,10); },
   onSnapshot:(next)=>{ const f=()=>next({exists:path in store,data:()=>store[path],metadata:{fromCache:false}}); subs.push(f); setTimeout(f,30); return ()=>{}; } }; }
 function colRef(path){ return {path, doc:(id)=>docRef(path+'/'+id),
   get:async()=>{ const d=docs(path); return {docs:d,size:d.length,empty:!d.length}; },
   onSnapshot:(next)=>{ const f=()=>{ const d=docs(path); next({docs:d,size:d.length,empty:!d.length,metadata:{fromCache:false}}); }; subs.push(f); setTimeout(f,30); return ()=>{}; } }; }
 window.__store=store;
 window.claude={use:(n)=>Promise.resolve(n==='db'?{doc:docRef,collection:colRef}:null)};
})();
"""

def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: raise SystemExit(1)

async def log_rest_day(pg):
    await pg.goto(BASE+'#today'); await pg.wait_for_timeout(400)
    await pg.click('details[data-act="openlog"] summary'); await pg.wait_for_timeout(150)
    await pg.fill('textarea[name="note"]','hello'); await pg.click('#go'); await pg.wait_for_timeout(600)
    if await pg.query_selector('[data-act="later"]'): await pg.click('[data-act="later"]')

async def nsessions(pg): return await pg.evaluate("window.__dbg?0:document.querySelectorAll('.hist').length")

async def run(pg,label,live):
    await pg.goto(BASE); await pg.wait_for_timeout(700)
    await pg.click('[data-act="lang"][data-v="en"]'); await pg.wait_for_timeout(200)
    # first player logs a session
    await log_rest_day(pg)
    name0=await pg.inner_text('.pname')
    # players page from the hero name
    await pg.click('.pname'); await pg.wait_for_timeout(400)
    check('#users' in pg.url and await pg.is_visible('#adduser'), label+': players page opens from the name')
    check(len(await pg.query_selector_all('.urow'))==1, label+': one player to start')
    await pg.fill('#adduser input[name="name"]','Ema'); await pg.click('#adduser button'); await pg.wait_for_timeout(500)
    check(len(await pg.query_selector_all('.urow'))==2, label+': player added')
    # switch to Ema (reload)
    await pg.click('[data-act="uswitch"]'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(900)
    check((await pg.inner_text('.pname')).startswith('Ema'), label+': switched to Ema')
    await pg.goto(BASE+'#history'); await pg.wait_for_timeout(500)
    check(len(await pg.query_selector_all('.hist'))==0, label+': Ema starts with an empty log')
    await log_rest_day(pg); await pg.goto(BASE+'#history'); await pg.wait_for_timeout(400)
    check(len(await pg.query_selector_all('.hist'))==1, label+': Ema has her own session')
    # rename Ema in Settings; the list (and other players' view of it) must follow
    await pg.fill('#settings input[name="player"]','Emka'); await pg.click('#settings button[type=submit]'); await pg.wait_for_timeout(500)
    await pg.goto(BASE+'#users'); await pg.wait_for_timeout(400)
    check('Emka' in await pg.inner_text('.urow.me'), label+': renamed player shown in list')
    # back to the first player: still only their one session
    await pg.goto(BASE+'#users'); await pg.wait_for_timeout(400)
    await pg.click('[data-act="uswitch"]'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(900)
    check((await pg.inner_text('.pname')).split(' ⇄')[0].strip()==name0.strip(), label+': back to first player')
    await pg.goto(BASE+'#users'); await pg.wait_for_timeout(600)
    names=[await r.inner_text() for r in await pg.query_selector_all('.urow .um b')]
    check('Emka' in names and 'Ema' not in names, label+': other player shows her new name, not the old one %s'%names)
    if live:
        # a stale player list (old names) must not win over the players' own settings
        await pg.evaluate("(()=>{const d=JSON.parse(sessionStorage.getItem('__mockdb'));d['meta/users'].list.forEach(u=>u.name='OLD');sessionStorage.setItem('__mockdb',JSON.stringify(d));})()")
        await pg.reload(); await pg.wait_for_timeout(900); await pg.goto(BASE+'#users'); await pg.wait_for_timeout(600)
        names=[await r.inner_text() for r in await pg.query_selector_all('.urow .um b')]
        check('OLD' not in names and 'Emka' in names, label+': names come from each player, not the stale list %s'%names)
    await pg.goto(BASE+'#history'); await pg.wait_for_timeout(500)
    check(len(await pg.query_selector_all('.hist'))==1, label+': first player data untouched')
    # delete Ema (two confirmations)
    await pg.goto(BASE+'#users'); await pg.wait_for_timeout(400)
    rows=await pg.query_selector_all('.urow')
    ema=[r for r in rows if 'Emka' in await r.inner_text()][0]
    await (await ema.query_selector('[data-act="udel"]')).click(); await pg.wait_for_timeout(200)
    check(await pg.is_visible('[data-act="udel2"]'), label+': first confirmation shown')
    await pg.click('[data-act="udel2"]'); await pg.wait_for_timeout(200)
    check(await pg.is_disabled('#resetgo'), label+': delete disabled until word typed')
    await pg.fill('#resetword','DELETE'); await pg.click('#resetgo'); await pg.wait_for_timeout(800)
    check(len(await pg.query_selector_all('.urow'))==1, label+': Emka removed from list')
    if live:
        keys=await pg.evaluate("Object.keys(window.__store)")
        left=[k for k in keys if k.startswith('u_')]
        check(not left, label+': Ema data deleted from db (left %s)'%left)
        check(any(k.startswith('sessions/') for k in keys) and 'meta/users' in keys, label+': first player data and player list kept')
    else:
        keys=await pg.evaluate("Object.keys(localStorage)")
        left=[k for k in keys if k.startswith('ctq2u_')]
        check(not left, label+': Ema data deleted from device (left %s)'%left)
        check('ctq2_state' in keys, label+': first player data kept')
    # only one player left: no delete button
    check(not await pg.query_selector('[data-act="udel"]'), label+': last player cannot be deleted')
    # deleting the active player switches to another one
    await pg.fill('#adduser input[name="name"]','Tomi'); await pg.click('#adduser button'); await pg.wait_for_timeout(500)
    await pg.click('[data-act="uswitch"]'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(900)
    await pg.goto(BASE+'#users'); await pg.wait_for_timeout(400)
    me=await pg.query_selector('.urow.me'); await (await me.query_selector('[data-act="udel"]')).click()
    await pg.click('[data-act="udel2"]'); await pg.fill('#resetword','DELETE'); await pg.click('#resetgo')
    await pg.wait_for_load_state('load'); await pg.wait_for_timeout(1200)
    check((await pg.inner_text('.pname')).split(' ⇄')[0].strip()==name0.strip(), label+': deleting active player switches to the remaining one')

async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        errs=[]
        ctx=await br.new_context(viewport={'width':400,'height':860}); pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        await run(pg,'device',False); await ctx.close()
        ctx=await br.new_context(viewport={'width':400,'height':860}); await ctx.add_init_script(MOCK); pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        await run(pg,'claude.ai db',True); await ctx.close()
        check(not errs, 'no page errors %s'%errs)
        await br.close()
asyncio.run(main())
