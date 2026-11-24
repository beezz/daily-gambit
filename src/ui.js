/* Daily Gambit — screens, log form, rewards, settings, events */

var draft={slot:SLOTS[slotIdxOf(new Date())].k}, pendingDel=null, pendingCycle=false, overlay=null, pendingGive=null, resetWord='';
var TABS=[['today','♟','Today'],['week','📅','Week'],['woodpecker','🐦','Puzzles'],['openings','📖','Openings'],['prizes','🎁','Prizes'],['history','📜','Log']];
var MASCOT='<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="113" rx="34" ry="5" fill="#000" opacity=".08"/><path d="M86 100 q26 4 24 -22 q-2 -10 -8 -8 q4 14 -18 18 Z" fill="#7a5233"/><ellipse cx="60" cy="88" rx="31" ry="25" fill="#8b5e3c"/><ellipse cx="60" cy="92" rx="20" ry="19" fill="#f0d9b5"/><circle cx="35" cy="28" r="8" fill="#8b5e3c"/><circle cx="35" cy="28" r="4" fill="#5c3d24"/><circle cx="85" cy="28" r="8" fill="#8b5e3c"/><circle cx="85" cy="28" r="4" fill="#5c3d24"/><circle cx="60" cy="48" r="29" fill="#a0714b"/><ellipse cx="60" cy="60" rx="21" ry="15" fill="#f0d9b5"/><circle cx="47" cy="44" r="5.5" fill="#3b2a1d"/><circle cx="73" cy="44" r="5.5" fill="#3b2a1d"/><circle cx="48.8" cy="42.2" r="1.9" fill="#fff"/><circle cx="74.8" cy="42.2" r="1.9" fill="#fff"/><circle cx="39" cy="56" r="4.5" fill="#e8a08a" opacity=".55"/><circle cx="81" cy="56" r="4.5" fill="#e8a08a" opacity=".55"/><ellipse cx="60" cy="54" rx="6.5" ry="4.5" fill="#3b2a1d"/><ellipse cx="58" cy="52.8" rx="2" ry="1.1" fill="#fff" opacity=".6"/><path d="M54 61 q3 4 6 0 q3 4 6 0" stroke="#3b2a1d" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M45 58 L31 55 M45 61 L31 63 M75 58 L89 55 M75 61 L89 63" stroke="#5c3d24" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><g transform="translate(60 92)"><circle cx="0" cy="-12" r="5.5" fill="#fff" stroke="#5c3d24" stroke-width="1.8"/><path d="M-4 -6 h8 l3 12 h-14 Z" fill="#fff" stroke="#5c3d24" stroke-width="1.8" stroke-linejoin="round"/><rect x="-9" y="5" width="18" height="5" rx="2" fill="#fff" stroke="#5c3d24" stroke-width="1.8"/></g><ellipse cx="46" cy="90" rx="8" ry="6" fill="#7a5233"/><ellipse cx="74" cy="90" rx="8" ry="6" fill="#7a5233"/><ellipse cx="46" cy="108" rx="9" ry="5" fill="#7a5233"/><ellipse cx="74" cy="108" rx="9" ry="5" fill="#7a5233"/></svg>';
function tab(){var h=(location.hash||'').slice(1); if(h==='lesson') return L?'lesson':'today'; if(h==='users') return 'users'; return TABS.some(function(x){return x[0]===h})?h:'today'}
function rewardName(r){ return r.name||t('Pokémon card pack'); }
function catalog(){ return (S.catalog&&S.catalog.length)?S.catalog:DEFAULT_CATALOG; }

function render(){
  var c=compute(), tb=tab(), root=document.getElementById('root');
  var h='<div class="wrap">';
  if(tb==='lesson'){
    h+='<div class="lhead"><button class="back" data-act="leave" aria-label="'+t('Back')+'">←</button><h2>'+esc(L.title)+'</h2>'+
       '<span class="aclk" title="'+esc(t('Only exercise time counts'))+'">⏱ <b data-clock="active">'+mmss(L.clock?L.clock.secs():0)+'</b></span>'+
       '<button class="back hb" data-act="pause" aria-label="'+t('Pause')+'" title="'+t('Pause')+'">⏸</button>'+
       '<button class="back hb" data-act="end" aria-label="'+t('End & log')+'" title="'+t('End & log')+'">⏹</button></div>'+
       '<div id="pausebox" class="card pausebox"'+(L.paused?'':' hidden')+'><div class="pz">⏸</div><h3>'+t('Paused')+'</h3>'+
       '<p class="muted">'+t('The clock is stopped. Only time spent on exercises counts.')+'</p>'+
       '<div class="row"><button class="btn play big" data-act="unpause">▶ '+t('Resume')+'</button>'+
       '<button class="btn ghost" data-act="end">⏹ '+t('End & log')+'</button></div></div>'+
       '<div id="lesson"'+(L.paused?' hidden':'')+'></div>';
  } else {
    var pct=c.next?Math.round((c.xp-c.rank.xp)/(c.next.xp-c.rank.xp)*100):100;
    var owed=REWARDS.filter(function(r){return r.status==='earned'||r.status==='unpicked'}).length;
    h+='<div class="langs">'+['sk','de','en'].map(function(l){return '<button data-act="lang" data-v="'+l+'" class="'+(LANG===l?'on':'')+'">'+l.toUpperCase()+'</button>'}).join('')+'</div>';
    h+='<header class="hero"><div class="avatar">'+pc(c.rank.p)+'</div><div class="hinfo"><a class="pname" href="#users" title="'+esc(t('Players'))+'">'+esc(S.player)+((USERS&&USERS.length>1)?' <span class="sw">⇄</span>':'')+'</a>'+
       '<div class="rank">'+t(c.rank.n)+' · '+c.xp.toLocaleString(LOCALES[LANG])+' XP</div><div class="bar"><i style="width:'+pct+'%"></i></div>'+
       '<div class="small">'+(c.next?t('{n} XP to {r}',{n:(c.next.xp-c.xp).toLocaleString(LOCALES[LANG]),r:t(c.next.n)}):t('Top rank reached!'))+'</div></div>'+
       '<div class="hstats"><div class="streak"><b>🔥 '+c.cur+'</b><span>'+t('streak')+'</span></div>'+(owed?'<a class="streak gift" href="#prizes"><b>🎁 '+owed+'</b><span>'+t('prizes')+'</span></a>':'')+'</div></header>';
    if(Store.mode==='local') h+='<div class="banner">'+t('Preview mode: progress is kept only in this browser. Open the published app to save it for good.')+'</div>';
    if(Store.mode==='device'&&S.sessions.length>=5&&(!S.lastBackup||Date.now()-S.lastBackup>14*86400000)) h+='<a class="banner" style="display:block;color:inherit;text-decoration:none" href="#history">💾 '+t('It’s been a while since the last backup. Save one in the Log tab.')+'</a>';
    if(Store.mode==='readonly') h+='<div class="banner">'+t('View only — you can see progress, but only the owner can log sessions.')+'</div>';
    if(Store.mode==='live'&&Store.slow) h+='<div class="banner">'+t('Can’t reach saved progress yet — what you see may be out of date.')+'</div>';
    h+= tb==='today'?vToday(c): tb==='week'?vWeek(c): tb==='woodpecker'?vWood(c): tb==='prizes'?vPrizes(c): tb==='users'?vUsers(): tb==='openings'?vOpenings(): vHistory(c);
    h+='<div class="credits">'+t('Board & pieces')+': <a href="https://github.com/lichess-org/chessground" target="_blank" rel="noopener">Lichess chessground</a> (GPLv3), Cburnett (CC BY-SA 3.0) · '+t('Sounds')+': Lichess SFX, Enigmahack (AGPLv3+) · '+t('Puzzles')+': <a href="https://database.lichess.org/" target="_blank" rel="noopener">Lichess</a> (CC0) · Stockfish 17.1 (GPLv3) · chess.js</div>';
  }
  h+='</div><nav><div class="in">'+TABS.map(function(x){return '<a href="#'+x[0]+'" class="'+(x[0]===tb?'on':'')+'"><span class="g">'+x[1]+'</span>'+t(x[2])+'</a>'}).join('')+'</div></nav>';
  if(overlay) h+=overlay();
  if(typeof freeBoards==='function') freeBoards(false);
  root.innerHTML=h;
  document.body.classList.toggle('inlesson',tb==='lesson');
  if(tb==='lesson') lr();
  if(tb==='today') updateLive();
}

