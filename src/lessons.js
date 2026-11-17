/* Daily Gambit — lessons */

var L=null;                                  // the active lesson
var PEND=lsGet(K('pend'))||{};             // lesson results waiting to be logged, by slot
function setPend(slot,o){
  var cur=PEND[slot]||{};
  var parts=(cur.parts||[]).slice();
  (o.parts||[]).forEach(function(v,i){ parts[i]=!!(parts[i]||v); });
  var extra=Object.assign({},cur.extra||{},o.extra||{});
  PEND[slot]=Object.assign({},cur,o,{parts:parts,extra:extra,lesson:true,at:Date.now()});
  if(cur.min && o.min && o.addMin) PEND[slot].min=cur.min+o.min;
  delete PEND[slot].addMin;
  lsSet(K('pend'),PEND);
}
function clearPend(slot){ delete PEND[slot]; lsSet(K('pend'),PEND); }
function setL(x){ L=x; }
function freeBoards(all){ Object.keys(BOARDS).forEach(function(k){ var b=BOARDS[k]; if(!b.cg) return; if(all){ try{ b.cg.destroy(); }catch(e){} delete BOARDS[k]; } else b.cg.setAutoShapes([]); }); }
function switchLesson(slot,kind){ freeBoards(true); if(L&&L.clock) L.clock.halt(); var x={coord:CoordLesson,wood:WoodLesson}[kind](slot); L=newLessonObj(x,kind); render(); driveClock(); }
function inLesson(){ return location.hash==='#lesson' && !!L; }
function lr(){ var c=document.getElementById('lesson'); if(!c||!L) return; freeBoards(false); c.innerHTML=L.view(); if(L.mount) L.mount(c); splitLayout(c); driveClock(); }
/* Group the lesson around its board: what came before it, the board, and what follows.
   CSS stacks the three on phones and puts the text and buttons beside the board on wider screens. */
function splitLayout(c){
  var box=c.querySelector('.cgbox'); if(!box) return;
  var host=box; while(host.parentNode&&host.parentNode!==c) host=host.parentNode;
  if(host.parentNode!==c) return;
  var kids=[].slice.call(c.childNodes), i=kids.indexOf(host);
  var wrap=document.createElement('div'); wrap.className='lsplit';
  var pre=document.createElement('div'); pre.className='lpre';
  var bd=document.createElement('div'); bd.className='lboard';
  var side=document.createElement('div'); side.className='lside';
  kids.forEach(function(n,j){ (j<i?pre:j===i?bd:side).appendChild(n); });
  if(pre.childNodes.length) wrap.appendChild(pre);
  wrap.appendChild(bd); wrap.appendChild(side); c.appendChild(wrap);
}
function openLesson(slot,kind){
  freeBoards(true);
  var make={wood:WoodLesson,coord:CoordLesson,endgame:EndgameLesson,guess:GuessLesson,friday:FridayLesson,weekend:WeekendLesson}[kind||SL[slot].lesson];
  var root=document.getElementById('root');
  root.innerHTML='<div class="wrap"><div class="card"><span class="spin"></span> '+t('Loading lesson…')+'</div></div>';
  loadData().then(function(){ L=newLessonObj(make(slot),kind||SL[slot].lesson); if(location.hash==='#lesson') render(); else location.hash='lesson'; driveClock(); })
    .catch(function(){ toast(t('Could not load the lesson files. Check your connection.')); location.hash='today'; render(); });
}
function finishLesson(slot,o){ freeBoards(true); if(L&&L.clock) L.clock.halt(); setPend(slot,o); draft.slot=slot; L=null; location.hash='today'; autoLog(slot); }
function engineError(fen){
  return '<div class="msg no">'+t('Stockfish couldn’t start on this device.')+' '+(fen?'<a href="https://lichess.org/analysis/standard/'+encodeURI(fen.replace(/ /g,'_'))+'" target="_blank" rel="noopener">'+t('Open this position on Lichess')+'</a>':'')+'</div>';
}
function elapsedMin(t0){ return Math.max(1,Math.round((Date.now()-t0)/60000)); }
/* Exercise clock: runs only while the child is actually doing an exercise (see driveClock). */
function Clock(){ this.ms=0; this.since=0; }
Clock.prototype.run=function(){ if(!this.since) this.since=Date.now(); };
Clock.prototype.halt=function(){ if(this.since){ this.ms+=Date.now()-this.since; this.since=0; } };
Clock.prototype.set=function(on){ if(on) this.run(); else this.halt(); };
Clock.prototype.secs=function(){ return (this.ms+(this.since?Date.now()-this.since:0))/1000; };
Clock.prototype.min=function(){ return Math.max(1,Math.round(this.secs()/60)); };
function driveClock(){
  if(!L||!L.clock) return;
  var on=inLesson()&&!L.paused&&!document.hidden&&(!L.active||!!L.active());
  L.clock.set(on); L.isOn=on;
  if(L.onClock) L.onClock(on);
  var e=document.querySelector('[data-clock="active"]'); if(e) e.textContent=mmss(L.clock.secs());
}
function newLessonObj(x,kind){ x.kind=kind; x.t0=Date.now(); x.clock=new Clock(); x.paused=false; return x; }
function sideName(c){ return c==='w'?t('White'):t('Black'); }

