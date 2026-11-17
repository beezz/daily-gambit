"""End-to-end browser test (Playwright + Chrome).

Run from the repo root:
  python3 build.py && (cd dist && python3 -m http.server 8765 &)
  pip install playwright python-chess
  python3 tests/e2e_storage_mock.py

Env: DG_URL (default http://localhost:8765/index.html), CHROME (path to Chrome), SHOTS (screenshot folder, default /tmp)
"""
import os
URL=os.environ.get('DG_URL','http://localhost:8765/index.html')
CHROME=os.environ.get('CHROME') or None
SHOTS=os.environ.get('SHOTS','/tmp')
import asyncio
from playwright.async_api import async_playwright
MOCK=r"""
(function(){
 const store={}; const subs=[];
 function notify(){ subs.forEach(s=>s()); }
 function docRef(path){ return {path, get:async()=>({exists:path in store,data:()=>store[path]}),
   set:async(d)=>{ store[path]=JSON.parse(JSON.stringify(d)); window.__writes=(window.__writes||0)+1; setTimeout(notify,10); },
   delete:async()=>{ delete store[path]; setTimeout(notify,10); },
   onSnapshot:(next,err)=>{ const f=()=>next({exists:path in store,data:()=>store[path],metadata:{fromCache:false,hasPendingWrites:false}}); subs.push(f); setTimeout(f,50); return ()=>{}; } }; }
 function colRef(path){ return {path, doc:(id)=>docRef(path+'/'+id),
   get:async()=>{ const docs=Object.keys(store).filter(k=>k.startsWith(path+'/')&&k.split('/').length===2).map(k=>({id:k.split('/')[1],exists:true,data:()=>store[k]})); return {docs,size:docs.length,empty:!docs.length}; },
   onSnapshot:(next)=>{ const f=()=>{ const docs=Object.keys(store).filter(k=>k.startsWith(path+'/')&&k.split('/').length===2).map(k=>({id:k.split('/')[1],exists:true,data:()=>store[k]})); next({docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false}}); }; subs.push(f); setTimeout(f,50); return ()=>{}; } }; }
 const db={doc:docRef,collection:colRef};
 window.__store=store;
 window.claude={use:(n)=>Promise.resolve(n==='db'?db:null)};
})();
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.add_init_script(MOCK)
        await pg.goto(URL); await pg.wait_for_timeout(700)
        await pg.click('[data-act="lang"][data-v="en"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="slot"][data-k="tue"]'); await pg.click('details[data-act="openlog"] summary')
        await pg.fill('input[name="acc"]','80'); await pg.check('input[name="p0"]'); await pg.check('input[name="p1"]')
        await pg.click('#go'); await pg.wait_for_timeout(500)
        await pg.click('.ptile'); await pg.wait_for_timeout(400)
        await pg.evaluate("window.__store['notebooks/x1']={moves:[]}")
        print('store keys', await pg.evaluate("JSON.stringify(Object.keys(window.__store))"))
        await pg.goto('http://localhost:8765/index.html#history'); await pg.wait_for_timeout(300)
        await pg.click('[data-act="reset1"]'); await pg.click('[data-act="reset2"]'); await pg.fill('#resetword','DELETE'); await pg.click('#resetgo'); await pg.wait_for_timeout(800)
        print('after reset', await pg.evaluate("JSON.stringify(Object.keys(window.__store))"), await pg.evaluate("JSON.stringify(window.__store['progress/settings'].lang)"))
        print(errs or 'no errors')
        await b.close()
asyncio.run(main())