function greeting(){ var hr=new Date().getHours(); return (hr>=5&&hr<11)?t('Good morning'):(hr>=11&&hr<18)?t('Hi'):t('Good evening'); }
function vToday(c){
  var sl=SL[draft.slot], curW=ymd(monday(new Date())), pend=PEND[sl.k], doneHere=c.filled[curW+'|'+sl.k]==='d';
  var todaySlot=SLOTS[slotIdxOf(new Date())].k;
  var say=doneHere?t('You already did this one this week. Amazing! 🌟'):(sl.k===todaySlot?t('Today’s mission: {m}. Ready?',{m:'<b>'+t(sl.title)+'</b>'}):t('Mission: {m}',{m:'<b>'+t(sl.title)+'</b>'}));
  var h='<div class="card mission"><div class="mrow"><div class="mascot">'+MASCOT+'</div><div class="bubble"><b>'+greeting()+', '+esc(S.player)+'!</b><br>'+say+'</div></div>';
  h+='<div class="chips">';
  SLOTS.forEach(function(s){
    var dn=c.filled[curW+'|'+s.k]==='d';
    h+='<button class="chip'+(s.k===draft.slot?' on':'')+(dn?' done':'')+(s.k===todaySlot?' today':'')+'" data-act="slot" data-k="'+s.k+'">'+pc(s.p)+'<span>'+t(s.day)+'</span></button>';
  });
  h+='</div><div class="mod"><div class="g">'+pc(sl.p)+'</div><div><h3>'+t(sl.title)+'</h3><div class="sub">⏱ '+t('{n} min',{n:sl.min})+'</div></div></div>';
  if(L && L.slot===sl.k) h+='<button class="btn play big" data-act="resume">▶ '+t('Continue lesson')+'</button>';
  else h+='<button class="btn play big" data-act="lesson">▶ '+t('Let’s go!')+'</button>';
  if(sl.k==='thu') h+='<button class="btn ghost sm" style="width:100%;margin-top:8px" data-act="coord">'+t('Just the coordinates quiz')+'</button>';
  h+='</div>';

  var P=pend||{}, parts=P.parts||[];
  var form='<form id="logform" autocomplete="off">';
  sl.parts.forEach(function(p,i){ form+='<label class="row"><input type="checkbox" name="p'+i+'"'+(parts[i]?' checked':'')+'><span>'+esc(t(p))+'</span></label>'; });
  form+='<div class="grid2"><label class="fld">'+t('Date')+'<input type="date" name="date" value="'+today()+'" max="'+today()+'"></label>'+
     '<label class="fld">'+t('Minutes')+'<input type="number" name="min" inputmode="numeric" min="0" max="300" value="'+(P.min||sl.min)+'"></label></div>';
  if(sl.kind==='wp'){
    var cyc=c.cycles[S.wpCycle-1];
    form+='<div class="grid2"><label class="fld">'+(sl.k==='thu'?t('Puzzles re-solved'):t('Puzzles solved'))+'<input type="number" name="n" inputmode="numeric" min="0" value="'+(P.n!=null?P.n:'')+'"></label>'+
       '<label class="fld">'+t('Correct')+'<input type="number" name="ok" inputmode="numeric" min="0" value="'+(P.ok!=null?P.ok:'')+'"></label></div>'+
       '<label class="fld">'+t('Minutes spent solving')+'<input type="number" name="wmin" inputmode="numeric" min="0" value="'+(P.wmin||(sl.k==='mon'?24:22))+'"></label>';
    if(sl.k==='mon') form+='<div class="hint">'+t('Round {r}: {a} / {b} puzzles so far.',{r:S.wpCycle,a:cyc.mon.n,b:S.setSize})+'</div>';
    else {
      var w=wkOf(today()), mons=S.sessions.filter(function(m){return m.slot==='mon'&&m.wp&&m.wp.n&&!m.excused&&wkOf(m.date)===w});
      var ms=wpStats(mons).spp;
      form+='<div class="hint">'+(ms?t('Monday pace: {a} s/puzzle. Target today: {b} s/puzzle or faster ⚡',{a:Math.round(ms),b:Math.round(ms/1.5)}):t('Log Monday’s set first to get a speed target.'))+'</div>';
    }
  } else if(sl.kind==='acc'){
    form+='<label class="fld">'+t(sl.accLabel)+' — '+t('optional')+'<input type="number" name="acc" inputmode="numeric" min="0" max="100" value="'+(P.acc!=null?P.acc:'')+'"></label>';
  } else {
    var tc=P.tc||'15+10', res=P.res||'';
    form+='<div class="grid2"><label class="fld">'+t('Time control')+'<select name="tc">'+['15+10','25+10','Other'].map(function(o){return '<option value="'+o+'"'+(o===tc?' selected':'')+'>'+t(o)+'</option>'}).join('')+'</select></label>'+
       '<label class="fld">'+t('Result')+'<select name="res">'+[['','—'],['win','Win'],['draw','Draw'],['loss','Loss']].map(function(o){return '<option value="'+o[0]+'"'+(o[0]===res?' selected':'')+'>'+(o[0]?t(o[1]):'—')+'</option>'}).join('')+'</select></label></div>'+
       '<label class="fld">'+t('Blunders tagged in notebook')+'<input type="number" name="bl" inputmode="numeric" min="0" value="'+(P.bl||0)+'"></label>'+
       '<label class="row"><input type="checkbox" name="engine"'+(P.engine?' checked':'')+'><span><b>'+t('Engine Delay Rule:')+'</b> '+t('filled at least one notebook page of candidate moves and evaluations before turning on Stockfish (+30 XP)')+'</span></label>';
  }
  form+='<div class="cb" id="cb"><b>🛑 '+t('Circuit break!')+'</b> '+t('Accuracy is under 70%. Stop the session now — focused calculation beats tired volume. Stopping is the smart move.')+
     '<label class="row" style="background:#fff"><input type="checkbox" name="stopped"'+(P.stopped?' checked':'')+'><span>'+t('We stopped the session (+30 XP Wise Stop 🦦)')+'</span></label></div>';
  form+='<label class="fld" style="margin-top:10px">'+t('Notes')+'<textarea name="note" placeholder="'+t('What went well? What was hard?')+'">'+esc(P.note||'')+'</textarea></label>';
  if(doneHere) form+='<div class="note">'+t('Already logged this week — this will count as an extra session.')+'</div>';
  var ro=Store.mode==='readonly'||(Store.mode==='live'&&!Store.loaded);
  form+='<div class="btns" style="flex-direction:column"><button class="btn go big" type="submit" id="go"'+(ro?' disabled':'')+'>'+t('Complete session')+'</button>'+
     '<button class="btn ghost" type="button" data-act="excuse"'+(ro?' disabled':'')+'>'+t('Rest / sick day (keeps the streak, no XP)')+'</button></div></form>';

  if(pend){
    h+='<div class="card"><h2>✅ '+t('Log the session')+'</h2><div class="prefill">✨ '+t('Filled in from your lesson')+(pend.n!=null?': '+pend.ok+'/'+pend.n:pend.acc!=null?': '+pend.acc+'%':'')+'. '+t('Check it and tap Complete.')+' <button class="btn ghost sm" data-act="clearpend">'+t('Clear')+'</button></div>'+form+'</div>';
  } else {
    h+='<div class="card"><details'+(draft.open?' open':'')+' data-act="openlog"><summary>📝 '+t('Did it on a real board? Log it here')+'</summary><div style="margin-top:12px">'+form+'</div></details></div>';
  }
  h+='<div class="card"><details><summary>📏 '+t('Non-negotiable rules')+'</summary><ul>'+
     '<li><b>'+t('Woodpecker rounds:')+'</b> '+t('track total time and accuracy per 200-puzzle round. Goal: −40% time in round 2, −70% in round 3, accuracy above 90%.')+'</li>'+
     '<li><b>'+t('Engine delay:')+'</b> '+t('no Stockfish on weekend analysis until a notebook page of candidate moves and evaluations is filled. (The app locks it for you.)')+'</li>'+
     '<li><b>'+t('Circuit break:')+'</b> '+t('if accuracy drops below 70% on a weekday, stop immediately.')+'</li></ul></details></div>';
  return h;
}