/* ===================== WOODPECKER ===================== */
function thuBatch(){
  var mons=S.sessions.filter(function(s){return s.slot==='mon'&&!s.excused&&s.wp&&s.wp.items&&s.wp.items.length}).sort(function(a,b){return a.date<b.date?1:-1});
  if(!mons.length) return null;
  var w=wkOf(mons[0].date), same=mons.filter(function(s){return wkOf(s.date)===w});
  var items=[]; same.reverse().forEach(function(s){ items=items.concat(s.wp.items); });
  return {date:fmtDate(same[same.length-1].date),items:items,set:same[0].wp.set||S.wpSet};
}
function WoodLesson(slot){
  var L={slot:slot,title:slot==='mon'?t('Woodpecker Tactics'):t('Woodpecker Speed Run')};
  var GOAL=slot==='mon'?24*60:22*60;
  var setName=S.wpSet, queue=[], target={}, batch=null;
  if(slot==='mon'){ for(var i=S.wpPos;i<DATA.pz.wood[setName].length;i++) queue.push(i); }
  else { batch=thuBatch(); if(batch){ setName=batch.set; batch.items.forEach(function(x){ queue.push(x[0]); target[x[0]]=x[2]; }); } }
  var set=DATA.pz.wood[setName];
  var st={phase:'intro',qi:0,ri:0,results:[],failed:[],retried:{},rq:[],cur:null,msg:'',mcls:'',cbShown:false,cb:false,stopped:false,solve:new Clock()};
  function solveSecs(){ return st.solve.secs(); }
  function acc(){ var n=st.results.length; return n?Math.round(st.results.filter(function(r){return r.ok}).length/n*100):null; }
  function startPuzzle(idx,retry){
    var p=set[idx], g=new Chess(p[1]), moves=p[2].split(' ');
    st.cur={idx:idx,g:g,moves:moves,step:0,kid:g.turn()==='w'?'b':'w',status:'wait',last:null,retry:!!retry,t0:0,p:p,clock:new Clock()};
    st.msg=retry?t('Retry: picture the whole line first.'):t('Watch the opponent’s move…'); st.mcls='info';
    lr();
    var cur=st.cur;
    setTimeout(function(){ if(st.cur!==cur) return; var m=tryMove(g,moveFromUci(moves[0])); cur.last=m; cur.step=1;
      if(retry){ cur.status='viz'; st.msg=t('Find the full solution in your head. Tap “Ready” when you see it.'); }
      else { cur.status='play'; cur.t0=Date.now(); driveClock(); st.msg=t('{side} to move — find the best move!',{side:sideName(cur.kid)}); }
      st.mcls='info'; lr(); },650);
  }
  function recorded(idx){ return st.results.some(function(r){return r.idx===idx}); }
  function record(ok){
    var c=st.cur; if(c.retry) return;
    c.clock.halt(); var secs=c.clock.secs();
    st.results.push({idx:c.idx,ok:ok?1:0,secs:secs});
    if(!ok) st.failed.push(c.idx);
    var a=acc();
    if(!st.cbShown && st.results.length>=8 && a<70){ st.cbShown=true; st.cb=true; }
  }
  function playRest(c,done){
    if(c.step>=c.moves.length){ done(); return; }
    setTimeout(function(){ if(st.cur!==c) return; var m=tryMove(c.g,moveFromUci(c.moves[c.step])); c.last=m; c.step++; lr(); playRest(c,done); },750);
  }
  function solLine(c){
    var g=new Chess(c.p[1]), out=[];
    c.moves.forEach(function(u,i){ var m=tryMove(g,moveFromUci(u)); if(m&&i>0) out.push(m.san); });
    return ls(out.join(' '));
  }
  function replay(){
    var c=st.cur; if(!c||c.replaying) return;
    c.g=new Chess(c.p[1]); c.step=0; c.last=null; c.bad=null; c.replaying=true;
    st.msg='↻ '+t('Watch the whole sequence again…'); st.mcls='info'; lr();
    setTimeout(function(){ if(st.cur!==c) return; playRest(c,function(){ c.replaying=false; st.msg=t('Solution:')+' <b>'+solLine(c)+'</b>. '+t('Remember the pattern!'); st.mcls='no'; lr(); }); },700);
  }
  function onMove(m){
    var c=st.cur; if(!c||c.status!=='play') return;
    var exp=c.moves[c.step], u=uciOf(m), ok=(u===exp)||(exp.length===5&&u+'q'===exp&&!m.promotion);
    if(!ok){ var tt=new Chess(c.g.fen()); var tm=tryMove(tt,m); if(tm&&tt.isCheckmate()) ok=true; }
    if(ok){
      var mv=tryMove(c.g,m); c.last=mv; c.step++;
      if(c.step>=c.moves.length||c.g.isCheckmate()){
        c.status='ok'; record(true);
        var last=st.results[st.results.length-1];
        st.msg='✓ '+(c.retry?t('Solved!'):t('Solved in {s}s',{s:Math.round(last.secs)}))+(target[c.idx]&&!c.retry&&last.secs<=target[c.idx]/1.5?' ⚡ '+t('1.5× faster than Monday!'):''); st.mcls='ok'; lr();
        setTimeout(function(){ if(st.cur===c&&!st.cb) next(); },1100);
      } else { c.status='wait'; lr(); setTimeout(function(){ if(st.cur!==c) return; var r=tryMove(c.g,moveFromUci(c.moves[c.step])); c.last=r; c.step++; c.status='play'; st.msg=t('Good! Keep going…'); st.mcls='info'; lr(); },450); }
    } else {
      c.status='fail'; record(false);
      var t2=new Chess(c.g.fen()), sol=tryMove(t2,moveFromUci(exp));
      st.msg='✗ '+t('Not this time. The answer was {m}. Watch the solution…',{m:sol?ls(sol.san):exp}); st.mcls='no';
      c.bad={}; c.bad[m.from]='bad'; c.bad[m.to]='bad'; c.replaying=true; lr();
      setTimeout(function(){ c.bad=null; playRest(c,function(){ c.replaying=false; c.shown=true; st.msg=t('Solution:')+' <b>'+solLine(c)+'</b>. '+t('Remember the pattern!'); lr(); }); },900);
    }
  }
  function next(){
    if(st.phase==='solve'){ st.qi++; if(st.qi>=queue.length){ finishSolve(); return; } startPuzzle(queue[st.qi]); }
    else if(st.phase==='retry'){ st.ri++; if(st.ri>=st.rq.length){ st.phase='done'; st.cur=null; lr(); return; } startPuzzle(st.rq[st.ri],true); }
  }
  function finishSolve(){
    st.rq=st.failed.filter(function(i){return !st.retried[i]});
    st.rq.forEach(function(i){ st.retried[i]=true; });
    if(st.rq.length){ st.phase='retry'; st.ri=0; startPuzzle(st.rq[0],true); }
    else { st.phase='done'; st.cur=null; lr(); }
  }
  function nextIndex(){ var q=st.qi; if(q<queue.length&&recorded(queue[q])) q++; return q; }
  function canKeep(){ return !st.stopped && nextIndex()<queue.length; }
  function keepSolving(){
    var q=nextIndex(); if(q>=queue.length){ toast(t('No more puzzles in this set.')); return; }
    st.qi=q; st.phase='solve'; st.cur=null; startPuzzle(queue[q]);
  }
  L.view=function(){
    var h='';
    if(st.phase==='intro'){
      if(slot==='thu'&&!batch) return '<div class="card"><h2>'+t('No Monday set yet')+'</h2><p class="sub">'+t('Thursday re-solves the exact puzzles from Monday. Do a Monday lesson first — you can still do today’s coordinates quiz.')+'</p><button class="btn play" data-l="coord">'+t('Coordinates quiz')+' →</button></div>';
      h+='<div class="card"><h2>'+(slot==='mon'?'🐦 '+t('Round {n}',{n:S.wpCycle})+' · '+t(setName==='easy'?'Easy':setName==='medium'?'Medium':'Hard'):'⚡ '+t('Speed run: {n} puzzles from {d}',{n:queue.length,d:batch.date}))+'</h2>';
      if(slot==='mon') h+='<div class="prog"><i style="width:'+Math.round(S.wpPos/set.length*100)+'%"></i></div><p class="sub">'+t('Next puzzle: #{a} of {b}. Goal: about 20 puzzles in 24 minutes (~1 minute each). Then 6 minutes retrying the ones you missed.',{a:S.wpPos+1,b:set.length})+'</p>';
      else h+='<p class="sub">'+t('Same puzzles as Monday. Target: 1.5× faster — each puzzle shows its Monday time ÷ 1.5. Then an 8-minute coordinates quiz.')+'</p>';
      h+='<div class="hint">🛑 '+t('If accuracy drops below 70%, the app will tell you to stop. Stopping is the smart move.')+'</div>';
      h+='<button class="btn play" data-l="start">'+t('Start puzzles')+'</button></div>';
      return h;
    }
    var keep=canKeep()?'<button class="btn ghost" style="width:100%;margin-top:8px" data-l="keep">↩ '+t('Keep solving')+'</button>':'';
    if(st.phase==='done'){
      var n=st.results.length, ok=st.results.filter(function(r){return r.ok}).length, secs=st.results.reduce(function(a,r){return a+r.secs},0);
      h+='<div class="card"><h2>'+(st.stopped?'🦦 '+t('Wise stop!'):'🎉 '+t('Session complete!'))+'</h2><div class="stats"><div class="stat"><b>'+ok+'/'+n+'</b><span>'+t('solved')+'</span></div><div class="stat"><b>'+(n?Math.round(ok/n*100):0)+'%</b><span>'+t('accuracy')+'</span></div><div class="stat"><b>'+(n?Math.round(secs/n):0)+'s</b><span>'+t('per puzzle')+'</span></div></div>';
      if(slot==='thu'&&n){ var mon=0,thu=0; st.results.forEach(function(r){ if(target[r.idx]){mon+=target[r.idx];thu+=r.secs;} }); if(thu) h+='<div class="hint">'+t('Speed vs Monday:')+' <b>'+(mon/thu).toFixed(2)+'×</b> '+(mon/thu>=1.5?'⚡ '+t('Target reached!'):t('(target 1.5×)'))+'</div>'; }
      if(slot==='mon'&&S.wpPos+n>=set.length) h+='<div class="hint">🐦 '+t('You reached the end of the 200-puzzle set — round {n} is complete when you log this!',{n:S.wpCycle})+'</div>';
      h+='<button class="btn go" data-l="log">'+t('Log this session')+' →</button>'+keep;
      if(slot==='thu') h+='<button class="btn play" style="margin-top:8px" data-l="coord">'+t('Next: coordinates quiz')+' →</button>';
      return h+'</div>';
    }
    var c2=st.cur, a=acc(), el=solveSecs();
    h+='<div class="lbar"><span class="pill">'+(st.phase==='retry'?t('Retry {a}/{b}',{a:st.ri+1,b:st.rq.length}):'#'+(c2?c2.idx+1:'')+' · '+t('{n} done',{n:st.results.length}))+'</span>';
    if(st.phase==='solve') h+='<span class="pill '+(a==null?'':a>=90?'g':a>=70?'y':'r')+'">'+(a==null?'—':a+'%')+'</span><span class="pill" data-clock="solve">'+mmss(el)+' / '+mmss(GOAL)+'</span>';
    if(c2&&target[c2.idx]&&!c2.retry) h+='<span class="pill y">⚡ '+t('target {s}s',{s:Math.round(target[c2.idx]/1.5)})+'</span>';
    if(c2&&c2.status==='play'&&!c2.retry) h+='<span class="pill" data-clock="puz">0s</span>';
    h+='</div>';
    if(st.phase==='solve'&&el>=GOAL) h+='<div class="msg info">⏰ '+t('Time is up! Finish this puzzle, then tap “Finish solving”.')+'</div>';
    h+='<div id="wb"></div><div class="msg '+st.mcls+'">'+st.msg+'</div>';
    if(c2&&c2.status==='viz') h+='<button class="btn play" data-l="ready">'+t('Ready — I see it!')+'</button>';
    if(c2&&c2.status==='fail') h+='<div class="btns" style="margin-top:0">'+(c2.shown?'<button class="btn ghost" data-l="replay"'+(c2.replaying?' disabled':'')+'>↻ '+t('Show solution again')+'</button>':'')+'<button class="btn play" style="margin-bottom:0" data-l="next">'+t('Next puzzle')+' →</button></div>';
    if(c2&&c2.status==='ok'&&c2.retry) h+='<button class="btn play" data-l="next">'+t('Next')+' →</button>';
    h+='<div class="btns">';
    if(st.phase==='solve') h+='<button class="btn ghost sm" data-l="endsolve">'+(st.failed.some(function(i){return !st.retried[i]})?t('Finish solving → retry misses'):t('Finish solving'))+'</button>';
    if(st.phase==='retry') h+='<button class="btn ghost sm" data-l="skipretry">'+t('Finish retries')+'</button>';
    h+='</div>';
    if(st.phase==='retry') h+=keep;
    if(st.cb) h+='<div class="overlay"><div class="card"><div class="mascot-sm">'+MASCOT+'</div><h2>🛑 '+t('Circuit break!')+'</h2><p>'+t('Accuracy is {a}% — below 70%. Your brain needs a rest. Focused calculation beats tired volume.',{a:a})+'</p><button class="btn go" data-l="cbstop">'+t('Stop now (+30 XP Wise Stop 🦦)')+'</button><button class="btn ghost sm" style="margin-top:8px" data-l="cbgo">'+t('It was a mis-tap, continue')+'</button></div></div>';
    return h;
  };
  L.mount=function(c){
    var w=$('#wb',c); if(!w||!st.cur) return;
    var board=boardFor(w,{flip:st.cur.kid==='b',movable:st.cur.status==='play'?st.cur.kid:null,onMove:onMove});
    board.marks=st.cur.bad||{}; board.set(st.cur.g,st.cur.last);
  };
  L.tick=function(){
    var e=$('[data-clock="solve"]'); if(e) e.textContent=mmss(solveSecs())+' / '+mmss(GOAL);
    var p=$('[data-clock="puz"]'); if(p&&st.cur) p.textContent=Math.round(st.cur.clock.secs())+'s';
  };
  L.act=function(a){
    if(a==='start'){ st.phase='solve'; st.qi=0; if(!queue.length){ st.phase='done'; lr(); return; } startPuzzle(queue[0]); }
    else if(a==='next') next();
    else if(a==='replay') replay();
    else if(a==='ready'){ st.cur.status='play'; st.msg=t('Now play it!'); st.mcls='info'; lr(); }
    else if(a==='endsolve') finishSolve();
    else if(a==='skipretry'){ st.phase='done'; st.cur=null; lr(); }
    else if(a==='keep') keepSolving();
    else if(a==='cbstop'){ st.cb=false; st.stopped=true; st.phase='done'; st.cur=null; lr(); }
    else if(a==='cbgo'){ st.cb=false; lr(); if(st.cur&&st.cur.status==='ok') next(); }
    else if(a==='coord'){ if(st.results.length) logIt(true); switchLesson('thu','coord'); }
    else if(a==='log'){ logIt(false); }
  };
  function logIt(stay){
    var n=st.results.length, ok=st.results.filter(function(r){return r.ok}).length;
    var solveMin=Math.max(1,Math.round(solveSecs()/60));
    var o={n:n,ok:ok,wmin:solveMin,min:L.clock.min(),stopped:st.stopped,
      parts:slot==='mon'?[n>=15,st.failed.length>0&&st.failed.every(function(i){return st.retried[i]})&&st.phase==='done'||(st.failed.length===0&&n>0)]:[n>0&&n>=queue.length*0.8],
      extra:{items:st.results.map(function(r){return [r.idx,r.ok,Math.round(r.secs)]}),set:setName}};
    if(stay){ setPend(slot,o); return; }
    finishLesson(slot,o);
  }
  L.active=function(){ return (st.phase==='solve'||st.phase==='retry')&&!st.cb; };
  L.onClock=function(on){ st.solve.set(on&&st.phase==='solve'); if(st.cur) st.cur.clock.set(on&&st.cur.status==='play'&&!st.cur.retry); };
  L.finish=function(){ logIt(false); return true; };
  return L;
}

