/* Daily Gambit — opening repertoire: explore, learn and drill lines by heart (spaced repetition).
   Optional extra outside the weekly schedule. Data: data/openings.json (tools/build_openings.py).
   Live "how often do masters play this" numbers come from the Lichess explorer, which needs the
   user's own Lichess token; it is kept only on this device (never in backups or the shared db). */

var OPD=null;                                         // repertoire data, loaded on first use
var OP_BOX=[0,1,3,7,14,30];                           // days until the next review, by box
var OP_SUSP=null;                                     // a schedule lesson put aside while doing openings
function loadOpenings(){
  if(OPD) return Promise.resolve(OPD);
  if(!loadOpenings.p) loadOpenings.p=fetch('data/openings.json').then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(d){ OPD=d; return d; }).catch(function(e){ loadOpenings.p=null; throw e; });
  return loadOpenings.p;
}
function opState(){ if(!S.op||typeof S.op!=='object') S.op={lines:{},xp:0}; if(!S.op.lines) S.op.lines={}; return S.op; }
function opRep(id){ return OPD&&OPD.reps.filter(function(r){return r.id===id})[0]; }
function opKey(rep,line){ return rep.id+'|'+line; }
function opTitle(rep){ return rep.title[LANG]||rep.title.en; }
function opNote(node){ return node&&node.note?(node.note[LANG]||node.note.en):''; }
function opStats(rep){
  var o=opState(), td=today(), s={total:rep.lines.length,seen:0,mastered:0,due:0};
  rep.lines.forEach(function(l){ var x=o.lines[opKey(rep,l)]; if(!x) return; s.seen++; if(x.b>=3) s.mastered++; if(x.due<=td) s.due++; });
  return s;
}
function opDue(rep){ var o=opState(), td=today(); return rep.lines.filter(function(l){ var x=o.lines[opKey(rep,l)]; return x&&x.due<=td; })
  .sort(function(a,b){ var x=o.lines[opKey(rep,a)], y=o.lines[opKey(rep,b)]; return x.due<y.due?-1:x.due>y.due?1:x.b-y.b; }); }
function opLearned(rep,line){ var o=opState(), k=opKey(rep,line); if(o.lines[k]) return; o.lines[k]={b:0,n:0,ok:0,due:today()}; o.xp=(+o.xp||0)+2; Store.saveSettings(); }
/* a drilled line: right first time moves it up a box (seen again later), a mistake sends it back to box 0 */
function opResult(rep,line,ok){
  var o=opState(), k=opKey(rep,line), x=o.lines[k]||{b:0,n:0,ok:0,due:today()}, wasDue=x.due<=today();
  x.n++; if(ok) x.ok++;
  if(wasDue){ x.b=ok?Math.min(OP_BOX.length-1,x.b+1):0; x.due=ymd(addDays(new Date(),ok?OP_BOX[x.b]:0)); }
  else if(!ok) x.b=Math.max(0,x.b-1);
  o.xp=(+o.xp||0)+(ok?(wasDue?3:1):0); x.last=today(); o.lines[k]=x; Store.saveSettings();
}
/* how a line looks in lists: the moves after the shared beginning, with move numbers */
function opPretty(line,from){
  var m=line.split(' '), out=[];
  for(var i=from||0;i<m.length;i++){ if(i%2===0) out.push((i/2+1)+'.'); else if(i===from) out.push(((i+1)/2)+'…'); out.push(ls(m[i])); }
  return out.join(' ');
}