function readDraft(){
  var f=document.getElementById('logform'); if(!f) return null;
  var sl=SL[draft.slot], P=PEND[sl.k], g=function(n){var e=f.elements[n];return e?e.value:''}, ck=function(n){var e=f.elements[n];return !!(e&&e.checked)};
  var s={id:uid(),date:g('date')||today(),slot:sl.k,min:+g('min')||0,parts:sl.parts.map(function(_,i){return ck('p'+i)}),note:g('note').trim()};
  if(sl.kind==='wp'){ var n=+g('n')||0, ok=+g('ok')||0; if(n>0){ s.wp={n:n,ok:Math.min(ok,n),min:+g('wmin')||0,cycle:S.wpCycle}; if(P&&P.extra&&P.extra.items&&P.n===n){ s.wp.items=P.extra.items; s.wp.set=P.extra.set; } } }
  if(sl.kind==='acc' && g('acc')!=='') s.acc=Math.max(0,Math.min(100,+g('acc')));
  if(sl.kind==='game'){ s.tc=g('tc'); s.res=g('res'); s.blunders=+g('bl')||0; s.engine=ck('engine'); if(P&&P.extra&&P.extra.nb) s.nb=P.extra.nb; }
  s.stopped=ck('stopped');
  if(P) s.lesson=true;
  return s;
}
function updateLive(){
  var s=readDraft(); if(!s) return;
  var a=accOf(s), cb=document.getElementById('cb'), go=document.getElementById('go');
  if(cb) cb.classList.toggle('show', s.slot!=='wk' && a!=null && a<70);
  if(go) go.textContent=t('Complete session')+'  +'+sessionXP(s)+' XP'+(fullyDone(s)?' 🎁':'');
}
function fullyDone(s){ return !s.excused && !s.stopped && s.parts.length>0 && s.parts.every(Boolean); }

function vWeek(c){
  var mon=monday(new Date()), w=ymd(mon), ti=slotIdxOf(new Date()), mins=0, planned=SLOTS.reduce(function(a,s){return a+s.min},0);
  S.sessions.forEach(function(s){ if(!s.excused && wkOf(s.date)===w) mins+=(+s.min||0); });
  var doneN=SLOTS.filter(function(s){return c.filled[w+'|'+s.k]==='d'}).length;
  var h='<div class="card"><h2>📅 '+t('This week')+'</h2><div class="wboard">';
  SLOTS.forEach(function(s,i){
    var f=c.filled[w+'|'+s.k];
    h+='<div class="sq6'+(f?'':' empty')+(i===ti?' today':'')+'">'+t(s.day)+(f==='x'?'<span style="font-size:28px">☾</span>':pc(s.p))+(f==='d'?'⭐':'&nbsp;')+'</div>';
  });
  h+='</div><div class="stats"><div class="stat"><b>'+doneN+'/6</b><span>'+t('sessions')+'</span></div><div class="stat"><b>'+mins+'</b><span>'+t('of {n} min',{n:planned})+'</span></div><div class="stat"><b>'+(doneN===6?'🏆':t('{n} left',{n:6-doneN}))+'</b><span>'+t('perfect week +150')+'</span></div></div></div>';
  h+='<div class="card"><h2>'+t('Last 10 weeks')+'</h2><div class="heat"><span></span>'+SLOTS.map(function(s){return '<span class="lbl" style="text-align:center">'+t(s.day)+'</span>'}).join('');
  var first=S.sessions.length?S.sessions.map(function(s){return wkOf(s.date)}).sort()[0]:null;
  for(var k=0;k<10;k++){
    var wd=addDays(mon,-7*k), wk=ymd(wd);
    h+='<span class="lbl">'+wd.toLocaleDateString(LOCALES[LANG],{day:'numeric',month:'short'})+'</span>';
    SLOTS.forEach(function(s){
      var f=c.filled[wk+'|'+s.k], past=k>0&&first&&wk>=first;
      h+='<span class="c '+(f==='d'?'d':f==='x'?'x':(past?'m':''))+'"></span>';
    });
  }
  h+='</div><p class="note">'+t('Dark = done · light = rest day · pink = missed')+'</p>';
  h+='<div class="stats"><div class="stat"><b>'+c.perfect+'</b><span>'+t('perfect weeks')+'</span></div><div class="stat"><b>'+c.best+'</b><span>'+t('best streak')+'</span></div><div class="stat"><b>'+c.minutes.toLocaleString(LOCALES[LANG])+'</b><span>'+t('total minutes')+'</span></div></div></div>';
  return h;
}

function vWood(c){
  var cur=c.cycles[S.wpCycle-1], p=Math.min(100,Math.round(S.wpPos/S.setSize*100));
  var h='<div class="card"><h2>🐦 '+t('Woodpecker round {n}',{n:S.wpCycle})+'</h2><div class="prog"><i style="width:'+p+'%"></i></div>'+
        '<div class="sub">'+t('Puzzle {a} / {b}',{a:S.wpPos,b:S.setSize})+' · '+t('accuracy')+' '+(cur.mon.acc!=null?cur.mon.acc+'%':'—')+' · '+(cur.mon.spp?Math.round(cur.mon.spp):'—')+' '+t('s/puzzle')+'</div>';
  if(S.wpCycle>1){ h+='<div class="hint">'+t('Goal for this round: {p}% faster than round 1 while keeping accuracy above 90%.',{p:S.wpCycle===2?40:70})+'</div>'; }
  var locked=!(S.wpCycle===1&&S.wpPos===0);
  h+='<div class="fld" style="margin-top:10px">'+t('Puzzle set (fixed for all rounds)')+'</div><div class="seg">'+[['easy','Easy','1000–1200'],['medium','Medium','1200–1600'],['hard','Hard','1600–2000']].map(function(o){return '<button data-act="wpset" data-v="'+o[0]+'" class="'+(S.wpSet===o[0]?'on':'')+'"'+(locked&&S.wpSet!==o[0]?' disabled':'')+'>'+t(o[1])+'<br><small>'+o[2]+'</small></button>'}).join('')+'</div>';
  h+='<p class="note">'+(locked?t('The set is locked: Woodpecker repeats the same 200 puzzles every round.'):t('Pick before the first session. Ratings are Lichess puzzle ratings.'))+'</p></div>';
  var c1=c.cycles[0].mon.spp, maxV=Math.max.apply(null,c.cycles.map(function(x){return x.mon.spp||0}).concat([c1||60]));
  var W=640,H=230,pl=44,pb=34,cols=Math.max(3,c.cycles.length),bw=Math.min(110,(W-pl-20)/cols-24);
  var y=function(v){return H-pb-(v/maxV)*(H-pb-20)};
  var F='font-family="Nunito,system-ui,sans-serif"';
  var svg='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+t('Seconds per puzzle by round')+'"><line x1="'+pl+'" y1="'+(H-pb)+'" x2="'+(W-10)+'" y2="'+(H-pb)+'" stroke="#ecdcc6"/>';
  for(var i=0;i<cols;i++){
    var x=pl+12+i*((W-pl-20)/cols), cy=c.cycles[i], v=cy?cy.mon.spp:null;
    if(c1&&i>0){ var tg=c1*(i===1?0.6:0.3), ty=y(tg); svg+='<line x1="'+(x-6)+'" x2="'+(x+bw+6)+'" y1="'+ty+'" y2="'+ty+'" stroke="#5c3d24" stroke-width="3" stroke-dasharray="6 4"/><text x="'+(x+bw+8)+'" y="'+(ty+4)+'" font-size="12" fill="#5c3d24" '+F+'>'+t('goal')+'</text>'; }
    if(v){ svg+='<rect x="'+x+'" y="'+y(v)+'" width="'+bw+'" height="'+(H-pb-y(v))+'" rx="8" fill="'+(cy.hit?'#5c3d24':'#b58863')+'"/><text x="'+(x+bw/2)+'" y="'+(y(v)-6)+'" text-anchor="middle" font-size="13" font-weight="800" '+F+' fill="#3b2a1d">'+Math.round(v)+'s</text>'; }
    svg+='<text x="'+(x+bw/2)+'" y="'+(H-12)+'" text-anchor="middle" font-size="13" '+F+' fill="#8a7360">'+t('Round {n}',{n:i+1})+'</text>';
  }
  svg+='<text x="8" y="16" font-size="12" '+F+' fill="#8a7360">'+t('sec / puzzle')+'</text></svg>';
  h+='<div class="card"><h2>📈 '+t('Wall chart')+'</h2><div class="sub">'+t('Lower is better. Bars turn dark when a goal is hit.')+'</div>'+svg+'</div>';
  h+='<div class="card"><h2>'+t('Rounds')+'</h2><table><tr><th>'+t('Round')+'</th><th>'+t('Puzzles')+'</th><th>'+t('Acc.')+'</th><th>'+t('s/puzzle')+'</th><th>'+t('vs R1')+'</th></tr>';
  c.cycles.forEach(function(cy){
    var vs=cy.ratio!=null?('−'+Math.round((1-cy.ratio)*100)+'%'):'—';
    h+='<tr><td>'+cy.k+(cy.complete?' ✓':'')+'</td><td>'+cy.mon.n+'</td><td class="'+(cy.mon.acc==null?'':cy.mon.acc>=90?'ok':'bad')+'">'+(cy.mon.acc!=null?cy.mon.acc+'%':'—')+'</td><td>'+(cy.mon.spp?Math.round(cy.mon.spp):'—')+'</td><td class="'+(cy.hit?'ok':'')+'">'+vs+'</td></tr>';
  });
  h+='</table><p class="note">'+t('Monday sessions move through the set. Thursday re-solves track speed (Speedster badge at 1.5×).')+'</p>';
  if(Store.mode!=='readonly') h+='<div class="btns"><button class="btn '+(pendingCycle?'warn':'ghost')+' sm" data-act="cycle">'+(pendingCycle?t('Tap again to start round {n}',{n:S.wpCycle+1}):t('Start next round early'))+'</button></div>';
  h+='</div>';
  return h;
}