/* ===================== COORDINATES QUIZ ===================== */
function knightPath(a,b){
  var idx=function(s){return [FILES.indexOf(s[0]),+s[1]-1]}, name=function(f,r){return FILES[f]+(r+1)};
  var D=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]], prev={}, q=[a]; prev[a]=null;
  while(q.length){ var s=q.shift(); if(s===b) break; var p=idx(s); D.forEach(function(d){ var f=p[0]+d[0], r=p[1]+d[1]; if(f<0||f>7||r<0||r>7) return; var n=name(f,r); if(!(n in prev)){ prev[n]=s; q.push(n);} }); }
  var path=[], cur=b; while(cur){ path.unshift(cur); cur=prev[cur]; } return path;
}
function rndSq(){ return FILES[Math.floor(Math.random()*8)]+(1+Math.floor(Math.random()*8)); }
function CoordLesson(slot){
  var L={slot:slot,title:t('Coordinates Quiz')};
  var LIMIT=8*60;
  var st={phase:'intro',n:0,ok:0,q:null,ans:null,flip:false};
  var TYPES=['tap','tap','name','color','color','knight'];
  function newQ(){
    if((st.n%5)===0) st.flip=Math.random()<0.5;
    var ty=TYPES[Math.floor(Math.random()*TYPES.length)], q={t:ty,sq:rndSq()};
    if(ty==='name'){ var o=[q.sq]; while(o.length<4){ var s=rndSq(); if(o.indexOf(s)<0) o.push(s);} q.opts=shuffle(o); }
    if(ty==='knight'){ var b; do{ b=rndSq(); q.path=knightPath(q.sq,b);}while(q.path.length<3||q.path.length>6); q.to=b; q.k=q.path.length-1; q.opts=[1,2,3,4,5,6]; }
    st.q=q; st.ans=null; lr();
  }
  function answer(right,shown){
    st.n++; if(right) st.ok++; st.ans={right:right,shown:shown}; lr();
    setTimeout(function(){ if(st.phase==='quiz'&&st.ans) newQ(); }, st.q.t==='knight'?2200:(right?650:1600));
  }
  function used(){ return L.clock.secs(); }
  function stop(){ st.phase='done'; st.ans=null; lr(); }
  function isDark(sq){ return (FILES.indexOf(sq[0])+(+sq[1]))%2===1; }
  L.view=function(){
    if(st.phase==='intro') return '<div class="card"><h2>⚡ '+t('Rapid-fire coordinates')+'</h2><p class="sub">'+t('8 minutes of quick questions: tap a square, name a square, light or dark, and knight routes. Speed and accuracy both count!')+'</p><button class="btn play" data-l="start">'+t('Start quiz')+'</button></div>';
    if(st.phase==='done') return '<div class="card"><h2>🎉 '+t('Quiz done!')+'</h2><div class="stats"><div class="stat"><b>'+st.ok+'/'+st.n+'</b><span>'+t('correct')+'</span></div><div class="stat"><b>'+(st.n?Math.round(st.ok/st.n*100):0)+'%</b><span>'+t('accuracy')+'</span></div><div class="stat"><b>'+mmss(used())+'</b><span>'+t('time')+'</span></div></div><button class="btn go" data-l="log">'+t('Log Thursday session')+' →</button>'+(used()<LIMIT?'<button class="btn ghost" style="width:100%;margin-top:8px" data-l="resume">↩ '+t('Keep going')+'</button>':'')+'</div>';
    var q=st.q, h='<div class="lbar"><span class="pill">'+st.ok+'/'+st.n+'</span><span class="pill" data-clock="q">'+mmss(used())+' / '+mmss(LIMIT)+'</span><span class="pill">'+(st.flip?t('Black’s view'):t('White’s view'))+'</span></div>';
    var prompt={tap:t('Tap')+' <b>'+q.sq+'</b>',name:t('Which square is highlighted?'),color:t('Is {sq} light or dark?',{sq:'<b>'+q.sq+'</b>'}),knight:t('Knight from {a} to {b}: fewest moves?',{a:'<b>'+q.sq+'</b>',b:'<b>'+q.to+'</b>'})}[q.t];
    h+='<div class="msg big '+(st.ans?(st.ans.right?'ok':'no'):'info')+'">'+(st.ans?(st.ans.right?'✓ '+t('Yes!'):'✗ '+st.ans.shown):prompt)+'</div>';
    if(q.t!=='color') h+='<div id="cb8"></div>';
    if(q.t==='name') h+='<div class="opts">'+q.opts.map(function(o){return '<button class="opt'+(st.ans&&o===q.sq?' right':'')+'" data-l="pick" data-v="'+o+'">'+o+'</button>'}).join('')+'</div>';
    if(q.t==='color') h+='<div class="opts"><button class="opt" style="background:var(--light)" data-l="pick" data-v="light">'+t('Light')+'</button><button class="opt" style="background:var(--dark);color:#fff" data-l="pick" data-v="dark">'+t('Dark')+'</button></div>';
    if(q.t==='knight') h+='<div class="opts" style="grid-template-columns:repeat(6,1fr)">'+q.opts.map(function(o){return '<button class="opt'+(st.ans&&o===q.k?' right':'')+'" data-l="pick" data-v="'+o+'">'+o+'</button>'}).join('')+'</div>';
    h+='<div class="btns"><button class="btn ghost sm" data-l="end">'+t('Finish quiz')+'</button></div>';
    return h;
  };
  L.mount=function(c){
    var e=$('#cb8',c); if(!e) return; var q=st.q;
    var b=boardFor(e,{flip:st.flip,coords:q.t==='knight',onTap:q.t==='tap'&&!st.ans?function(sq){ answer(sq===q.sq, sq===q.sq?'':t('That was {a}. {b} is here.',{a:sq,b:q.sq})); }:function(){}});
    var g=new Chess('8/8/8/8/8/8/8/8 w - - 0 1',{skipValidation:true});
    if(q.t==='name'){ b.marks={}; b.marks[q.sq]=st.ans?(st.ans.right?'good':'target'):'target'; }
    if(q.t==='tap'&&st.ans){ b.marks={}; b.marks[q.sq]='good'; }
    if(q.t==='knight'){ g.put({type:'n',color:'w'},q.sq); b.marks={}; b.marks[q.to]='target'; if(st.ans){ q.path.forEach(function(s,i){ if(i>0) b.labels[s]=String(i); }); } }
    b.set(g);
  };
  L.tick=function(){ var e=$('[data-clock="q"]'); if(e){ e.textContent=mmss(used())+' / '+mmss(LIMIT); if(used()>=LIMIT&&st.phase==='quiz'&&!st.ans) stop(); } };
  L.act=function(a,el){
    if(a==='start'){ st.phase='quiz'; newQ(); }
    else if(a==='resume'){ st.phase='quiz'; newQ(); }
    else if(a==='pick'&&!st.ans){ var v=el.getAttribute('data-v'), q=st.q;
      if(q.t==='name') answer(v===q.sq,t('It was {sq}',{sq:q.sq}));
      if(q.t==='color') answer(v===(isDark(q.sq)?'dark':'light'), t(isDark(q.sq)?'{sq} is dark':'{sq} is light',{sq:q.sq}));
      if(q.t==='knight') answer(+v===q.k,t('It takes {n} moves: {p}',{n:q.k,p:q.path.join(' → ')})); }
    else if(a==='end') stop();
    else if(a==='log'){ finishLesson('thu',{parts:[false,st.n>=10],min:L.clock.min(),addMin:true,extra:{coord:{n:st.n,ok:st.ok}}}); }
  };
  L.active=function(){ return st.phase==='quiz'; };
  L.finish=function(){ L.act('log'); return true; };
  return L;
}