/* ---------- Lichess explorer (masters), with the user's token ---------- */
var LI={cache:{}};
function liToken(){ return lsGet('dg_lichess_token')||''; }
function liStats(fen){
  var tok=liToken(); if(!tok) return Promise.resolve({err:'notoken'});
  var k=fen.split(' ').slice(0,4).join(' '); if(LI.cache[k]) return Promise.resolve(LI.cache[k]);
  var ctl=window.AbortController?new AbortController():null, tm=setTimeout(function(){ if(ctl) ctl.abort(); },9000);
  return fetch('https://explorer.lichess.ovh/masters?topGames=0&moves=12&fen='+encodeURIComponent(fen),{headers:{Authorization:'Bearer '+tok},signal:ctl?ctl.signal:undefined})
    .then(function(r){ clearTimeout(tm); if(r.status===401||r.status===403) return {err:'auth'}; if(r.status===429) return {err:'busy'}; if(!r.ok) return {err:'http'}; return r.json().then(function(d){ LI.cache[k]=d; return d; }); })
    .catch(function(){ clearTimeout(tm); return {err:'net'}; });
}
function liErr(e){ return e==='notoken'?t('Connect Lichess in the Openings tab to see how often masters play each move.'):e==='auth'?t('Lichess did not accept the token.'):e==='busy'?t('Lichess is busy — try again in a minute.'):t('Couldn’t reach Lichess. Are you online?'); }

/* ---------- the tab ---------- */
function vOpenings(){
  if(!OPD){ loadOpenings().then(function(){ if(location.hash==='#openings') render(); },function(){ toast(t('Couldn’t load the openings. Check your connection.')); }); return '<div class="card"><span class="spin"></span> '+t('Loading…')+'</div>'; }
  var h='<div class="card"><h2>📖 '+t('Openings')+'</h2><p class="sub">'+t('Learn a small repertoire by heart: first learn a line with the arrows, then drill it. Lines you know come back less often. Extra training — not part of the weekly plan.')+'</p></div>';
  OPD.reps.forEach(function(rep){
    var s=opStats(rep), pct=Math.round(s.seen/s.total*100);
    h+='<div class="card oprep"><div class="ophead"><span class="opic">'+rep.icon+'</span><div><h2>'+esc(opTitle(rep))+'</h2>'+
       '<div class="sub">'+t('{a} of {b} lines learned',{a:s.seen,b:s.total})+' · '+t('{n} mastered',{n:s.mastered})+'</div></div></div>'+
       '<div class="bar"><i style="width:'+pct+'%"></i></div>'+
       '<div class="btns">'+
       '<button class="btn play" data-act="opdrill" data-id="'+rep.id+'"'+(s.seen?'':' disabled')+'>🧠 '+t('Drill')+(s.due?' <span class="due">'+s.due+'</span>':'')+'</button>'+
       '<button class="btn" data-act="oplearn" data-id="'+rep.id+'"'+(s.seen<s.total?'':' disabled')+'>➕ '+t('Learn a new line')+'</button>'+
       '<button class="btn ghost" data-act="opexplore" data-id="'+rep.id+'">🔍 '+t('Explore')+'</button></div>'+
       '<details class="oplines"><summary>'+t('All lines')+'</summary>';
    var o=opState();
    rep.lines.forEach(function(l,i){
      var x=o.lines[opKey(rep,l)], nm=rep.nodes[l].name||'', dot=!x?'⚪':x.b>=3?'🟢':x.due<=today()?'🟠':'🟡';
      h+='<button class="opline" data-act="oplearn" data-id="'+rep.id+'" data-i="'+i+'"><span>'+dot+'</span><span><b>'+esc(nm.replace(/^[^:]*: /,'')||nm)+'</b><br><small>'+esc(opPretty(l))+'</small></span></button>';
    });
    h+='<p class="note">⚪ '+t('new')+' · 🟠 '+t('due today')+' · 🟡 '+t('learning')+' · 🟢 '+t('mastered')+'</p></details></div>';
  });
  var tok=liToken();
  h+='<div class="card"><h2>📊 '+t('Master statistics (Lichess)')+'</h2>';
  if(tok) h+='<p class="sub">✓ '+t('Connected. Explore shows how often masters play each move.')+' '+t('The token is kept only on this device.')+'</p><div class="btns"><button class="btn sm" data-act="litest">'+t('Test connection')+'</button><button class="btn ghost sm" data-act="lidel">'+t('Remove token')+'</button></div>';
  else h+='<p class="sub">'+t('Lichess needs a free account token for its opening explorer. Create one (no permissions needed), paste it here. It is kept only on this device.')+'</p>'+
     '<p><a href="https://lichess.org/account/oauth/token/create?description=Daily%20Gambit" target="_blank" rel="noopener">'+t('Create a Lichess token')+' ↗</a></p>'+
     '<form id="litoken" class="addprize"><input name="tok" type="password" autocomplete="off" placeholder="lip_…" required><button class="btn sm" type="submit">'+t('Save')+'</button></form>';
  return h+'</div>';
}
function openOpening(mode,repId,lineIdx){
  loadOpenings().then(function(){
    var rep=opRep(repId); if(!rep) return;
    if(L&&L.slot){ OP_SUSP=L; if(L.clock) L.clock.halt(); }       // keep a schedule lesson safe in the background
    if(L&&L.kind==='op') freeBoards(false);
    L=newLessonObj(OpeningLesson(mode,rep,lineIdx),'op'); L.init();
    if(location.hash==='#lesson') render(); else location.hash='lesson';
  },function(){ toast(t('Couldn’t load the openings. Check your connection.')); });
}
function closeOpening(){ location.hash='openings'; }
/* leaving an openings lesson brings back a schedule lesson that was put aside */
function opLeft(){ if(location.hash!=='#lesson'&&L&&L.kind==='op'){ freeBoards(false); L=OP_SUSP; OP_SUSP=null; } }