function vPrizes(c){
  var unp=REWARDS.filter(function(r){return r.status==='unpicked'}), owed=REWARDS.filter(function(r){return r.status==='earned'}), given=REWARDS.filter(function(r){return r.status==='given'});
  var h='<div class="card"><h2>🎁 '+t('My prizes')+'</h2>';
  h+='<p class="sub">'+t('Finish every part of a session to win a prize!')+'</p>';
  if(unp.length) h+='<div class="hint">🎉 '+t('Prizes waiting to be picked: {n}',{n:unp.length})+' <button class="btn play sm" data-act="pickfor" data-id="'+unp[0].id+'">'+t('Pick now')+'</button></div>';
  if(owed.length){ h+='<h3 class="h3">'+t('To collect')+'</h3><div class="list">';
    owed.forEach(function(r){ h+='<div class="coupon"><div class="ci">'+esc(r.icon)+'</div><div class="cm"><b>'+esc(r.name)+'</b><div class="sub">'+fmtDate(r.date)+'</div></div>'+(Store.mode!=='readonly'?'<button class="btn '+(pendingGive===r.id?'warn':'ghost')+' sm" data-act="give" data-id="'+r.id+'">'+(pendingGive===r.id?t('Tap again'):t('Parent: given ✓'))+'</button>':'')+'</div>'; });
    h+='</div>'; }
  if(!unp.length&&!owed.length) h+='<div class="empty">🎴 '+t('No prizes waiting. Finish a whole session to earn one!')+'</div>';
  if(given.length){ h+='<details style="margin-top:12px"><summary>'+t('Collected ({n})',{n:given.length})+'</summary><div class="list" style="margin-top:8px">';
    given.slice().sort(function(a,b){return (b.givenAt||0)-(a.givenAt||0)}).forEach(function(r){ h+='<div class="coupon done"><div class="ci">'+esc(r.icon)+'</div><div class="cm"><b>'+esc(r.name)+'</b><div class="sub">'+fmtDate(r.date)+' · ✓ '+t('collected')+'</div></div></div>'; });
    h+='</div></details>'; }
  h+='</div>';
  h+='<div class="card"><h2>🏅 '+t('Badges')+' · '+c.badges.length+' / '+BADGES.length+'</h2><div class="badges">';
  BADGES.forEach(function(b){ var on=c.badges.indexOf(b.id)>=0; h+='<div class="badge'+(on?'':' lock')+'"><div class="g">'+b.g+'</div><b>'+t(b.n)+'</b><span>'+t(b.d)+'</span></div>'; });
  h+='</div></div><div class="card"><h2>♛ '+t('Ranks')+'</h2><table>';
  RANKS.forEach(function(r){ h+='<tr><td>'+pc(r.p,'tpc')+' '+t(r.n)+'</td><td>'+r.xp.toLocaleString(LOCALES[LANG])+' XP</td></tr>'; });
  h+='</table><p class="note">'+t('XP: 50 per weekday session (80 weekend) · +10 per completed part · +10 when trained in the app · +20 for 90%+ accuracy · +30 Wise Stop · +30 engine delay · +5 per tagged blunder · +150 perfect week · +200 per Woodpecker round · +200 per speed goal hit.')+'</p></div>';
  return h;
}