/* ===================== ENDGAMES ===================== */
var ENDGAMES=[
 {id:'ks',grp:'pawn',name:'Key squares',fen:'8/4k3/8/8/4K3/8/4P3/8 w - - 0 1',goal:'win',tip:'Your king already stands on a key square in front of the pawn. Keep the king ahead of the pawn and escort it to promotion.'},
 {id:'op1',grp:'pawn',name:'Take the opposition',fen:'8/8/4k3/8/8/4K3/4P3/8 w - - 0 1',goal:'win',tip:'King first, pawn later! Step up and face the black king with one square between (the opposition).'},
 {id:'op2',grp:'pawn',name:'Defend: block the key squares',fen:'8/8/8/4k3/8/8/4P3/4K3 b - - 0 1',goal:'draw',tip:'You are Black. Put your king in front of the pawn on its key squares and keep the opposition.'},
 {id:'op3',grp:'pawn',name:'Defend: stay in front',fen:'4k3/8/8/4K3/4P3/8/8/8 b - - 0 1',goal:'draw',tip:'You are Black. Stay directly in front of the pawn. When the white king reaches the 6th rank, take the opposition.'},
 {id:'tri',grp:'pawn',name:'Triangulation',fen:'8/1p1k4/1P6/2PK4/8/8/8/8 w - - 0 1',goal:'win',tip:'You want this position with Black to move. Walk your king in a triangle (d5–d4–c4–d5) to lose one tempo.'},
 {id:'luc1',grp:'rook',name:'Lucena: build a bridge',fen:'1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',goal:'win',tip:'Cut the black king off first (Rd1+). Then lift your rook to the 4th rank so it can block the checks — “building a bridge”.'},
 {id:'luc2',grp:'rook',name:'Lucena #2',fen:'2K5/2P1k3/8/8/8/8/1r6/3R4 w - - 0 1',goal:'win',tip:'The black king is cut off on the e-file. Rook to d4, king out, and block the checks with your rook.'},
 {id:'phi',grp:'rook',name:'Philidor defence',fen:'4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',goal:'draw',tip:'You are Black. Keep your rook on the 6th rank. When the pawn moves to e6, swing the rook to the back and check from behind.'},
 {id:'van',grp:'rook',name:'Vancura defence',fen:'R7/6k1/P4r2/8/8/8/8/6K1 b - - 0 1',goal:'draw',tip:'You are Black. Attack the a-pawn from the side with your rook and keep your king close to g7/h7.'}
];
function countP(g,color,type){ var n=0; g.board().forEach(function(r){r.forEach(function(p){ if(p&&p.color===color&&p.type===type) n++; })}); return n; }
function EndgameLesson(slot){
  var L={slot:slot,title:t('Theoretical Endgames')};
  var st={view:'menu',cur:null,attempts:[],engine:'idle'};
  Engine.start().then(function(){ st.engine='ok'; if(L===window.__L()) lr(); },function(){ st.engine='fail'; if(L===window.__L()) lr(); });
  var LOSE=-300, DRAWOK=-150, WINMIN=150, WINOK=500;   // centipawns, from the child's side (measured on these positions)
  function start(eg){ var g=new Chess(eg.fen); st.cur={eg:eg,g:g,kid:g.turn(),status:'play',last:null,kidMoves:0,hint:false,helped:false,marks:{},msg:eg.goal==='win'?t('Goal: WIN. You move first.'):t('Goal: HOLD THE DRAW. You move first.'),mcls:'info'}; st.view='play'; lr(); }
  function end(ok,text,canRetry){ var c=st.cur; Sound.play(ok?'Victory':'Defeat'); c.status=ok?'won':'lost'; c.msg=(ok?'🎉 ':'✗ ')+text; c.mcls=ok?'ok':'no'; c.canRetry=!ok&&!!canRetry&&!!c.prevFen; st.attempts.push({id:c.eg.id,ok:ok,hint:c.hint||c.helped}); lr(); }
  function fail(text){
    var c=st.cur; c.marks={}; end(false,text,true);
    if(!c.prevFen) return;
    Engine.run(c.prevFen,{skill:20,movetime:900}).then(function(r){ if(st.cur!==c||!r.best) return; c.better=r.best; c.msg='✗ '+text+' '+t('Better was {m}.',{m:'<b>'+ls(sanOfUci(c.prevFen,r.best))+'</b>'}); lr(); }).catch(function(){});
  }
  /* real game endings only: mate, stalemate, repetition, 50 moves, bare kings */
  function ruleEnd(){
    var c=st.cur, g=c.g, opp=c.kid==='w'?'b':'w';
    if(g.isCheckmate()){ var kidWon=g.turn()===opp; if(kidWon) end(true,t('Checkmate! Brilliant.')); else fail(t('Checkmated. Try again!')); return true; }
    if(g.isDraw()||g.isStalemate()){ var why=g.isStalemate()?t('Stalemate'):g.isThreefoldRepetition()?t('Draw by repetition'):g.isInsufficientMaterial()?t('Draw — not enough material'):t('Draw');
      if(c.eg.goal==='draw') end(true,why+' — '+t('you held it!')); else fail(why+' — '+t('you needed a win.')); return true; }
    return false;
  }
  /* after each of the child's moves Stockfish (full strength) judges the position, like Lichess practice */
  function judge(ev){
    var c=st.cur, g=c.g, kid=c.kid, opp=kid==='w'?'b':'w', kQ=countP(g,kid,'q'), oQ=countP(g,opp,'q');
    if(c.eg.goal==='draw'){
      if(ev<=LOSE){ fail(t('Stockfish says this position is now lost.')); return true; }
      if(ev>DRAWOK){
        if(countP(g,opp,'p')===0&&oQ===0){ end(true,t('The pawn is gone — it’s a draw. Well defended!')); return true; }
        if(c.kidMoves>=30){ end(true,t('You held for 30 moves — that’s a draw!')); return true; }
      }
    } else {
      if(kQ>0&&oQ===0&&ev>=WINOK){ end(true,t('Your pawn became a queen and it’s safe — that’s a win!')); return true; }
      if(ev<=LOSE){ fail(t('Stockfish says this position is now lost.')); return true; }
      if(ev<WINMIN){ fail(t('The win slipped away — Stockfish says this is only a draw now.')); return true; }
      if(c.kidMoves>=60){ end(false,t('60 moves without winning. Try the plan from the tip!')); return true; }
    }
    return false;
  }
  function engineMove(){
    var c=st.cur; c.status='think'; lr();
    Engine.run(c.g.fen(),{skill:S.skill,movetime:700}).then(function(r){
      if(st.cur!==c||c.status!=='think') return;
      var m=tryMove(c.g,moveFromUci(r.best)); c.last=m; c.status='play'; c.marks={};
      if(!ruleEnd()){ c.msg=t('Your move.'); c.mcls='info'; } lr();
    }).catch(function(){ st.engine='fail'; lr(); });
  }
  function onMove(m){
    var c=st.cur; if(!c||c.status!=='play'||c.g.turn()!==c.kid) return;
    var before=c.g.fen(), prevLast=c.last;
    var mv=tryMove(c.g,m); if(!mv) return;
    c.prevFen=before; c.prevLast=prevLast; c.last=mv; c.kidMoves++; c.marks={}; c.better=null;
    if(ruleEnd()) return;
    c.status='check'; lr();
    var fen=c.g.fen();
    Engine.run(fen,{skill:20,movetime:900}).then(function(r){
      if(st.cur!==c||c.status!=='check') return;
      var v=cpWhite(r.score,fen), ev=c.kid==='w'?v:-v; c.ev=ev;
      if(judge(ev)) return;
      engineMove();
    }).catch(function(){ st.engine='fail'; lr(); });
  }
  function takeBack(){
    var c=st.cur; if(!c||!c.prevFen) return;
    c.g=new Chess(c.prevFen); c.last=c.prevLast; c.kidMoves=Math.max(0,c.kidMoves-1); c.helped=true; c.status='play'; c.canRetry=false; c.marks={};
    if(c.better){ c.marks[c.better.slice(0,2)]='hint'; c.marks[c.better.slice(2,4)]='hint'; }
    c.msg=c.better?t('Try again from here. The blue arrow shows Stockfish’s move.'):t('Your move.'); c.mcls='info'; lr();
  }
  L.view=function(){
    var h='';
    if(st.view==='menu'){
      h+='<div class="lbar"><span class="pill" data-clock="eg">'+mmss(L.clock.secs())+' / 30:00</span><span class="pill">'+t('Stockfish level {n}',{n:S.skill})+'</span><span class="pill">'+t('{a}/{b} solved',{a:st.attempts.filter(function(a){return a.ok}).length,b:st.attempts.length})+'</span></div>';
      if(st.engine==='fail') h+=engineError();
      else if(st.engine!=='ok') h+='<div class="msg info"><span class="spin"></span> '+t('Waking up Stockfish…')+'</div>';
      var grp='';
      ENDGAMES.forEach(function(eg,ix){
        if(eg.grp!==grp){ grp=eg.grp; h+='<h3 style="margin:14px 0 8px">'+(grp==='pawn'?t('Pawn endgames'):t('Rook endgames'))+' <span class="sub">('+(grp==='pawn'?'12':'18')+' min)</span></h3><div class="list">'; }
        var done=(S.egDone||{})[eg.id]||st.attempts.some(function(a){return a.id===eg.id&&a.ok&&!a.hint});
        h+='<button class="item" data-l="pick" data-v="'+eg.id+'"><div><b>'+t(eg.name)+'</b><div class="sub">'+(eg.goal==='win'?t('Win'):t('Hold the draw'))+' · '+t('you play {side}',{side:sideName(eg.fen.split(' ')[1])})+'</div></div>'+(done?'<span class="tick">✓</span>':'')+'</button>';
        var nx=ENDGAMES[ix+1]; if(!nx||nx.grp!==grp) h+='</div>';
      });
      h+='<div class="fld" style="margin-top:14px">'+t('Stockfish strength (0–20)')+'<input type="range" min="0" max="20" value="'+S.skill+'" data-l="skill"></div>';
      h+='<button class="btn go" style="margin-top:14px" data-l="log"'+(st.attempts.length?'':' disabled')+'>'+t('Finish & log session')+' →</button>';
      return h;
    }
    var c=st.cur;
    h+='<div class="lbar"><span class="pill">'+t(c.eg.name)+'</span><span class="pill '+(c.eg.goal==='win'?'g':'y')+'">'+(c.eg.goal==='win'?t('Win'):t('Draw'))+'</span><span class="pill">'+t('Move {n}',{n:c.kidMoves})+'</span><span class="pill" data-clock="eg">'+mmss(L.clock.secs())+'</span></div>';
    if(st.engine==='fail') h+=engineError(c.g.fen());
    h+='<div id="egb"></div><div class="msg '+c.mcls+'">'+(c.status==='think'?'<span class="spin"></span> '+t('Stockfish is thinking…'):c.status==='check'?'<span class="spin"></span> '+t('Stockfish is checking your move…'):c.msg)+'</div>';
    if(c.status==='lost'&&c.canRetry) h+='<button class="btn play" data-l="takeback">↶ '+t('Take back and try again')+'</button>';
    h+='<details style="margin:8px 0"><summary style="font-size:15px">💡 '+t('Tip')+'</summary><p class="sub">'+t(c.eg.tip)+'</p></details>';
    h+='<div class="btns">';
    if(c.status==='play') h+='<button class="btn ghost sm" data-l="hint">'+t('Hint')+'</button>';
    h+='<button class="btn ghost sm" data-l="retry">'+t('Restart')+'</button><button class="btn ghost sm" data-l="menu">'+t('All positions')+'</button></div>';
    return h;
  };
  L.mount=function(c){ var e=$('#egb',c); if(!e||!st.cur) return; var b=boardFor(e,{flip:st.cur.kid==='b',movable:st.cur.status==='play'?st.cur.kid:null,onMove:onMove}); b.marks=st.cur.marks||{}; b.set(st.cur.g,st.cur.last); };
  L.tick=function(){ var e=$('[data-clock="eg"]'); if(e) e.textContent=mmss(L.clock.secs())+(st.view==='menu'?' / 30:00':''); };
  L.act=function(a,el){
    if(a==='pick'){ var id=el.getAttribute('data-v'); start(ENDGAMES.filter(function(e){return e.id===id})[0]); }
    else if(a==='retry') start(st.cur.eg);
    else if(a==='takeback') takeBack();
    else if(a==='menu'){ if(st.cur&&st.cur.status!=='won'&&st.cur.status!=='lost'&&st.cur.kidMoves>0) st.attempts.push({id:st.cur.eg.id,ok:false,hint:st.cur.hint}); st.view='menu'; st.cur=null; lr(); }
    else if(a==='hint'){ var c=st.cur; c.hint=true; c.msg='<span class="spin"></span> '+t('Looking…'); lr(); Engine.run(c.g.fen(),{skill:20,movetime:1200}).then(function(r){ if(st.cur!==c) return; c.marks={}; c.marks[r.best.slice(0,2)]='hint'; c.marks[r.best.slice(2,4)]='hint'; c.msg=t('Follow the blue arrow. (Hint used)'); c.mcls='info'; lr(); }).catch(function(){ st.engine='fail'; lr(); }); }
    else if(a==='log'){
      var ok=st.attempts.filter(function(x){return x.ok}).length, n=st.attempts.length;
      var eg={}; st.attempts.forEach(function(x){ if(x.ok&&!x.hint) eg[x.id]=true; });
      var pawn=st.attempts.some(function(x){return ['ks','op1','op2','op3','tri'].indexOf(x.id)>=0}), rook=st.attempts.some(function(x){return ['luc1','luc2','phi','van'].indexOf(x.id)>=0});
      finishLesson('tue',{acc:n?Math.round(ok/n*100):null,min:L.clock.min(),parts:[pawn,rook],extra:{eg:eg}});
    }
  };
  L.change=function(a,el){ if(a==='skill'){ S.skill=+el.value; Store.saveSettings(); lr(); } };
  L.state=function(){ return st; };
  L.active=function(){ return st.view==='play'&&st.cur&&st.cur.status!=='won'&&st.cur.status!=='lost'; };
  L.finish=function(){ L.act('log'); return true; };
  return L;
}