/* ---------- learn / drill / explore ---------- */
function OpeningLesson(mode,rep,lineIdx){
  var L={title:(mode==='learn'?t('Learn'):mode==='drill'?t('Drill'):t('Explore'))+' · '+opTitle(rep),home:'openings'};
  var side=rep.side, st={mode:mode,g:new Chess(),last:null,line:null,plies:[],i:0,status:'',msg:'',mcls:'info',marks:{},fails:0,
    queue:[],requeued:{},done:0,okN:0,mv:[],vi:null,stats:null,statsKey:''};
  function node(n){ return rep.nodes[st.plies.slice(0,n).join(' ')]; }
  function verbose(g,san){ var c=new Chess(g.fen()); return tryMove(c,san); }

  function startLine(line){
    st.line=line; st.plies=line.split(' '); st.i=0; st.fails=0; st.g=new Chess(); st.last=null; st.marks={}; st.missed=false; step();
  }
  function step(){
    if(st.i>=st.plies.length) return endLine();
    var n=node(st.i+1);
    if(!n.ours){
      st.status='auto'; st.marks={}; var me=st.line, i=st.i; lr();
      setTimeout(function(){ if(L.st!==st||st.line!==me||st.i!==i) return; st.last=tryMove(st.g,st.plies[st.i]); st.i++; step(); }, st.i===0?450:650);
      return;
    }
    st.status='move'; st.marks={};
    var exp=verbose(st.g,st.plies[st.i]), nm=node(st.i)&&node(st.i).name;
    if(st.mode==='learn'){ st.marks[exp.from]='hint'; st.marks[exp.to]='hint';
      st.msg=(opNote(n)?'💡 '+esc(opNote(n))+'<br>':'')+t('Play {m} — follow the arrow.',{m:'<b>'+esc(ls(exp.san))+'</b>'}); st.mcls='info'; }
    else { st.msg=t('Your move! What does our repertoire play here?'); st.mcls='info'; }
    lr();
  }
  function onMove(mv){
    if(st.status!=='move') return;
    var exp=verbose(st.g,st.plies[st.i]);
    if(mv.from===exp.from&&mv.to===exp.to&&(!exp.promotion||mv.promotion===exp.promotion)){
      var n=node(st.i+1); st.last=tryMove(st.g,st.plies[st.i]); st.i++; st.marks={};
      st.msg='✓ '+esc(ls(exp.san))+(st.mode==='drill'&&opNote(n)?' — '+esc(opNote(n)):''); st.mcls='ok'; st.status='auto'; lr();
      setTimeout(function(){ if(L.st===st) step(); }, st.mode==='drill'&&opNote(n)?1300:500);
    } else {
      if(st.mode==='drill'&&!st.missed){ st.missed=true; st.fails++; }
      st.marks={}; st.marks[exp.from]='hint'; st.marks[exp.to]='hint';
      st.msg=st.mode==='learn'?t('Not that one — follow the arrow.'):'✗ '+t('Our move here is {m}. Play it to continue.',{m:'<b>'+esc(ls(exp.san))+'</b>'})+(opNote(node(st.i+1))?'<br>💡 '+esc(opNote(node(st.i+1))):'');
      st.mcls='no'; lr();
    }
    st.missed=st.status==='move'&&st.missed;
  }
  function endLine(){
    var nm=rep.nodes[st.line].name||'';
    if(st.mode==='learn'){ opLearned(rep,st.line); st.status='done'; st.msg='🎉 '+t('Line learned!')+(nm?' <b>'+esc(nm)+'</b>':''); st.mcls='ok'; Sound.play('Victory'); lr(); return; }
    var ok=st.fails===0; opResult(rep,st.line,ok); st.done++; if(ok) st.okN++;
    if(!ok&&!st.requeued[st.line]){ st.requeued[st.line]=1; st.queue.push(st.line); }
    st.status='lineend'; st.msg=ok?'✓ '+t('Perfect line!')+' +3 XP':'↻ '+t('One mistake — this line comes back soon.'); st.mcls=ok?'ok':'no';
    if(ok) Sound.play('GenericNotify');
    lr();
    var me=st.line; setTimeout(function(){ if(L.st===st&&st.line===me&&st.status==='lineend') nextDrill(); }, 1400);
  }
  function nextDrill(){
    if(!st.queue.length){ st.status='summary'; st.line=null; lr(); return; }
    startLine(st.queue.shift());
  }

  /* explore: free board inside (and outside) the repertoire, with master statistics */
  function exPath(n){ return st.mv.slice(0,n).join(' '); }
  function exShown(){ return st.vi==null?st.mv.length:st.vi; }
  function exGame(n){ var g=new Chess(), last=null; for(var i=0;i<n;i++) last=tryMove(g,st.mv[i]); return {g:g,last:last}; }
  function exPlay(san){
    var n=exShown(), g=exGame(n).g, m=tryMove(g,san); if(!m) return;
    st.mv=st.mv.slice(0,n).concat([m.san]); st.vi=null; lr(); exFetch();
  }
  function exFetch(){
    var g=exGame(exShown()).g, k=g.fen(); if(st.statsKey===k) return; st.statsKey=k; st.stats={loading:true};
    liStats(k).then(function(d){ if(st.statsKey!==k||L.st!==st) return; st.stats=d; lr(); });
  }
  function exView(){
    var n=exShown(), path=exPath(n), inTree=rep.nodes.hasOwnProperty(path), nd=rep.nodes[path], gg=exGame(n).g, h='';
    var nm=nd&&nd.name?nd.name:(st.stats&&st.stats.opening?st.stats.opening.name:'');
    h+='<div class="lbar"><span class="pill">'+(nm?esc(nm):t('Starting position'))+'</span></div>';
    h+='<div id="opb"></div>';
    var cur=n, br=st.vi!=null, dis=function(c){ return c?' disabled':''; };
    h+='<div class="mnav"><button class="btn ghost sm" data-l="nav" data-v="first"'+dis(cur<=0)+'>⏮</button><button class="btn ghost sm" data-l="nav" data-v="prev"'+dis(cur<=0)+'>◀</button>'+
       '<span class="mpos'+(br?' on':'')+'">'+(cur?esc(Math.ceil(cur/2)+(cur%2?'. ':'… ')+ls(st.mv[cur-1])):esc(t('Starting position')))+'</span>'+
       '<button class="btn ghost sm" data-l="nav" data-v="next"'+dis(cur>=st.mv.length)+'>▶</button><button class="btn ghost sm'+(br?' hot':'')+'" data-l="nav" data-v="last"'+dis(cur>=st.mv.length)+'>⏭</button></div>';
    h+='<div class="card opstats"><h3>📊 '+t('Masters played')+'</h3>';
    var d=st.stats;
    if(!d||d.loading) h+='<p class="sub"><span class="spin"></span> '+t('Loading…')+'</p>';
    else if(d.err) h+='<p class="sub">'+esc(liErr(d.err))+'</p>';
    else {
      var tot=(d.white||0)+(d.draws||0)+(d.black||0);
      if(!d.moves||!d.moves.length) h+='<p class="sub">'+t('No master games from here.')+'</p>';
      (d.moves||[]).slice(0,8).forEach(function(m){
        var n2=m.white+m.draws+m.black, pc=tot?Math.round(n2/tot*100):0, w=n2?m.white/n2*100:0, dr=n2?m.draws/n2*100:0;
        var inRep=inTree&&(nd.ch||[]).indexOf(m.san)>=0;
        h+='<button class="strow'+(inRep?' rep':'')+'" data-l="exmove" data-v="'+esc(m.san)+'"><b>'+esc(ls(m.san))+(inRep?' ⭐':'')+'</b><span class="pc">'+pc+'%</span>'+
           '<span class="wdl" title="'+t('White wins / draws / Black wins')+'"><i class="w" style="width:'+w.toFixed(1)+'%"></i><i class="d" style="width:'+dr.toFixed(1)+'%"></i><i class="b"></i></span><small>'+n2.toLocaleString(LOCALES[LANG])+'</small></button>';
      });
    }
    h+='</div>';
    if(inTree){
      if(nd.note&&nd.ours) h+='<div class="msg info">💡 '+esc(opNote(nd))+'</div>';
      var ch=nd.ch||[];
      if(ch.length){
        var oursNext=(gg.turn()==='w')===(side==='w');
        h+='<div class="card opnext"><h3>'+(oursNext?'⭐ '+t('Our move'):t('Their replies we know'))+'</h3>';
        ch.forEach(function(san){ var cn=rep.nodes[path?path+' '+san:san]; h+='<button class="opmove'+(cn.ours?' ours':'')+'" data-l="exmove" data-v="'+esc(san)+'"><b>'+esc(ls(san))+'</b><span>'+esc(cn.ours&&opNote(cn)?opNote(cn):(cn.name||''))+'</span></button>'; });
        h+='</div>';
      } else h+='<div class="msg ok">🏁 '+t('End of our line here. From now on: develop, castle, make a plan!')+'</div>';
    } else {
      h+='<div class="msg no">🧭 '+t('This position is outside our repertoire.')+' <button class="btn sm" data-l="totree">'+t('Back to our moves')+'</button></div>';
    }
    return h;
  }

  L.st=st;
  L.view=function(){
    if(st.mode==='explore') return exView();
    var h='';
    if(st.status==='none') return '<div class="card"><h2>🎉 '+t('All lines learned!')+'</h2><p class="sub">'+t('Now drill them so they stick.')+'</p><button class="btn play" data-l="todrill">🧠 '+t('Drill')+'</button></div>';
    if(st.status==='summary') return '<div class="card"><h2>🧠 '+t('Drill finished')+'</h2><p>'+t('{a} of {b} lines perfect.',{a:st.okN,b:st.done})+'</p>'+
      '<div class="btns"><button class="btn play" data-l="again">'+t('Practise more')+'</button><button class="btn ghost" data-l="home">'+t('Back to openings')+'</button></div></div>';
    var nm=(node(st.i)&&node(st.i).name)||'';
    h+='<div class="lbar"><span class="pill">'+(nm?esc(nm):t('Starting position'))+'</span>'+(st.mode==='drill'?'<span class="pill">'+t('Line {a} · {b} left',{a:st.done+1,b:st.queue.length})+'</span>':'')+'</div>';
    h+='<div id="opb"></div><div class="msg '+st.mcls+'">'+st.msg+'</div>';
    if(st.status==='move'&&st.mode==='drill') h+='<button class="btn ghost sm" data-l="hint">💡 '+t('Show the move')+'</button>';
    if(st.status==='done') h+='<div class="btns"><button class="btn play" data-l="next">➕ '+t('Learn the next line')+'</button><button class="btn" data-l="todrill">🧠 '+t('Drill')+'</button><button class="btn ghost" data-l="home">'+t('Back to openings')+'</button></div>';
    h+='<div class="mlist">'+(st.i?esc(opPretty(st.plies.slice(0,st.i).join(' '))):'—')+'</div>';
    return h;
  };
  L.mount=function(c){
    var e=$('#opb',c); if(!e) return;
    if(st.mode==='explore'){
      var x=exGame(exShown()), b=boardFor(e,{flip:side==='b',movable:'both',onMove:function(mv){
        var g=exGame(exShown()).g, m=tryMove(g,{from:mv.from,to:mv.to,promotion:mv.promotion||'q'}); if(m) exPlay(m.san); else lr(); }});
      var path=exPath(exShown()), nd=rep.nodes[path], arrows=[];
      if(nd&&nd.ch) nd.ch.forEach(function(san){ var cn=rep.nodes[path?path+' '+san:san], m=verbose(x.g,san); if(m&&cn.ours) arrows.push({orig:m.from,dest:m.to,brush:'green'}); });   // only our move: many reply arrows would clutter the board
      b.marks={}; b.arrows=arrows; b.set(x.g,x.last); return;
    }
    var bb=boardFor(e,{flip:side==='b',movable:st.status==='move'?side:null,onMove:onMove}); bb.arrows=[]; bb.marks=st.marks; bb.set(st.g,st.last);
  };
  L.active=function(){ return st.mode==='explore'||st.status==='move'||st.status==='auto'; };
  L.finish=function(){ closeOpening(); return true; };
  L.key=function(k){
    if(st.mode!=='explore') return false;
    var cur=exShown(), go=function(n){ n=Math.max(0,Math.min(st.mv.length,n)); st.vi=n>=st.mv.length?null:n; lr(); exFetch(); };
    if(k==='ArrowLeft') go(cur-1); else if(k==='ArrowRight') go(cur+1); else if(k==='ArrowUp'||k==='Home') go(0); else if(k==='ArrowDown'||k==='End') go(st.mv.length); else return false;
    return true;
  };
  L.act=function(a,el){
    var v=el&&el.getAttribute('data-v');
    if(a==='exmove') exPlay(v);
    else if(a==='nav') L.key(v==='first'?'Home':v==='prev'?'ArrowLeft':v==='next'?'ArrowRight':'End');
    else if(a==='totree'){ var n=st.mv.length; while(n>0&&!rep.nodes.hasOwnProperty(exPath(n))) n--; st.mv=st.mv.slice(0,n); st.vi=null; lr(); exFetch(); }
    else if(a==='hint'){ if(st.status!=='move') return; if(!st.missed){ st.missed=true; st.fails++; } var exp=verbose(st.g,st.plies[st.i]); st.marks={}; st.marks[exp.from]='hint'; st.marks[exp.to]='hint'; st.msg=t('Our move here is {m}. Play it to continue.',{m:'<b>'+esc(ls(exp.san))+'</b>'}); st.mcls='no'; lr(); }
    else if(a==='next'){ var nx=nextNew(); if(nx) startLine(nx); else { st.status='none'; lr(); } }
    else if(a==='todrill') openOpening('drill',rep.id);
    else if(a==='again'){ st.queue=practice(); st.done=st.okN=0; st.requeued={}; nextDrill(); }
    else if(a==='home') closeOpening();
  };
  function nextNew(){ var o=opState(); return rep.lines.filter(function(l){ return !o.lines[opKey(rep,l)]; })[0]; }
  function practice(){ var o=opState(); return rep.lines.filter(function(l){ return o.lines[opKey(rep,l)]; }).sort(function(){ return Math.random()-.5; }).slice(0,8); }

  L.init=function(){
    if(mode==='explore'){ st.status='explore'; exFetch(); }
    else if(mode==='learn'){ var ln=lineIdx!=null?rep.lines[lineIdx]:nextNew(); if(ln) startLine(ln); else st.status='none'; }
    else { st.queue=opDue(rep); if(!st.queue.length) st.queue=practice(); if(st.queue.length) startLine(st.queue.shift()); else st.status='none'; }
  };
  return L;
}