function vHistory(c){
  var list=S.sessions.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0});
  var h='<div class="card"><h2>📜 '+t('Session log')+'</h2>';
  if(Store.mode==='live'&&!Store.loaded) h+='<p class="sub"><span class="spin"></span> '+t('Loading…')+'</p>';
  else if(!list.length) h+='<p class="sub">'+t('No sessions yet — start a lesson on the Today tab.')+'</p>';
  list.forEach(function(s){
    var sl=SL[s.slot], a=accOf(s), bits=[fmtDate(s.date)];
    if(s.excused) bits.push(t('rest day')); else bits.push(t('{n} min',{n:s.min}));
    if(a!=null) bits.push(a+'%');
    if(s.wp) bits.push(t('{n} puzzles (R{r})',{n:s.wp.n,r:s.wp.cycle}));
    if(s.res) bits.push(t(s.res==='win'?'Win':s.res==='draw'?'Draw':'Loss'));
    if(s.lesson) bits.push(t('in app'));
    if(s.stopped&&a!=null&&a<70) bits.push('🦦 '+t('stopped'));
    if(s.engine) bits.push('⏳ '+t('engine delay'));
    if(s.reward) bits.push('🎁');
    h+='<div class="hist"><div class="g">'+(s.excused?'☾':pc(sl.p))+'</div><div class="m"><div>'+t(sl.title)+'</div><div>'+esc(bits.join(' · '))+'</div>'+(s.note?'<div>“'+esc(s.note)+'”</div>':'')+(s.nb?'<div><a href="#history" data-act="nb" data-id="'+s.nb+'">📓 '+t('Open notebook')+'</a></div>':'')+'</div>'+
       '<div style="text-align:right"><div class="xp">+'+sessionXP(s)+'</div>'+(Store.mode!=='readonly'?'<button class="btn '+(pendingDel===s.id?'warn':'ghost')+' sm" data-act="del" data-id="'+s.id+'" style="margin-top:4px">'+(pendingDel===s.id?t('Confirm'):t('Delete'))+'</button>':'')+'</div></div>';
  });
  h+='</div>';
  if(Store.mode!=='readonly'){
    h+='<a class="card plink" href="#users"><span class="pi">👥</span><span><b>'+t('Players')+'</b><br><span class="sub">'+t('Switch, add or delete players')+' · '+t('Now playing: {n}',{n:esc(S.player)})+'</span></span><span class="go">›</span></a>';
    h+='<div class="card"><h2>⚙️ '+t('Settings')+'</h2><form id="settings"><div class="grid2"><label class="fld">'+t('Player name')+'<input name="player" maxlength="30" value="'+esc(S.player)+'"></label>'+
      '<label class="fld">'+t('Endgame Stockfish level (0–20)')+'<input name="skill" type="number" min="0" max="20" value="'+S.skill+'"></label></div>'+
      '<label class="fld">'+t('Language')+'<select name="lang">'+[['sk','Slovenčina'],['de','Deutsch'],['en','English']].map(function(o){return '<option value="'+o[0]+'"'+(LANG===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label>'+
      '<label class="row"><input type="checkbox" name="sound"'+(S.sound!==false?' checked':'')+'><span>'+t('Move sounds (Lichess “SFX” sound set)')+'</span></label><button class="btn sm" type="submit">'+t('Save settings')+'</button></form></div>';
    h+='<div class="card"><h2>🎁 '+t('Prize list (for parents)')+'</h2><p class="sub">'+t('After every fully finished session, your child picks one of these. You mark it as given when you hand it over.')+'</p><div class="list">';
    catalog().forEach(function(r){ h+='<div class="coupon"><div class="ci">'+esc(r.icon)+'</div><div class="cm"><b>'+esc(rewardName(r))+'</b></div>'+(catalog().length>1?'<button class="btn ghost sm" data-act="rmprize" data-id="'+r.id+'">'+t('Remove')+'</button>':'')+'</div>'; });
    h+='</div><form id="addprize" class="addprize"><input name="icon" maxlength="4" value="🎁" aria-label="'+t('Icon')+'"><input name="name" maxlength="40" placeholder="'+t('e.g. Ice cream, 30 min tablet time')+'" required><button class="btn sm" type="submit">'+t('Add')+'</button></form></div>';
    var lb=S.lastBackup?Math.floor((Date.now()-S.lastBackup)/86400000):null;
    h+='<div class="card"><h2>💾 '+t('Backup')+'</h2><p class="sub">'+(Store.mode==='device'?t('Progress is saved on this device. Keep a backup file in case the phone is lost or the app is removed.'):t('Save a copy of all progress, or move it to another device or to the offline app.'))+'</p>'+
      '<p class="note">'+t('Last backup:')+' <b>'+(lb==null?t('never'):lb===0?t('today'):t('{n} days ago',{n:lb}))+'</b></p>'+
      '<div class="btns"><button class="btn" data-act="export">'+(canDownload()?'⬇️ '+t('Download backup'):'📋 '+t('Copy backup'))+'</button><button class="btn ghost" data-act="import">♻️ '+t('Restore from backup…')+'</button></div></div>';
    h+='<div class="card" id="offcard"><h2>📴 '+t('Offline')+'</h2><p class="sub"><span class="spin"></span> '+t('Checking…')+'</p></div>';
    setTimeout(fillOffline,0);
    h+='<div class="card danger"><h2>🗑 '+t('Delete all data')+'</h2><p class="sub">'+t('Removes all sessions, puzzle progress, prizes, badges progress and game notebooks. This cannot be undone.')+'</p><button class="btn warn" data-act="reset1">'+t('Delete all data…')+'</button></div>';
  }
  return h;
}

/* ---------- offline readiness (Log tab) ---------- */
function fillOffline(){
  var el=document.getElementById('offcard'); if(!el) return;
  var put=function(body){ var e=document.getElementById('offcard'); if(e) e.innerHTML='<h2>📴 '+t('Offline')+'</h2>'+body; };
  if(Store.mode==='live'||Store.mode==='local'){ put('<p class="sub">'+t('Inside Claude the app needs a connection. For offline use, install the app from its website (Daily Gambit on your own address).')+'</p>'); return; }
  if(!window.dgOffline){ put('<p class="sub">'+t('This browser can’t keep the app for offline use.')+'</p>'); return; }
  window.dgOffline.info().then(function(i){
    var h='';
    if(!i.supported) h='<p class="sub">'+t('This browser can’t keep the app for offline use.')+'</p>';
    else if(!i.controlled||!i.cache) h='<p class="msg no">⏳ '+t('Not ready for offline use yet. Keep the app open with internet for a minute, then close and reopen it.')+'</p>';
    else if(i.cache.missing.length) h='<p class="msg no">⚠️ '+t('{n} of {m} files are missing — the app may not open without internet.',{n:i.cache.missing.length,m:i.cache.total})+'</p><button class="btn" data-act="offfill">⬇️ '+t('Download missing files')+'</button>';
    else h='<p class="msg ok">✅ '+t('Ready for offline use: all {n} files are saved on this device.',{n:i.cache.total})+'</p>';
    if(i.updateFailed) h+='<p class="note">'+t('A new version could not be downloaded — the website login has probably expired. Open the app with internet and log in again. Until then this version keeps working offline.')+'</p>';
    if(i.cache) h+='<p class="note">'+t('Version')+' '+esc(i.cache.version)+(i.online?'':' · '+t('offline now'))+'</p>';
    put(h);
  });
}
function offFill(btn){
  if(!window.dgOffline) return; if(btn){ btn.disabled=true; btn.innerHTML='<span class="spin"></span> '+t('Downloading…'); }
  window.dgOffline.refill().then(function(r){
    if(r&&r.errors&&r.errors.some(function(e){return e.indexOf('login')===0;})) toast(t('The website login has expired. Open the app with internet, log in, and try again.'));
    else if(r&&r.missing&&!r.missing.length) toast('✅ '+t('Ready for offline use'));
    else toast(t('Some files could not be downloaded. Check the internet connection.'));
    fillOffline();
  });
}

/* ---------- players page ---------- */
function vUsers(){
  var list=USERS||[], ro=Store.mode==='readonly';
  var h='<div class="lhead"><a class="back" href="#history" aria-label="'+t('Back')+'" style="display:grid;place-items:center;text-decoration:none;color:inherit">←</a><h2>👥 '+t('Players')+'</h2></div>';
  h+='<div class="card"><p class="sub">'+t('Each player has their own sessions, puzzle progress, prizes and notebooks. The chosen player is remembered on this device.')+'</p><div class="list">';
  if(!USERS) h+='<p class="sub"><span class="spin"></span> '+t('Loading…')+'</p>';
  list.forEach(function(u){
    var me=u.id===UID, nm=Store.userName(u);
    h+='<div class="urow'+(me?' me':'')+'"><div class="uav">'+esc((nm||'?').trim().charAt(0).toUpperCase())+'</div><div class="um"><b>'+esc(nm)+'</b>'+(me?'<span class="tag">'+t('Playing now')+'</span>':'')+'</div>'+
       (me?'':'<button class="btn sm" data-act="uswitch" data-id="'+esc(u.id)+'">'+t('Switch')+'</button>')+
       (!ro&&list.length>1?'<button class="btn ghost sm" data-act="udel" data-id="'+esc(u.id)+'" aria-label="'+t('Delete player')+'">🗑</button>':'')+'</div>';
  });
  h+='</div>';
  if(!ro) h+='<form id="adduser" class="addprize"><input name="name" maxlength="30" placeholder="'+t('New player name')+'" required><button class="btn sm" type="submit">＋ '+t('Add player')+'</button></form>';
  h+='</div>';
  return h;
}
function userDelOverlay(id,step){
  return function(){
    var u=(USERS||[]).filter(function(x){return x.id===id})[0]; if(!u) return '';
    var nm='<b>'+esc(Store.userName(u))+'</b>';
    if(step===1) return '<div class="overlay"><div class="card"><h2>⚠️ '+t('Delete player {n}?',{n:nm})+'</h2><p>'+t('All sessions, puzzle progress, prizes and notebooks of {n} will be deleted for good.',{n:nm})+'</p><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn warn" data-act="udel2" data-id="'+esc(id)+'">'+t('Continue')+'</button></div></div></div>';
    var word=t('DELETE');
    return '<div class="overlay"><div class="card"><h2>🗑 '+t('Are you really sure?')+'</h2><p>'+t('Type {w} to confirm.',{w:'<b>'+word+'</b>'})+'</p><input id="resetword" class="bigin" autocomplete="off" autocapitalize="characters" value="'+esc(resetWord)+'"><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn warn" id="resetgo" data-act="udelgo" data-id="'+esc(id)+'"'+(wordOk(resetWord)?'':' disabled')+'>'+t('Delete player')+'</button></div></div></div>';
  };
}
function doDeleteUser(id){
  overlay=null; resetWord='';
  var wasMe=id===UID;
  Store.deleteUser(id).then(function(){
    toast(t('Player deleted'));
    if(wasMe) Store.switchUser(USERS[0].id); else render();
  });
}

/* ---------- overlays ---------- */
function showOverlay(fn){ overlay=fn; render(); }
function closeOverlay(){ overlay=null; render(); }
function rewardOverlay(rid){
  return function(){
    var h='<div class="overlay"><div class="card prize"><div class="mascot-sm">'+MASCOT+'</div><h2>🎉 '+t('Super! You finished everything!')+'</h2><p class="sub">'+t('Pick your prize:')+'</p><div class="prizes">';
    catalog().forEach(function(r){ h+='<button class="ptile" data-act="pick" data-id="'+rid+'" data-r="'+r.id+'"><span class="pi">'+esc(r.icon)+'</span><b>'+esc(rewardName(r))+'</b></button>'; });
    h+='</div><button class="btn ghost sm" style="margin-top:10px" data-act="later">'+t('Pick later')+'</button></div></div>';
    return h;
  };
}
function resetOverlay(step){
  return function(){
    if(step===1) return '<div class="overlay"><div class="card"><h2>⚠️ '+t('Delete all data?')+'</h2><p>'+t('All sessions, puzzle progress, prizes and notebooks will be deleted for good.')+'</p><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn warn" data-act="reset2">'+t('Continue')+'</button></div></div></div>';
    var word=t('DELETE');
    return '<div class="overlay"><div class="card"><h2>🗑 '+t('Are you really sure?')+'</h2><p>'+t('Type {w} to confirm.',{w:'<b>'+word+'</b>'})+'</p><input id="resetword" class="bigin" autocomplete="off" autocapitalize="characters" value="'+esc(resetWord)+'"><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn warn" id="resetgo" data-act="resetgo"'+(wordOk(resetWord)?'':' disabled')+'>'+t('Delete everything')+'</button></div></div></div>';
  };
}
function norm(s){ return String(s||'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/OE/g,'O'); }
function wordOk(s){ return norm(s)===norm(t('DELETE')); }
function showNotebook(id){
  showOverlay(function(){ return '<div class="overlay" data-act="closeov"><div class="card"><span class="spin"></span> '+t('Loading notebook…')+'</div></div>'; });
  Store.getNotebook(id).then(function(nb){
    if(!nb){ closeOverlay(); toast(t('Notebook not found')); return; }
    showOverlay(function(){
      var h='<div class="overlay"><div class="card" style="text-align:left;max-height:84vh;overflow:auto;max-width:560px"><h2>📓 '+fmtDate(nb.date)+' · '+esc(nb.result)+'</h2><p class="sub">'+t('You played {side}',{side:sideName(nb.kid)})+' · '+esc(nb.tc||'')+'</p>';
      var keys=Object.keys(nb.notes||{}).map(Number).sort(function(a,b){return a-b});
      keys.forEach(function(k){ var n=nb.notes[k]; h+='<div class="hint" style="background:#fff"><b>'+Math.ceil(k/2)+(k%2?'. ':'… ')+esc(ls(nb.moves[k-1]))+(n.tag||'')+'</b>'+(n.ev?' · '+esc(n.ev):'')+(n.cand?'<br>'+t('Candidates:')+' '+esc(n.cand):'')+(n.cmt?'<br>'+esc(n.cmt):'')+'</div>'; });
      if(nb.review&&nb.review.mistakes) h+='<h3 style="margin-top:12px">'+t('Engine found')+'</h3>'+(nb.review.mistakes.length?nb.review.mistakes.map(function(m){return '<div class="note">'+Math.ceil(m.ply/2)+(m.ply%2?'. ':'… ')+esc(ls(m.san))+m.tag+' — '+t('better')+' '+esc(ls(m.best))+(m.tagged?' ✓ '+t('spotted'):'')+'</div>'}).join(''):'<p class="note">'+t('No big mistakes.')+'</p>');
      h+='<div class="mlist">'+esc(ls(nb.moves.map(function(s,i){return (i%2===0?(i/2+1)+'. ':'')+s}).join(' ')))+'</div><button class="btn" style="width:100%;margin-top:12px" data-act="closeov">'+t('Close')+'</button></div></div>';
      return h;
    });
  }).catch(function(){ closeOverlay(); toast(t('Could not load the notebook')); });
}

/* ---------- backup ---------- */
var importText='', importData=null;
function canDownload(){ return Store.mode==='device'||!window.claude; }
function backupName(){ return 'daily-gambit-backup-'+today()+'.json'; }
function doExport(){
  Store.exportData().then(function(data){
    var json=JSON.stringify(data);
    S.lastBackup=Date.now(); Store.saveSettings();
    if(canDownload()){
      try{ var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([json],{type:'application/json'})); a.download=backupName(); document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000); toast('💾 '+t('Backup saved')); render(); return; }catch(e){}
    }
    showOverlay(function(){ return '<div class="overlay"><div class="card" style="text-align:left"><h2>📋 '+t('Copy backup')+'</h2><p class="sub">'+t('Copy this text and keep it somewhere safe (e.g. a note or an email to yourself). Paste it into “Restore from backup” to bring everything back.')+'</p><textarea id="bktext" class="bigta" readonly>'+esc(json)+'</textarea><div class="btns"><button class="btn" data-act="copybk">'+t('Copy')+'</button><button class="btn ghost" data-act="closeov">'+t('Close')+'</button></div></div></div>'; });
  }).catch(function(){ toast(t('Could not create the backup')); });
}
function parseBackup(txt){
  try{ var d=JSON.parse(txt); if(d&&d.app==='daily-gambit'&&d.state&&Array.isArray(d.state.sessions)) return d; }catch(e){}
  return null;
}
function importOverlay(step){
  return function(){
    if(step===1) return '<div class="overlay"><div class="card" style="text-align:left"><h2>♻️ '+t('Restore from backup')+'</h2><p class="sub">'+t('Choose a backup file or paste the backup text.')+'</p><input type="file" id="bkfile" accept=".json,application/json"><textarea id="bkpaste" class="bigta" placeholder="'+t('…or paste the backup text here')+'">'+esc(importText)+'</textarea><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn" data-act="import2">'+t('Continue')+'</button></div></div></div>';
    var d=importData, n=d.state.sessions.length, when=(d.exportedAt||'').slice(0,10);
    return '<div class="overlay"><div class="card"><h2>⚠️ '+t('Replace all data?')+'</h2><p>'+t('Backup from {d} · logged sessions: {n}. Everything currently in the app will be replaced by it.',{d:when?fmtDate(when):'?',n:n})+'</p><div class="btns"><button class="btn ghost" data-act="closeov">'+t('Cancel')+'</button><button class="btn warn" data-act="import3">'+t('Restore')+'</button></div></div></div>';
  };
}

/* ---------- confetti ---------- */
function confetti(){
  try{
    var cv=document.createElement('canvas'); cv.className='confetti'; document.body.appendChild(cv);
    var W=cv.width=innerWidth, H=cv.height=innerHeight, x=cv.getContext('2d'), cols=['#b58863','#f0d9b5','#8b5e3c','#e8963a','#5f8a3a','#ffffff'];
    var P=[]; for(var i=0;i<140;i++) P.push({x:W/2+(Math.random()-.5)*80,y:H*0.35,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*6+4,c:cols[i%cols.length],a:Math.random()*6,va:(Math.random()-.5)*.4});
    var t0=performance.now();
    (function f(now){ var el=now-t0; x.clearRect(0,0,W,H);
      P.forEach(function(p){ p.vy+=0.35; p.x+=p.vx; p.y+=p.vy; p.a+=p.va; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.fillStyle=p.c; x.globalAlpha=Math.max(0,1-el/2200); x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); x.restore(); });
      if(el<2200) requestAnimationFrame(f); else cv.remove(); })(t0);
  }catch(e){}
}

/* ---------- logging ---------- */
/* Build a session straight from what an in-app lesson recorded (no form). */
function sessionFromPend(slot){
  var P=PEND[slot]; if(!P) return null; var sl=SL[slot];
  var s={id:uid(),date:today(),slot:slot,min:P.min||1,parts:sl.parts.map(function(_,i){return !!(P.parts&&P.parts[i])}),note:P.note||'',lesson:true,stopped:!!P.stopped};
  if(sl.kind==='wp'&&P.n>0){ s.wp={n:P.n,ok:Math.min(P.ok||0,P.n),min:P.wmin||0,cycle:S.wpCycle}; if(P.extra&&P.extra.items){ s.wp.items=P.extra.items; s.wp.set=P.extra.set; } }
  if(sl.kind==='acc'&&P.acc!=null) s.acc=P.acc;
  if(sl.kind==='game'){ s.tc=P.tc||'15+10'; s.res=P.res||''; s.blunders=P.bl||0; s.engine=!!P.engine; if(P.extra&&P.extra.nb) s.nb=P.extra.nb; }
  return s;
}
/* "Finish & log" in a lesson: log immediately. A second in-app lesson for the same slot today
   (e.g. Thursday puzzles, later the coordinates quiz) is merged into the earlier entry. */
function autoLog(slot){
  if(Store.mode==='readonly'){ toast(t('Lesson done! Check the form and tap Complete.')); render(); return; }
  var s=sessionFromPend(slot); if(!s) return;
  var prev=S.sessions.filter(function(x){ return x.lesson&&!x.excused&&x.slot===slot&&x.date===s.date; }).pop();
  var opt={};
  if(prev){
    opt.prev=prev; opt.wpAdv=s.wp?(s.wp.items?s.wp.items.length:s.wp.n):0;
    var m=Object.assign({},prev,{min:(prev.min||0)+s.min,parts:s.parts.map(function(v,i){return !!(v||(prev.parts||[])[i])}),stopped:!!(prev.stopped||s.stopped)});
    if(s.wp&&prev.wp){ m.wp=Object.assign({},prev.wp,{n:prev.wp.n+s.wp.n,ok:prev.wp.ok+s.wp.ok,min:(prev.wp.min||0)+(s.wp.min||0)}); if(prev.wp.items||s.wp.items) m.wp.items=(prev.wp.items||[]).concat(s.wp.items||[]); }
    else if(s.wp) m.wp=s.wp;
    ['acc','tc','res','blunders','engine','nb'].forEach(function(k){ if(s[k]!=null&&s[k]!=='') m[k]=s[k]; });
    if(s.note) m.note=prev.note?prev.note+' · '+s.note:s.note;
    s=m;
  }
  commitSession(s,opt);
}
function commitSession(s,opt){
  if(Store.mode==='readonly') return;
  opt=opt||{};
  var prev=opt.prev, before=compute(), P=PEND[s.slot], settingsChanged=false, full=fullyDone(s)&&!(prev&&prev.reward);
  if(prev) S.sessions=S.sessions.filter(function(x){ return x!==prev; });
  if(fullyDone(s)) s.reward=true;
  S.sessions.push(s);
  var msg=s.excused?t('Rest day logged ☾ — streak safe'):'+'+(sessionXP(s)-(prev?sessionXP(prev):0))+' XP!';
  if(!s.excused){
    if(s.slot==='mon' && s.wp){
      var adv=opt.wpAdv!=null?opt.wpAdv:(s.wp.items?s.wp.items.length:s.wp.n); S.wpPos+=adv; settingsChanged=true;
      if(S.wpPos>=S.setSize){ S.wpCycle++; S.wpPos=0; msg+=' 🐦 '+t('Round complete!'); }
    }
    if(P&&P.extra){
      if(P.extra.eg){ S.egDone=Object.assign({},S.egDone||{},P.extra.eg); settingsChanged=true; }
      if(P.extra.game!=null&&(S.gamesDone||[]).indexOf(P.extra.game)<0){ S.gamesDone=(S.gamesDone||[]).concat([P.extra.game]); settingsChanged=true; }
      if(P.extra.blindPos!=null){ S.blindPos=P.extra.blindPos; S.threatPos=P.extra.threatPos; settingsChanged=true; }
    }
  }
  var after=compute();
  var nb=after.badges.filter(function(b){return before.badges.indexOf(b)<0}).map(function(id){return BADGES.filter(function(b){return b.id===id})[0]});
  if(nb.length) msg+=' '+t('New badge:')+' '+nb.map(function(b){return b.g+' '+t(b.n)}).join(', ');
  if(after.rank.n!==before.rank.n) msg+=' '+t('Rank up: {r}!',{r:t(after.rank.n)});
  if(after.perfect>before.perfect) msg+=' 🏆 '+t('Perfect week!');
  clearPend(s.slot); draft.open=false;
  Store.addSession(s); if(settingsChanged) Store.saveSettings();
  toast(msg);
  if(full){
    var r={id:uid(),sessionId:s.id,date:s.date,status:'unpicked',createdAt:Date.now()};
    REWARDS.push(r); Store.saveReward(r);
    confetti(); Sound.play('Victory');
    showOverlay(rewardOverlay(r.id));
  } else { if(!s.excused) confetti(); render(); }
}
function pickReward(rid,catId){
  var r=REWARDS.filter(function(x){return x.id===rid})[0], item=catalog().filter(function(x){return x.id===catId})[0]; if(!r||!item) return;
  r.status='earned'; r.rewardId=item.id; r.name=rewardName(item); r.icon=item.icon; r.pickedAt=Date.now();
  Store.saveReward(r); overlay=null; toast('🎁 '+t('Great choice! Ask a parent for your {p}.',{p:r.name})); location.hash='prizes'; render();
}
function doReset(){
  Store.resetAll().then(function(){ PEND={}; L=null; draft={slot:SLOTS[slotIdxOf(new Date())].k}; overlay=null; resetWord=''; toast(t('All data deleted.')); location.hash='today'; render(); });
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var l=e.target.closest('[data-l]');
  if(l && L && L.act && l.tagName!=='INPUT' && inLesson()){ L.act(l.getAttribute('data-l'),l); return; }
  var tg=e.target.closest('[data-act]'); if(!tg) return;
  var act=tg.getAttribute('data-act'), id=tg.getAttribute('data-id');
  if(act==='openlog'){ return; }
  if(act==='slot'){ draft.slot=tg.getAttribute('data-k'); render(); }
  else if(act==='lang'){ S.lang=tg.getAttribute('data-v'); setLang(S.lang); Store.saveSettings(); render(); }
  else if(act==='lesson'){ openLesson(draft.slot); }
  else if(act==='coord'){ openLesson('thu','coord'); }
  else if(act==='resume'){ location.hash='lesson'; }
  else if(act==='leave'){ location.hash=(L&&L.home)||'today'; }
  else if(act==='uswitch'){ Store.switchUser(id); }
  else if(act==='offfill'){ offFill(tg); }
  else if(act==='oplearn'||act==='opdrill'||act==='opexplore'){ var li=tg.getAttribute('data-i'); openOpening(act==='oplearn'?'learn':act==='opdrill'?'drill':'explore',id,li==null?null:+li); }
  else if(act==='lidel'){ lsSet('dg_lichess_token',null); LI.cache={}; toast(t('Token removed from this device')); render(); }
  else if(act==='litest'){ LI.cache={}; liStats('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').then(function(d){ toast(d.err?liErr(d.err):'✓ '+t('Lichess works! {n} master games in the database.',{n:((d.white||0)+(d.draws||0)+(d.black||0)).toLocaleString(LOCALES[LANG])})); }); }
  else if(act==='udel'){ resetWord=''; showOverlay(userDelOverlay(id,1)); }
  else if(act==='udel2'){ showOverlay(userDelOverlay(id,2)); }
  else if(act==='udelgo'){ if(wordOk(resetWord)) doDeleteUser(id); }
  else if(act==='pause'||act==='unpause'){ if(!L) return; L.paused=act==='pause'; var pb=document.getElementById('pausebox'), ls=document.getElementById('lesson'); if(pb) pb.hidden=!L.paused; if(ls) ls.hidden=L.paused; driveClock(); if(!L.paused) lr(); }
  else if(act==='end'){ if(!L) return; L.paused=false; var done=L.finish&&L.finish(); if(!done){ if(L.saved&&L.saved()) toast(t('Game saved — continue any time.')); location.hash=L.home||'today'; } }
  else if(act==='clearpend'){ e.preventDefault(); clearPend(draft.slot); render(); }
  else if(act==='excuse'){ var s=readDraft(); commitSession({id:s.id,date:s.date,slot:s.slot,min:0,parts:[],excused:true,note:s.note}); }
  else if(act==='del'){ if(pendingDel===id){ S.sessions=S.sessions.filter(function(x){return x.id!==id}); pendingDel=null; Store.delSession(id); toast(t('Session deleted')); render(); } else { pendingDel=id; render(); } }
  else if(act==='cycle'){ if(pendingCycle){ S.wpCycle++; S.wpPos=0; pendingCycle=false; Store.saveSettings(); toast(t('Round {n} started 🐦',{n:S.wpCycle})); render(); } else { pendingCycle=true; render(); } }
  else if(act==='wpset'){ S.wpSet=tg.getAttribute('data-v'); Store.saveSettings(); render(); }
  else if(act==='nb'){ e.preventDefault(); showNotebook(id); }
  else if(act==='closeov'){ if(e.target===tg||tg.tagName==='BUTTON'){ resetWord=''; closeOverlay(); } }
  else if(act==='pick'){ pickReward(id,tg.getAttribute('data-r')); }
  else if(act==='later'){ toast(t('Your prize is saved in Prizes 🎁')); closeOverlay(); }
  else if(act==='pickfor'){ showOverlay(rewardOverlay(id)); }
  else if(act==='give'){ if(pendingGive===id){ var r=REWARDS.filter(function(x){return x.id===id})[0]; if(r){ r.status='given'; r.givenAt=Date.now(); Store.saveReward(r); } pendingGive=null; toast('✓ '+t('Marked as given')); render(); } else { pendingGive=id; render(); } }
  else if(act==='rmprize'){ S.catalog=catalog().filter(function(x){return x.id!==id}); Store.saveSettings(); render(); }
  else if(act==='reset1'){ resetWord=''; showOverlay(resetOverlay(1)); }
  else if(act==='reset2'){ showOverlay(resetOverlay(2)); setTimeout(function(){ var i=document.getElementById('resetword'); if(i) i.focus(); },50); }
  else if(act==='resetgo'){ if(wordOk(resetWord)) doReset(); }
  else if(act==='export'){ doExport(); }
  else if(act==='copybk'){ var ta=document.getElementById('bktext'); try{ navigator.clipboard.writeText(ta.value).then(function(){ toast('✓ '+t('Copied')); },function(){ ta.select(); }); }catch(e2){ ta.select(); } }
  else if(act==='import'){ importText=''; importData=null; showOverlay(importOverlay(1)); }
  else if(act==='import2'){ var d=parseBackup(importText); if(!d){ toast(t('That is not a Daily Gambit backup')); return; } importData=d; showOverlay(importOverlay(2)); }
  else if(act==='import3'){ var dd=importData; overlay=null; Store.importAll(dd).then(function(){ PEND={}; lsSet(K('pend'),null); L=null; importData=null; importText=''; toast('✓ '+t('Backup restored')); location.hash='today'; render(); }).catch(function(){ toast(t('Could not restore the backup')); render(); }); }
});
document.addEventListener('toggle',function(e){ if(e.target.getAttribute&&e.target.getAttribute('data-act')==='openlog'){ draft.open=e.target.open; if(e.target.open) updateLive(); } },true);
document.addEventListener('submit',function(e){
  e.preventDefault();
  var f=e.target;
  if(f.id==='logform'){
    var s=readDraft();
    if(s.wp && s.wp.ok>s.wp.n){ toast(t('Correct can’t be more than puzzles solved')); return; }
    commitSession(s);
  } else if(f.id==='settings'){
    S.player=(f.elements.player.value||'Champion').trim().slice(0,30); S.skill=Math.max(0,Math.min(20,+f.elements.skill.value||10)); S.sound=f.elements.sound.checked; S.lang=f.elements.lang.value; setLang(S.lang); Store.saveSettings(); toast(t('Settings saved')); render();
  } else if(f.id==='litoken'){
    var tk=f.elements.tok.value.trim(); if(!tk) return;
    lsSet('dg_lichess_token',tk); LI.cache={};
    liStats('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').then(function(d){ if(d.err==='auth'){ lsSet('dg_lichess_token',null); toast(liErr(d.err)); } else toast(d.err?t('Token saved.')+' '+liErr(d.err):'✓ '+t('Connected to Lichess!')); render(); });
  } else if(f.id==='adduser'){
    var un=f.elements.name.value.trim().slice(0,30); if(!un) return;
    Store.addUser(un).then(function(){ toast(t('Player added: {n}',{n:un})); render(); });
  } else if(f.id==='addprize'){
    var name=f.elements.name.value.trim(); if(!name) return;
    S.catalog=catalog().concat([{id:uid(),icon:(f.elements.icon.value.trim()||'🎁'),name:name}]); Store.saveSettings(); toast(t('Prize added')); render();
  }
});
document.addEventListener('input',function(e){
  if(e.target.closest('#logform')) updateLive();
  if(e.target.id==='bkpaste'){ importText=e.target.value; }
  if(e.target.id==='resetword'){ resetWord=e.target.value; var b=document.getElementById('resetgo'); if(b) b.disabled=!wordOk(resetWord); }
});
document.addEventListener('change',function(e){
  if(e.target.id==='bkfile'&&e.target.files&&e.target.files[0]){ var fr=new FileReader(); fr.onload=function(){ importText=String(fr.result||''); var ta=document.getElementById('bkpaste'); if(ta) ta.value=importText.length>2000?importText.slice(0,2000)+'…':importText; }; fr.readAsText(e.target.files[0]); return; }
  if(e.target.closest('#logform')) updateLive();
  var l=e.target.getAttribute&&e.target.getAttribute('data-l'); if(l&&L&&L.change&&inLesson()){ L.change(l,e.target); }
});
window.addEventListener('hashchange',function(){ opLeft(); driveClock(); pendingDel=null; pendingCycle=false; pendingGive=null; render(); window.scrollTo(0,0); });
setInterval(function(){ driveClock(); if(inLesson()&&L.tick) L.tick(); },500);
document.addEventListener('visibilitychange',driveClock);
document.addEventListener('keydown',function(e){
  if(!inLesson()||!L||!L.key||L.paused||overlay) return;
  var tg=e.target&&e.target.tagName; if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||e.altKey||e.ctrlKey||e.metaKey) return;
  if(L.key(e.key)) e.preventDefault();
});

/* ---------- boot ---------- */
setLang(S.lang);
if(location.hash==='#lesson'){ try{ location.hash='today'; }catch(e){} }
render();
Store.init();