/* ===================== GUESS THE MOVE ===================== */
function GuessLesson(slot){
  var L={slot:slot,title:t('Guess-the-Move')};
  var games=DATA.games;
  var st={view:'menu',gi:null,g:null,list:null,p:0,status:'',tries:0,first:0,second:0,guessed:0,crit:false,critUsed:0,thinkEnd:0,last:null,marks:{},msg:'',mcls:'info',openPlies:16,finished:false,vi:null};
  function nextIdx(){ for(var i=0;i<games.length;i++) if((S.gamesDone||[]).indexOf(i)<0) return i; return 0; }
  function heroName(gm){ return gm.side==='w'?gm.w:gm.b; }
  function short(n){ return n.split(',')[0]; }
  function start(gi){
    var gm=games[gi], tmp=new Chess(), list=[];
    gm.san.split(' ').forEach(function(s){ var m=tryMove(tmp,s); if(m) list.push(m); });
    st.gi=gi; st.g=new Chess(); st.list=list; st.p=0; st.vi=null; st.view='play'; st.first=st.second=st.guessed=0; st.critUsed=0; st.finished=false; st.last=null; st.marks={};
    st.msg=t('Playing the opening…'); st.mcls='info'; lr(); step();
  }
  function isCritical(m,hero){
    if(m.captured||/[+#]/.test(m.san)||m.flags.indexOf('k')>=0||m.flags.indexOf('q')>=0) return true;
    if(m.piece==='p'&&'cdef'.indexOf(m.to[0])>=0){ var r=+m.to[1]; if((hero==='w'&&r>=4)||(hero==='b'&&r<=5)) return true; }
    return false;
  }
  function step(){
    if(st.view!=='play') return;
    if(st.p>=st.list.length){ st.finished=true; st.status='done'; st.msg='🏁 '+t('Game over — {r}. Great study!',{r:games[st.gi].res}); st.mcls='ok'; lr(); return; }
    var m=st.list[st.p], hero=games[st.gi].side, mine=m.color===hero&&st.p>=st.openPlies;
    if(!mine){
      st.status='auto'; var gi=st.gi;
      setTimeout(function(){ if(st.gi!==gi||st.view!=='play') return; st.last=tryMove(st.g,{from:m.from,to:m.to,promotion:m.promotion}); st.p++; lr(); step(); }, st.p<st.openPlies?120:800);
      return;
    }
    st.status='guess'; st.tries=0; st.crit=isCritical(m,hero); st.marks={};
    st.msg=st.crit?'⭐ <b>'+t('Critical moment!')+'</b> '+t('Take 2–3 minutes: checks, captures, threats, candidate moves.'):t('Your guess: what did {p} play?',{p:short(heroName(games[st.gi]))}); st.mcls=st.crit?'':'info';
    lr();
  }
  function onMove(mv){
    if(st.status!=='guess') return;
    var m=st.list[st.p];
    if(mv.from===m.from&&mv.to===m.to&&(!m.promotion||mv.promotion===m.promotion)){
      st.guessed++; if(st.tries===0) st.first++; else st.second++;
      st.last=tryMove(st.g,{from:m.from,to:m.to,promotion:m.promotion}); st.p++;
      st.msg=(st.tries===0?'✓ '+t('Master move! +2'):'✓ '+t('Got it on the second try. +1'))+' ('+ls(m.san)+')'; st.mcls='ok'; st.status='auto'; st.thinkEnd=0; lr();
      setTimeout(step,700);
    } else {
      st.tries++; st.marks={}; st.marks[mv.from]='bad'; st.marks[mv.to]='bad';
      if(st.tries>=2){ st.guessed++; st.last=tryMove(st.g,{from:m.from,to:m.to,promotion:m.promotion}); st.p++; st.marks={}; st.marks[m.from]='good'; st.marks[m.to]='good';
        st.msg=t('The master played {m}. Can you see why?',{m:'<b>'+ls(m.san)+'</b>'}); st.mcls='no'; st.status='reveal'; st.thinkEnd=0; }
      else { st.msg='✗ '+t('Not the master’s move — one more try!'); st.mcls='no'; }
      lr();
    }
  }
  /* Browsing the moves already played (like the arrows on Lichess). st.vi = plies shown; null = live position. */
  function shown(){ return st.vi==null?st.p:st.vi; }
  function browse(n){
    if(st.view!=='play') return;
    n=Math.max(0,Math.min(st.p,n));
    st.vi=n>=st.p?null:n; lr();
  }
  function movesHtml(){
    var h=st.g.history(), out='', cur=shown();
    for(var i=0;i<h.length;i++){ if(i%2===0) out+=(i/2+1)+'. '; out+='<span data-l="ply" data-v="'+(i+1)+'"'+(i+1===cur?' class="cur"':'')+'>'+esc(ls(h[i]))+'</span> '; }
    return out;
  }
  function navHtml(){
    var cur=shown(), dis=function(c){ return c?' disabled':''; };
    return '<div class="mnav"><button class="btn ghost sm" data-l="nav" data-v="first" aria-label="'+t('First move')+'"'+dis(cur<=0)+'>⏮</button>'+
      '<button class="btn ghost sm" data-l="nav" data-v="prev" aria-label="'+t('Previous move')+'"'+dis(cur<=0)+'>◀</button>'+
      '<button class="btn ghost sm" data-l="nav" data-v="next" aria-label="'+t('Next move')+'"'+dis(cur>=st.p)+'>▶</button>'+
      '<button class="btn ghost sm" data-l="nav" data-v="last" aria-label="'+t('Back to the game')+'"'+dis(cur>=st.p)+'>⏭</button></div>';
  }
  L.view=function(){
    var h='';
    if(st.view==='menu'){
      var nx=nextIdx(), gm=games[nx];
      h+='<div class="card"><h2>'+t('Today’s game')+'</h2><p><b>'+esc(gm.w)+'</b> – <b>'+esc(gm.b)+'</b><br><span class="sub">'+esc(gm.ev)+' '+gm.yr+' · '+t('{n} moves',{n:gm.n})+' · '+gm.res+'</span></p><p class="sub">'+t('You play {p}’s side. The first 8 moves play themselves; then guess every move. 2 points first try, 1 point second try. About 30 minutes — stop and log whenever time is up.',{p:esc(short(heroName(gm)))})+'</p><button class="btn play" data-l="go" data-v="'+nx+'">'+t('Start this game')+'</button></div>';
      h+='<div class="card"><h2>'+t('All games')+'</h2><div class="list">';
      games.forEach(function(g,i){ var done=(S.gamesDone||[]).indexOf(i)>=0; h+='<button class="item" data-l="go" data-v="'+i+'"><div><b>'+esc(short(g.w))+' – '+esc(short(g.b))+'</b><div class="sub">'+g.yr+' · '+t('{n} moves',{n:g.n})+' · '+t('{p} wins',{p:g.hero})+'</div></div>'+(done?'<span class="tick">✓</span>':'')+'</button>'; });
      return h+'</div></div>';
    }
    var gm=games[st.gi], pct=st.guessed?Math.round(st.first/st.guessed*100):null;
    h+='<div class="lbar"><span class="pill">'+esc(short(gm.w))+' – '+esc(short(gm.b))+' '+gm.yr+'</span><span class="pill '+(pct==null?'':pct>=50?'g':'y')+'">'+t('{a}/{b} first try',{a:st.first,b:st.guessed})+'</span><span class="pill">'+t('{n} pts',{n:st.first*2+st.second})+'</span><span class="pill" data-clock="g">'+mmss(L.clock.secs())+' / 30:00</span></div>';
    h+='<div id="gb"></div>'+navHtml();
    if(st.vi!=null) h+='<div class="msg info">👀 '+t('Looking at move {n}. The game waits for you.',{n:Math.ceil(st.vi/2)+(st.vi%2?'.':'…')})+' <button class="btn sm" data-l="nav" data-v="last">'+t('Back to the game')+' ⏭</button></div>';
    h+='<div class="msg '+st.mcls+'">'+st.msg+'</div>';
    if(st.status==='guess'&&st.crit) h+= st.thinkEnd? '<div class="msg info" data-clock="think">'+t('Thinking time:')+' '+mmss((st.thinkEnd-Date.now())/1000)+'</div>' : '<button class="btn play" data-l="think">🧠 '+t('Start 2:30 thinking timer')+'</button>';
    if(st.status==='reveal') h+='<button class="btn play" data-l="cont">'+t('Continue')+' →</button>';
    if(st.finished) h+='<button class="btn go" data-l="log">'+t('Log this session')+' →</button>';
    h+='<div class="mlist">'+(movesHtml()||'—')+'</div>';
    if(!st.finished) h+='<div class="btns"><button class="btn ghost sm" data-l="stop">'+t('End game here & log')+'</button><button class="btn ghost sm" data-l="menu">'+t('Choose another game')+'</button></div>';
    return h;
  };
  var pausedAt=0;
  L.active=function(){ return st.view==='play'&&!st.finished; };
  L.onClock=function(on){ if(!on&&!pausedAt) pausedAt=Date.now(); if(on&&pausedAt){ if(st.thinkEnd) st.thinkEnd+=Date.now()-pausedAt; pausedAt=0; } };
  L.finish=function(){ if(st.gi==null) return false; L.act('stop'); return true; };
  L.mount=function(c){
    var e=$('#gb',c); if(!e) return;
    if(st.vi!=null){
      var g=new Chess(), last=null; for(var i=0;i<st.vi;i++){ var m=st.list[i]; last=tryMove(g,{from:m.from,to:m.to,promotion:m.promotion}); }
      var bv=boardFor(e,{flip:games[st.gi].side==='b',movable:null}); bv.marks={}; bv.set(g,last);
      var cu=$('.mlist .cur',c); if(cu) cu.scrollIntoView({block:'nearest'});
      return;
    }
    var b=boardFor(e,{flip:games[st.gi].side==='b',movable:st.status==='guess'?games[st.gi].side:null,onMove:onMove}); b.marks=st.marks; b.set(st.g,st.last);
    var ml=$('.mlist',c); if(ml) ml.scrollTop=ml.scrollHeight;
  };
  L.state=function(){ return st; };
  L.key=function(k){
    if(st.view!=='play') return false;
    var cur=shown();
    if(k==='ArrowLeft') browse(cur-1); else if(k==='ArrowRight') browse(cur+1);
    else if(k==='ArrowUp'||k==='Home') browse(0); else if(k==='ArrowDown'||k==='End') browse(st.p);
    else return false;
    return true;
  };
  L.tick=function(){ var e=$('[data-clock="g"]'); if(e) e.textContent=mmss(L.clock.secs())+' / 30:00'; var th=$('[data-clock="think"]'); if(th&&st.thinkEnd){ var left=(st.thinkEnd-Date.now())/1000; th.textContent=left>0?t('Thinking time:')+' '+mmss(left):'⏰ '+t('Time! Make your guess.'); } };
  L.act=function(a,el){
    if(a==='go') start(+el.getAttribute('data-v'));
    else if(a==='think'){ st.thinkEnd=Date.now()+150000; st.critUsed++; lr(); }
    else if(a==='cont'){ st.status='auto'; st.marks={}; step(); }
    else if(a==='menu'){ st.view='menu'; st.gi=null; st.vi=null; lr(); }
    else if(a==='ply') browse(+el.getAttribute('data-v'));
    else if(a==='nav'){ var v=el.getAttribute('data-v'), cur=shown(); browse(v==='first'?0:v==='prev'?cur-1:v==='next'?cur+1:st.p); }
    else if(a==='stop'||a==='log'){
      finishLesson('wed',{acc:st.guessed?Math.round(st.first/st.guessed*100):null,min:L.clock.min(),parts:[st.finished,st.critUsed>=2],extra:{game:st.gi},note:short(games[st.gi].w)+' – '+short(games[st.gi].b)+' '+games[st.gi].yr+' · '+t('{n} pts',{n:st.first*2+st.second})});
    }
  };
  return L;
}

/* ===================== FRIDAY: BLINDFOLD + THREATS ===================== */
function FridayLesson(slot){
  var L={slot:slot,title:t('Blindfold & Threats')};
  var B=DATA.pz.blind, T=DATA.pz.threat;
  var st={tab:'blind',bPos:S.blindPos||0,tPos:S.threatPos||0,bN:0,bOk:0,tN:0,tOk:0,bc:new Clock(),tc:new Clock(),b:null,t:null};
  Speech.init();
  function newBlind(){ var p=B[st.bPos%B.length]; st.b={p:p,si:0,line:[],peek:false,status:'play',opts:null,msg:''}; prepOpts(); }
  function prepOpts(){ var b=st.b, s=b.p.steps[b.si]; b.opts=s?shuffle([s.san].concat(s.alt)):null; }
  function meColor(p){ return p.side==='White'?'w':'b'; }
  function blindText(p){ var me=meColor(p);
    return t('{side} to move.',{side:sideName(me)})+' '+t('White')+': '+describeSide(p.fen,'w')+'. '+t('Black')+': '+describeSide(p.fen,'b')+'. '+t('{side} just played {m}.',{side:sideName(me==='w'?'b':'w'),m:sanWords(p.last)}); }
  function newThreat(){
    var p=T[st.tPos%T.length], g=new Chess(p.fen), mv=tryMove(g,moveFromUci(p.pre));
    st.t={p:p,g:g,last:mv,kid:mv.color,status:'play',marks:{},msg:t('You just played {m}. Now it’s your opponent’s turn — what is their strongest move? Move their piece!',{m:'<b>'+ls(p.last)+'</b>'}),mcls:'info'};
  }
  function bAnswer(san){
    var b=st.b, s=b.p.steps[b.si];
    if(san!==s.san){ b.status='fail'; st.bN++; b.msg='✗ '+t('The answer was {m}.',{m:'<b>'+ls(s.san)+'</b>'})+' '+t('Full line:')+' '+ls(b.p.steps.map(function(x){return x.san}).join(' ')); b.mcls='no'; lr(); return; }
    b.line.push(s.san); b.si++;
    var nx=b.p.steps[b.si];
    if(nx&&nx.opp){ b.line.push(nx.san); b.si++; b.msg='✓ '+ls(s.san)+'! '+t('Opponent replies {m}. Your next move?',{m:'<b>'+ls(nx.san)+'</b>'}); b.mcls='ok'; Speech.say(t('Correct.')+' '+t('Opponent replies {m}. Your next move?',{m:sanWords(nx.san)})); }
    if(b.si>=b.p.steps.length){ b.status='ok'; st.bN++; if(!b.peek) st.bOk++; b.msg='🎉 '+(b.peek?t('Solved (with a peek — doesn’t count)'):t('Solved!'))+' '+t('Line:')+' '+ls(b.line.join(' ')); b.mcls=b.peek?'':'ok'; }
    prepOpts(); lr();
  }
  function tMove(m){
    var tt=st.t; if(tt.status!=='play') return;
    var u=uciOf(m), ok=u===tt.p.ans||tt.p.mates.indexOf(u)>=0||u+'q'===tt.p.ans;
    st.tN++; if(ok) st.tOk++;
    var mv=tryMove(tt.g,ok?m:moveFromUci(tt.p.ans));
    tt.last=mv; tt.status=ok?'ok':'fail'; tt.marks={};
    if(!ok){ tt.marks[m.from]='bad'; tt.marks[m.to]='bad'; }
    tt.msg=ok?'✓ '+t('Yes! {m} was the danger. Always check your opponent’s best reply!',{m:'<b>'+ls(tt.p.ansSan)+'</b>'}):'✗ '+t('The opponent’s strongest move was {m} (shown on the board).',{m:'<b>'+ls(tt.p.ansSan)+'</b>'}); tt.mcls=ok?'ok':'no';
    lr();
  }
  L.view=function(){
    var h='<div class="seg"><button class="'+(st.tab==='blind'?'on':'')+'" data-l="tab" data-v="blind">🙈 '+t('Blindfold')+' ('+st.bOk+'/'+st.bN+')</button><button class="'+(st.tab==='threat'?'on':'')+'" data-l="tab" data-v="threat">⚠️ '+t('Threats')+' ('+st.tOk+'/'+st.tN+')</button></div>';
    if(st.tab==='blind'){
      if(!st.b) return h+'<div class="card"><h2>🙈 '+t('Blindfold tactics')+'</h2><p class="sub">'+t('No board! Listen to (or read) where the pieces are, picture the board in your head, then pick the winning moves. 15 minutes.')+'</p><button class="btn play" data-l="bstart">'+t('Start')+'</button></div>';
      var b=st.b, p=b.p, me=meColor(p);
      h+='<div class="lbar"><span class="pill">#'+(st.bPos%B.length+1)+'</span><span class="pill" data-clock="bt">'+mmss(st.bc.secs())+' / 15:00</span></div>';
      h+='<div class="btext"><b>'+t('{side} to move',{side:sideName(me)})+'</b><br>⬜ '+t('White')+': '+describeSide(p.fen,'w')+'<br>⬛ '+t('Black')+': '+describeSide(p.fen,'b')+'<br><span class="sub">'+t('{side} just played {m}',{side:sideName(me==='w'?'b':'w'),m:ls(p.last)})+'</span>'+(b.line.length?'<br>'+t('Line so far:')+' <b>'+ls(b.line.join(' '))+'</b>':'')+'</div>';
      h+='<div class="btns">'+(Speech.available()?'<button class="btn ghost sm" data-l="say">🔊 '+t('Read aloud')+'</button>':'')+'<button class="btn ghost sm" data-l="peek">👁 '+(b.peek?t('Hide board'):t('Peek at board'))+'</button></div>';
      if(b.peek) h+='<div id="bb" style="margin-top:10px"></div>';
      if(b.msg) h+='<div class="msg '+(b.mcls||'')+'">'+b.msg+'</div>';
      if(b.status==='play'&&b.opts) h+='<div class="opts">'+b.opts.map(function(o){return '<button class="opt" data-l="bans" data-v="'+esc(o)+'">'+esc(ls(o))+'</button>'}).join('')+'</div>';
      else h+='<button class="btn play" data-l="bnext">'+t('Next puzzle')+' →</button>';
    } else {
      if(!st.t) return h+'<div class="card"><h2>⚠️ '+t('Threat drills')+'</h2><p class="sub">'+t('You just made a move. Before you relax: what is your opponent’s strongest reply? Move their piece to show it. 15 minutes.')+'</p><button class="btn play" data-l="tstart">'+t('Start')+'</button></div>';
      var tt=st.t;
      h+='<div class="lbar"><span class="pill">#'+(st.tPos%T.length+1)+'</span><span class="pill" data-clock="tt">'+mmss(st.tc.secs())+' / 15:00</span></div>';
      h+='<div id="tb"></div><div class="msg '+tt.mcls+'">'+tt.msg+'</div>';
      if(tt.status!=='play') h+='<button class="btn play" data-l="tnext">'+t('Next')+' →</button>';
    }
    h+='<button class="btn go" style="margin-top:12px" data-l="log"'+(st.bN+st.tN?'':' disabled')+'>'+t('Finish & log session')+' →</button>';
    return h;
  };
  L.mount=function(c){
    var bb=$('#bb',c); if(bb&&st.b){ var g=new Chess(st.b.p.fen); var bd=boardFor(bb,{flip:st.b.p.side==='Black'}); bd.set(g); }
    var tb=$('#tb',c); if(tb&&st.t){ var tt=st.t, opp=tt.kid==='w'?'b':'w'; var b2=boardFor(tb,{flip:tt.kid==='b',movable:tt.status==='play'?opp:null,onMove:tMove}); b2.marks=tt.marks; b2.set(tt.g,tt.last); }
  };
  L.tick=function(){ var a=$('[data-clock="bt"]'); if(a) a.textContent=mmss(st.bc.secs())+' / 15:00'; var b=$('[data-clock="tt"]'); if(b) b.textContent=mmss(st.tc.secs())+' / 15:00'; };
  L.active=function(){ return (st.tab==='blind'&&!!st.b)||(st.tab==='threat'&&!!st.t); };
  L.onClock=function(on){ st.bc.set(on&&st.tab==='blind'); st.tc.set(on&&st.tab==='threat'); };
  L.finish=function(){ if(!(st.bN+st.tN)) return false; L.act('log'); return true; };
  L.act=function(a,el){
    if(a==='tab'){ st.tab=el.getAttribute('data-v'); lr(); }
    else if(a==='bstart'){ newBlind(); lr(); Speech.say(blindText(st.b.p)); }
    else if(a==='say'){ Speech.say(st.b.si===0?blindText(st.b.p):t('Line so far:')+' '+st.b.line.map(sanWords).join(', ')); }
    else if(a==='peek'){ st.b.peek=!st.b.peek; lr(); }
    else if(a==='bans') bAnswer(el.getAttribute('data-v'));
    else if(a==='bnext'){ st.bPos++; newBlind(); lr(); Speech.say(blindText(st.b.p)); }
    else if(a==='tstart'||a==='tnext'){ if(a==='tnext') st.tPos++; newThreat(); lr(); }
    else if(a==='log'){
      if(st.b&&st.b.status!=='play') st.bPos++; if(st.t&&st.t.status!=='play') st.tPos++;
      var n=st.bN+st.tN, ok=st.bOk+st.tOk;
      finishLesson('fri',{acc:n?Math.round(ok/n*100):null,min:L.clock.min(),parts:[st.bN>0,st.tN>0],extra:{blindPos:st.bPos,threatPos:st.tPos},note:t('Blindfold')+' '+st.bOk+'/'+st.bN+' · '+t('Threats')+' '+st.tOk+'/'+st.tN});
    }
  };
  return L;
}

/* ===================== WEEKEND: GAME + NOTEBOOK + ENGINE ===================== */
var LEVELS=[{skill:0,mt:80,d:1},{skill:2,mt:120,d:2},{skill:4,mt:200,d:3},{skill:6,mt:300,d:5},{skill:9,mt:450,d:8},{skill:12,mt:650,d:11},{skill:16,mt:900,d:14},{skill:20,mt:1200,d:18}];
var EVALS=[['+-','White winning'],['±','White better'],['=','Equal'],['∓','Black better'],['-+','Black winning'],['∞','Unclear']];
function WeekendLesson(slot){
  var L={slot:slot,title:t('Classical Game & Notebook')};
  var saved=lsGet(K('wk'));
  var st={view:'menu',cfg:{color:'w',tc:'15+10',level:4,soh:true},G:null,b:null,nbc:new Clock()};
  function persist(){ if(st.G) lsSet(K('wk'),st.G); }
  function gameFrom(G){ var g=new Chess(); G.moves.forEach(function(s){ tryMove(g,s); }); return g; }
  function startPlay(){
    var c=st.cfg, kid=c.color==='r'?(Math.random()<.5?'w':'b'):c.color, base=(c.tc==='25+10'?25:15)*60000;
    st.G={id:uid(),source:'app',moves:[],kid:kid,tc:c.tc,level:c.level,soh:c.soh,clock:{w:base,b:base},inc:10000,result:null,notes:{},ply:0,unlocked:false,review:null,startedAt:Date.now(),date:today()};
    st.view='play'; st.pending=null; st.lastTs=Date.now(); persist(); lr(); maybeEngine();
  }
  function curGame(){ return gameFrom(st.G); }
  function over(g){
    if(g.isCheckmate()) return g.turn()==='w'?'0-1':'1-0';
    if(g.isDraw()||g.isStalemate()) return '1/2-1/2';
    return null;
  }
  function endGame(res,why){ var G=st.G; Sound.play(res==='1/2-1/2'?'Draw':(((res==='1-0')===(G.kid==='w'))?'Victory':'Defeat')); G.result=res; G.why=why; G.endedAt=Date.now(); G.ply=G.moves.length; G.nbStart=Date.now(); st.view='nb'; persist(); lr(); toast(t('Game over:')+' '+res+(why?' ('+t(why)+')':'')); }
  function applyMove(m){
    var G=st.G, g=curGame(), mv=tryMove(g,m); if(!mv) return false;
    G.clock[mv.color]+=G.inc; G.moves.push(mv.san); st.lastMove={from:mv.from,to:mv.to}; st.lastTs=Date.now();
    persist(); var r=over(g); if(r){ endGame(r,g.isCheckmate()?'checkmate':'draw'); return true; }
    lr(); maybeEngine(); return true;
  }
  function maybeEngine(){
    var G=st.G, g=curGame(); if(G.result||g.turn()===G.kid) return;
    st.thinking=true; var lv=LEVELS[G.level-1], id=G.id;
    Engine.run(g.fen(),{skill:lv.skill,movetime:lv.mt,depth:lv.d}).then(function(r){ if(!st.G||st.G.id!==id||st.G.result) return; st.thinking=false; applyMove(moveFromUci(r.best)); })
      .catch(function(){ st.thinking=false; st.engineFail=true; lr(); });
  }
  function kidMove(m){
    var G=st.G; if(G.result) return; var g=curGame(); if(g.turn()!==G.kid) return;
    if(G.soh){ var tt=new Chess(g.fen()), mv=tryMove(tt,m); if(!mv) return; st.pending={m:m,g:tt,mv:mv}; lr(); }
    else applyMove(m);
  }
  function noteDone(n){ return n && n.cand && n.cand.trim().length>=2 && n.ev; }
  function notesDone(){ return Object.keys(st.G.notes).filter(function(k){return noteDone(st.G.notes[k])}).length; }
  function runReview(){
    var G=st.G, g=new Chess(), fens=[g.fen()]; G.moves.forEach(function(s){ tryMove(g,s); fens.push(g.fen()); });
    G.review={evals:[],best:[],progress:0,done:false}; persist(); lr();
    var i=0;
    (function nextPos(){
      if(!st.G||st.G.id!==G.id) return;
      if(i>=fens.length){ G.review.done=true; persist(); lr(); return; }
      var fen=fens[i];
      var chk=new Chess(fen); if(chk.isGameOver()){ G.review.evals[i]=chk.isCheckmate()?(chk.turn()==='w'?-10000:10000):0; G.review.best[i]=null; i++; G.review.progress=i/fens.length; nextPos(); return; }
      Engine.run(fen,{skill:20,movetime:220}).then(function(r){ G.review.evals[i]=cpWhite(r.score,fen); G.review.best[i]=r.best; i++; G.review.progress=i/fens.length; var pb=$('#rvp'); if(pb) pb.style.width=Math.round(G.review.progress*100)+'%'; nextPos(); })
        .catch(function(){ st.engineFail=true; lr(); });
    })();
  }
  function mistakes(){
    var G=st.G, R=G.review, out=[]; if(!R||!R.done) return out;
    var g=new Chess(), fens=[g.fen()]; G.moves.forEach(function(s){ tryMove(g,s); fens.push(g.fen()); });
    for(var i=0;i<G.moves.length;i++){
      var color=i%2===0?'w':'b'; if(color!==G.kid) continue;
      var sign=color==='w'?1:-1, before=Math.max(-1500,Math.min(1500,R.evals[i]*sign)), after=Math.max(-1500,Math.min(1500,R.evals[i+1]*sign)), drop=before-after;
      if(drop>=80 && before>-600){ out.push({ply:i+1,san:G.moves[i],drop:drop,tag:drop>=200?'??':'?',best:R.best[i]?sanOfUci(fens[i],R.best[i]):'',tagged:!!(G.notes[i+1]&&G.notes[i+1].tag)}); }
    }
    return out;
  }
  function evalChart(){
    var R=st.G.review; if(!R||!R.done) return '';
    var W=640,H=150,n=R.evals.length, pts=R.evals.map(function(v,i){ var c=Math.max(-800,Math.min(800,v)); return [(i/(Math.max(1,n-1)))*W, H/2-(c/800)*(H/2-6)]; });
    var path=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)}).join(' ');
    return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+t('Evaluation through the game')+'"><rect width="'+W+'" height="'+H+'" fill="#5c3d24" rx="10"/><path d="'+path+' L '+W+' '+H+' L 0 '+H+' Z" fill="#ffffff"/><line x1="0" x2="'+W+'" y1="'+H/2+'" y2="'+H/2+'" stroke="#f0d9b5" stroke-dasharray="4 4"/></svg><div class="note">'+t('White’s advantage is light, Black’s is dark.')+'</div>';
  }
  L.view=function(){
    var h='', G=st.G;
    if(st.view==='menu'){
      if(saved&&saved.moves&&(!saved.finished)) h+='<div class="card"><h2>'+t('Continue')+'</h2><p class="sub">'+t('Game from {d}',{d:fmtDate(saved.date)})+' · '+t('{n} half-moves',{n:saved.moves.length})+(saved.result?' · '+saved.result:'')+'</p><button class="btn play" data-l="resume">'+(saved.result?t('Open notebook'):t('Resume game'))+'</button><button class="btn ghost sm" data-l="discard">'+t('Discard it')+'</button></div>';
      h+='<div class="card"><h2>♚ '+t('Play a serious game here')+'</h2><p class="sub">'+t('Against Stockfish with a real clock. Sit-on-hands mode makes you confirm every move after a blunder check.')+'</p>';
      h+='<div class="fld">'+t('Your colour')+'</div><div class="seg">'+[['w','White'],['b','Black'],['r','Random']].map(function(o){return '<button data-l="cfg" data-k="color" data-v="'+o[0]+'" class="'+(st.cfg.color===o[0]?'on':'')+'">'+t(o[1])+'</button>'}).join('')+'</div>';
      h+='<div class="fld">'+t('Time control')+'</div><div class="seg">'+['15+10','25+10'].map(function(o){return '<button data-l="cfg" data-k="tc" data-v="'+o+'" class="'+(st.cfg.tc===o?'on':'')+'">'+o+'</button>'}).join('')+'</div>';
      h+='<div class="fld">'+t('Stockfish level: {n} of 8',{n:st.cfg.level})+'<input type="range" min="1" max="8" value="'+st.cfg.level+'" data-l="level"></div>';
      h+='<label class="row"><input type="checkbox" data-l="soh"'+(st.cfg.soh?' checked':'')+'><span><b>'+t('Sit-on-hands mode:')+'</b> '+t('confirm each move after checking for checks, captures and threats')+'</span></label>';
      h+='<button class="btn play" style="margin-top:8px" data-l="play">'+t('Start game')+'</button></div>';
      h+='<div class="card"><h2>🧑‍🤝‍🧑 '+t('Played on a real board or online?')+'</h2><p class="sub">'+t('Enter the game (paste PGN or click the moves) and go straight to the notebook.')+'</p><button class="btn blue" style="width:100%" data-l="enter">'+t('Enter my game')+'</button></div>';
      return h;
    }
    if(st.view==='enter'){
      var eg=st.entry;
      h+='<div class="card"><h2>'+t('Enter your game')+'</h2><div class="fld">'+t('Paste PGN (optional)')+'<textarea id="pgnin" placeholder="1. e4 e5 2. Nf3 ..."></textarea></div><button class="btn ghost sm" data-l="loadpgn">'+t('Load PGN')+'</button>';
      h+='<p class="sub" style="margin-top:12px">'+t('…or play both sides’ moves on the board:')+'</p><div id="eb"></div><div class="mlist">'+esc(ls(eg.g.history().map(function(s,i){return (i%2===0?(i/2+1)+'. ':'')+s}).join(' '))||'—')+'</div>';
      h+='<div class="btns"><button class="btn ghost sm" data-l="undo">↶ '+t('Undo')+'</button></div>';
      h+='<div class="fld" style="margin-top:10px">'+t('I played')+'</div><div class="seg">'+[['w','White'],['b','Black']].map(function(o){return '<button data-l="ecol" data-v="'+o[0]+'" class="'+(eg.kid===o[0]?'on':'')+'">'+t(o[1])+'</button>'}).join('')+'</div>';
      h+='<div class="fld">'+t('Result')+'</div><div class="seg">'+['1-0','1/2-1/2','0-1'].map(function(o){return '<button data-l="eres" data-v="'+o+'" class="'+(eg.res===o?'on':'')+'">'+o+'</button>'}).join('')+'</div>';
      h+='<div class="seg">'+['15+10','25+10','Other'].map(function(o){return '<button data-l="etc" data-v="'+o+'" class="'+(eg.tc===o?'on':'')+'">'+t(o)+'</button>'}).join('')+'</div>';
      h+='<button class="btn play" style="margin-top:10px" data-l="edone"'+(eg.g.history().length>=2?'':' disabled')+'>'+t('Go to notebook')+' →</button></div>';
      return h;
    }
    if(st.view==='play'){
      var g=curGame(), turn=g.turn(), top=G.kid==='w'?'b':'w';
      h+='<div class="clocks"><div class="clock'+(turn===top&&!G.result?' on':'')+'" data-clock="'+top+'"><small>Stockfish L'+G.level+'</small>'+mmss(G.clock[top]/1000)+'</div></div>';
      h+='<div id="pb"></div>';
      h+='<div class="clocks"><div class="clock'+(turn===G.kid&&!G.result?' on':'')+'" data-clock="'+G.kid+'"><small>'+esc(S.player)+'</small>'+mmss(G.clock[G.kid]/1000)+'</div></div>';
      if(st.engineFail) h+=engineError(g.fen());
      if(st.pending) h+='<div class="msg soh">✋ <b>'+t('Sit on your hands!')+'</b> '+t('You want to play {m}.',{m:'<b>'+ls(st.pending.mv.san)+'</b>'})+'<br>'+t('Checks? Captures? Threats? Is anything left hanging?')+'</div><div class="btns"><button class="btn go" data-l="confirm">✓ '+t('Confirm')+' '+ls(st.pending.mv.san)+'</button><button class="btn ghost" data-l="takeback">↶ '+t('Take back')+'</button></div>';
      else h+='<div class="msg info">'+(turn===G.kid?t('Your move.'):'<span class="spin"></span> '+t('Stockfish is thinking…'))+'</div>';
      h+='<div class="btns"><button class="btn ghost sm" data-l="resign">🏳 '+t('Resign')+'</button></div>';
      return h;
    }
    if(st.view==='nb'){
      var nd=notesDone(), g2=new Chess(), hist=[];
      G.moves.forEach(function(s){ var m=tryMove(g2,s); hist.push(m); });
      var pg=new Chess(); for(var i=0;i<G.ply;i++) tryMove(pg,G.moves[i]);
      st.nbGame=pg; st.nbLast=G.ply?hist[G.ply-1]:null;
      var note=G.notes[G.ply]||{};
      h+='<div class="lbar"><span class="pill">'+G.result+'</span><span data-nbcount class="pill '+(nd>=3?'g':'y')+'">📓 '+t('{n}/3 key moments',{n:nd})+'</span><span class="pill" data-clock="nb">'+mmss(st.nbc.secs())+' / 45:00</span></div>';
      h+='<div id="nbb"></div>';
      h+='<div class="btns"><button class="btn ghost sm" data-l="nav" data-v="0">⏮</button><button class="btn ghost sm" data-l="nav" data-v="-1">◀</button><button class="btn ghost sm" data-l="nav" data-v="1">▶</button><button class="btn ghost sm" data-l="nav" data-v="999">⏭</button></div>';
      h+='<div class="mlist">'+G.moves.map(function(s,i){ var n=G.notes[i+1]; return (i%2===0?'<b>'+(i/2+1)+'.</b> ':'')+'<span data-l="goto" data-v="'+(i+1)+'" class="'+(G.ply===i+1?'cur ':'')+(n&&n.tag?'tag ':'')+(n&&noteDone(n)?'nt':'')+'">'+esc(ls(s))+(n&&n.tag?n.tag:'')+'</span>'; }).join(' ')+'</div>';
      if(G.ply>0){
        var mv=hist[G.ply-1];
        h+='<div class="card"><h2>✏️ '+t('After')+' '+Math.ceil(G.ply/2)+(G.ply%2?'. ':'… ')+esc(ls(mv.san))+'</h2>';
        h+='<div class="fld">'+t('Candidate moves I considered here')+'<input data-n="cand" value="'+esc(note.cand||'')+'" placeholder="'+t('e.g. Nf5, Qg4, h4')+'"></div>';
        h+='<div class="fld" style="margin-top:8px">'+t('My evaluation')+'</div><div class="evals">'+EVALS.map(function(e){return '<button data-l="ev" data-v="'+e[0]+'" class="'+(note.ev===e[0]?'on':'')+'" title="'+t(e[1])+'">'+e[0]+'</button>'}).join('')+'</div>';
        h+='<div class="fld" style="margin-top:8px">'+t('What I was thinking')+'<textarea data-n="cmt" placeholder="'+t('Plans, threats, what I missed…')+'">'+esc(note.cmt||'')+'</textarea></div>';
        if(mv.color===G.kid) h+='<div class="fld" style="margin-top:8px">'+t('Tag my move')+'</div><div class="evals">'+[['','No tag'],['?','? mistake'],['??','?? blunder']].map(function(tg){return '<button data-l="tag" data-v="'+tg[0]+'" class="'+((note.tag||'')===tg[0]?'on':'')+'">'+t(tg[1])+'</button>'}).join('')+'</div>';
        h+='</div>';
      } else h+='<div class="hint">'+t('Step through the game (▶) and stop at the key turning points. For each one, write your candidate moves and your evaluation — no engine!')+'</div>';
      h+='<div class="card"><h2>🔒 Stockfish</h2>';
      if(G.review&&G.review.done){ h+='<p class="sub">'+t('Engine check done.')+'</p><button class="btn blue" style="width:100%" data-l="showrev">'+t('Show engine review')+'</button>'; }
      else if(nd>=3) h+='<p class="sub">'+t('Your notebook page is full — you’ve earned the engine!')+'</p><button class="btn blue" style="width:100%" data-l="unlock">🔓 '+t('Unlock Stockfish review')+'</button>';
      else h+='<p class="sub">'+t('Engine Delay Rule: fill your notebook page first. Key moments still needed (with candidate moves and an evaluation): {n}.',{n:'<b>'+(3-nd)+'</b>'})+'</p>';
      h+='</div><button class="btn go" style="margin-top:12px" data-l="log">'+t('Finish & log weekend session')+' →</button>';
      return h;
    }
    if(st.view==='review'){
      var R=G.review;
      h+='<div class="card"><h2>🤖 '+t('Engine review')+'</h2>';
      if(st.engineFail) h+=engineError();
      if(!R.done){ h+='<p class="sub"><span class="spin"></span> '+t('Stockfish is checking every move…')+'</p><div class="prog"><i id="rvp" style="width:'+Math.round(R.progress*100)+'%"></i></div></div>'; return h; }
      var ms=mistakes(), found=ms.filter(function(m){return m.tagged}).length, tags=Object.keys(G.notes).filter(function(k){return G.notes[k].tag}).length;
      h+=evalChart();
      h+='<div class="stats"><div class="stat"><b>'+ms.length+'</b><span>'+t('engine mistakes')+'</span></div><div class="stat"><b>'+found+'</b><span>'+t('you spotted')+'</span></div><div class="stat"><b>'+tags+'</b><span>'+t('you tagged')+'</span></div></div>';
      h+='<div class="list" style="margin-top:12px">'+(ms.length?ms.map(function(m){return '<button class="item" data-l="goto" data-v="'+m.ply+'"><div><b>'+Math.ceil(m.ply/2)+(m.ply%2?'. ':'… ')+esc(ls(m.san))+m.tag+'</b><div class="sub">'+t('Lost about {p} pawns · better: {m}',{p:(m.drop/100).toFixed(1),m:esc(ls(m.best))})+'</div></div>'+(m.tagged?'<span class="tick">✓ '+t('spotted')+'</span>':'')+'</button>'}).join(''):'<p class="sub">'+t('No big mistakes found. Excellent game!')+'</p>')+'</div>';
      h+='<div class="btns"><button class="btn ghost" data-l="tonb">'+t('Back to notebook')+'</button></div></div><button class="btn go" style="margin-top:12px" data-l="log">'+t('Finish & log weekend session')+' →</button>';
      return h;
    }
    return h;
  };
  L.mount=function(c){
    var G=st.G;
    var pb=$('#pb',c); if(pb){ var g=st.pending?st.pending.g:curGame(); var b=boardFor(pb,{flip:G.kid==='b',movable:(!st.pending&&!G.result&&g.turn()===G.kid)?G.kid:null,onMove:kidMove}); b.set(g,st.pending?{from:st.pending.mv.from,to:st.pending.mv.to}:st.lastMove); }
    var eb=$('#eb',c); if(eb){ var b2=boardFor(eb,{flip:st.entry.kid==='b',movable:'both',onMove:function(m){ var mv=tryMove(st.entry.g,m); if(mv){ st.entry.last=mv; } lr(); }}); b2.set(st.entry.g,st.entry.last); }
    var nb=$('#nbb',c); if(nb){ var b3=boardFor(nb,{flip:G.kid==='b'}); b3.set(st.nbGame,st.nbLast); }
    $$('[data-n]',c).forEach(function(inp){ inp.addEventListener('input',function(){ var n=G.notes[G.ply]=G.notes[G.ply]||{}; n[inp.getAttribute('data-n')]=inp.value; persist(); var pill=$('[data-nbcount]'); if(pill){ var k=notesDone(); pill.textContent='📓 '+t('{n}/3 key moments',{n:k}); pill.className='pill '+(k>=3?'g':'y'); } }); });
  };
  L.tick=function(){
    var G=st.G; if(!G) return;
    if(st.view==='play'&&!G.result&&L.isOn){
      var g=curGame(), tn=g.turn(), now=Date.now(); G.clock[tn]-=now-(st.lastTs||now); st.lastTs=now;
      if(G.clock[tn]<=0){ G.clock[tn]=0; endGame(tn==='w'?'0-1':'1-0','time'); return; }
      if(tn===G.kid&&G.clock[tn]<30000&&!G.lowWarned){ G.lowWarned=true; Sound.play('LowTime'); }
      ['w','b'].forEach(function(cl){ var e=$('[data-clock="'+cl+'"]'); if(e){ e.lastChild.textContent=mmss(G.clock[cl]/1000); e.classList.toggle('low',G.clock[cl]<60000); } });
      if(now%5000<1000) persist();
    }
    var nbc=$('[data-clock="nb"]'); if(nbc) nbc.textContent=mmss(st.nbc.secs())+' / 45:00';
  };
  L.act=function(a,el){
    var G=st.G, v=el&&el.getAttribute('data-v');
    if(a==='cfg'){ st.cfg[el.getAttribute('data-k')]=v; lr(); }
    else if(a==='play') startPlay();
    else if(a==='resume'){ st.G=saved; if(st.G.result){ st.view='nb'; if(!st.G.nbStart) st.G.nbStart=Date.now(); } else { st.view='play'; st.lastTs=Date.now(); maybeEngine(); } lr(); }
    else if(a==='discard'){ lsSet(K('wk'),null); saved=null; lr(); }
    else if(a==='enter'){ st.entry={g:new Chess(),kid:'w',res:'1-0',tc:'15+10',last:null}; st.view='enter'; lr(); }
    else if(a==='loadpgn'){ var txt=$('#pgnin').value; var g=new Chess(); try{ g.loadPgn(txt); st.entry.g=g; var hd=(g.getHeaders?g.getHeaders():g.header())||{}; if(hd.Result&&hd.Result!=='*') st.entry.res=hd.Result; lr(); toast(t('Game loaded: {n} half-moves',{n:g.history().length})); }catch(e){ toast(t('That PGN could not be read')); } }
    else if(a==='undo'){ st.entry.g.undo(); st.entry.last=null; lr(); }
    else if(a==='ecol'){ st.entry.kid=v; lr(); } else if(a==='eres'){ st.entry.res=v; lr(); } else if(a==='etc'){ st.entry.tc=v; lr(); }
    else if(a==='edone'){ var e=st.entry; st.G={id:uid(),source:'entered',moves:e.g.history(),kid:e.kid,tc:e.tc,result:e.res,notes:{},ply:0,unlocked:false,review:null,startedAt:Date.now(),nbStart:Date.now(),date:today()}; st.view='nb'; persist(); lr(); }
    else if(a==='confirm'){ var m=st.pending.m; st.pending=null; G.sohUsed=(G.sohUsed||0)+1; applyMove(m); }
    else if(a==='takeback'){ st.pending=null; lr(); }
    else if(a==='resign'){ endGame(G.kid==='w'?'0-1':'1-0','resigned'); }
    else if(a==='nav'){ var d=+v; G.ply=d===0?0:d===999?G.moves.length:Math.max(0,Math.min(G.moves.length,G.ply+d)); if(!G.nbStart) G.nbStart=Date.now(); persist(); lr(); }
    else if(a==='goto'){ G.ply=+v; st.view='nb'; persist(); lr(); }
    else if(a==='ev'){ var n=G.notes[G.ply]=G.notes[G.ply]||{}; n.ev=n.ev===v?'':v; persist(); lr(); }
    else if(a==='tag'){ var n2=G.notes[G.ply]=G.notes[G.ply]||{}; n2.tag=v; persist(); lr(); }
    else if(a==='unlock'){ G.unlocked=true; st.view='review'; runReview(); }
    else if(a==='showrev'){ st.view='review'; lr(); }
    else if(a==='tonb'){ st.view='nb'; lr(); }
    else if(a==='log'){
      var res=G.result, kidRes=res==='1/2-1/2'?'draw':((res==='1-0')===(G.kid==='w')?'win':'loss');
      var tags=Object.keys(G.notes).filter(function(k){return G.notes[k].tag}).length, nd=notesDone();
      var nb={date:G.date,source:G.source,kid:G.kid,tc:G.tc,result:res,moves:G.moves,notes:G.notes,level:G.level||null,review:G.review&&G.review.done?{evals:G.review.evals,mistakes:mistakes()}:null};
      Store.saveNotebook(G.id,nb);
      G.finished=true; lsSet(K('wk'),null);
      finishLesson('wk',{min:L.clock.min(),tc:G.tc==='Other'?'Other':G.tc,res:kidRes,bl:tags,engine:G.unlocked&&nd>=3,
        parts:[G.moves.length>=20,G.source==='app'&&G.soh,nd>=3],extra:{nb:G.id},note:(G.source==='app'?'Stockfish L'+G.level:t('Entered game'))+' · '+res+' · '+t('{n} notebook moments',{n:nd})});
    }
  };
  L.change=function(a,el){ if(a==='level'){ st.cfg.level=+el.value; lr(); } else if(a==='soh'){ st.cfg.soh=el.checked; } };
  L.active=function(){ return st.view!=='menu'&&!!st.G; };
  L.onClock=function(on){ st.nbc.set(on&&(st.view==='nb'||st.view==='review')); if(!on) st.lastTs=0; else if(!st.lastTs) st.lastTs=Date.now(); };
  L.finish=function(){ if(!st.G||!st.G.result) return false; L.act('log'); return true; };
  L.saved=function(){ return !!(st.G&&!st.G.result); };
  return L;
}
window.__L=function(){return L};
