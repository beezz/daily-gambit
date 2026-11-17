/* Daily Gambit — screens, log form, rewards, settings, events */

var draft={slot:SLOTS[slotIdxOf(new Date())].k}, pendingDel=null, pendingCycle=false, overlay=null, pendingGive=null, resetWord='';
var TABS=[['today','♟','Today'],['week','📅','Week'],['woodpecker','🐦','Puzzles'],['prizes','🎁','Prizes'],['history','📜','Log']];
var MASCOT='<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="113" rx="34" ry="5" fill="#000" opacity=".08"/><path d="M86 100 q26 4 24 -22 q-2 -10 -8 -8 q4 14 -18 18 Z" fill="#7a5233"/><ellipse cx="60" cy="88" rx="31" ry="25" fill="#8b5e3c"/><ellipse cx="60" cy="92" rx="20" ry="19" fill="#f0d9b5"/><circle cx="35" cy="28" r="8" fill="#8b5e3c"/><circle cx="35" cy="28" r="4" fill="#5c3d24"/><circle cx="85" cy="28" r="8" fill="#8b5e3c"/><circle cx="85" cy="28" r="4" fill="#5c3d24"/><circle cx="60" cy="48" r="29" fill="#a0714b"/><ellipse cx="60" cy="60" rx="21" ry="15" fill="#f0d9b5"/><circle cx="47" cy="44" r="5.5" fill="#3b2a1d"/><circle cx="73" cy="44" r="5.5" fill="#3b2a1d"/><circle cx="48.8" cy="42.2" r="1.9" fill="#fff"/><circle cx="74.8" cy="42.2" r="1.9" fill="#fff"/><circle cx="39" cy="56" r="4.5" fill="#e8a08a" opacity=".55"/><circle cx="81" cy="56" r="4.5" fill="#e8a08a" opacity=".55"/><ellipse cx="60" cy="54" rx="6.5" ry="4.5" fill="#3b2a1d"/><ellipse cx="58" cy="52.8" rx="2" ry="1.1" fill="#fff" opacity=".6"/><path d="M54 61 q3 4 6 0 q3 4 6 0" stroke="#3b2a1d" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M45 58 L31 55 M45 61 L31 63 M75 58 L89 55 M75 61 L89 63" stroke="#5c3d24" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><g transform="translate(60 92)"><circle cx="0" cy="-12" r="5.5" fill="#fff" stroke="#5c3d24" stroke-width="1.8"/><path d="M-4 -6 h8 l3 12 h-14 Z" fill="#fff" stroke="#5c3d24" stroke-width="1.8" stroke-linejoin="round"/><rect x="-9" y="5" width="18" height="5" rx="2" fill="#fff" stroke="#5c3d24" stroke-width="1.8"/></g><ellipse cx="46" cy="90" rx="8" ry="6" fill="#7a5233"/><ellipse cx="74" cy="90" rx="8" ry="6" fill="#7a5233"/><ellipse cx="46" cy="108" rx="9" ry="5" fill="#7a5233"/><ellipse cx="74" cy="108" rx="9" ry="5" fill="#7a5233"/></svg>';
function tab(){var h=(location.hash||'').slice(1); if(h==='lesson') return L?'lesson':'today'; return TABS.some(function(x){return x[0]===h})?h:'today'}
function rewardName(r){ return r.name||t('Pokémon card pack'); }
function catalog(){ return (S.catalog&&S.catalog.length)?S.catalog:DEFAULT_CATALOG; }

function render(){
  var c=compute(), tb=tab(), root=document.getElementById('root');
  var h='<div class="wrap">';
  if(tb==='lesson'){
    h+='<div class="lhead"><button class="back" data-act="leave" aria-label="'+t('Back')+'">←</button><h2>'+esc(L.title)+'</h2></div><div id="lesson"></div>';
  } else {
    var pct=c.next?Math.round((c.xp-c.rank.xp)/(c.next.xp-c.rank.xp)*100):100;
    var owed=REWARDS.filter(function(r){return r.status==='earned'||r.status==='unpicked'}).length;
    h+='<div class="langs">'+['sk','de','en'].map(function(l){return '<button data-act="lang" data-v="'+l+'" class="'+(LANG===l?'on':'')+'">'+l.toUpperCase()+'</button>'}).join('')+'</div>';
    h+='<header class="hero"><div class="avatar">'+pc(c.rank.p)+'</div><div class="hinfo"><div class="pname">'+esc(S.player)+'</div>'+
       '<div class="rank">'+t(c.rank.n)+' · '+c.xp.toLocaleString(LOCALES[LANG])+' XP</div><div class="bar"><i style="width:'+pct+'%"></i></div>'+
       '<div class="small">'+(c.next?t('{n} XP to {r}',{n:(c.next.xp-c.xp).toLocaleString(LOCALES[LANG]),r:t(c.next.n)}):t('Top rank reached!'))+'</div></div>'+
       '<div class="hstats"><div class="streak"><b>🔥 '+c.cur+'</b><span>'+t('streak')+'</span></div>'+(owed?'<a class="streak gift" href="#prizes"><b>🎁 '+owed+'</b><span>'+t('prizes')+'</span></a>':'')+'</div></header>';
    if(Store.mode==='local') h+='<div class="banner">'+t('Preview mode: progress is kept only in this browser. Open the published app to save it for good.')+'</div>';
    if(Store.mode==='readonly') h+='<div class="banner">'+t('View only — you can see progress, but only the owner can log sessions.')+'</div>';
    if(Store.mode==='live'&&Store.slow) h+='<div class="banner">'+t('Can’t reach saved progress yet — what you see may be out of date.')+'</div>';
    h+= tb==='today'?vToday(c): tb==='week'?vWeek(c): tb==='woodpecker'?vWood(c): tb==='prizes'?vPrizes(c): vHistory(c);
    h+='<div class="credits">'+t('Board & pieces')+': <a href="https://github.com/lichess-org/chessground" target="_blank" rel="noopener">Lichess chessground</a> (GPLv3), Cburnett (CC BY-SA 3.0) · '+t('Sounds')+': Lichess SFX, Enigmahack (AGPLv3+) · '+t('Puzzles')+': <a href="https://database.lichess.org/" target="_blank" rel="noopener">Lichess</a> (CC0) · Stockfish 17.1 (GPLv3) · chess.js</div>';
  }
  h+='</div><nav><div class="in">'+TABS.map(function(x){return '<a href="#'+x[0]+'" class="'+(x[0]===tb?'on':'')+'"><span class="g">'+x[1]+'</span>'+t(x[2])+'</a>'}).join('')+'</div></nav>';
  if(overlay) h+=overlay();
  if(typeof freeBoards==='function') freeBoards(false);
  root.innerHTML=h;
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
    h+='<div class="card"><h2>⚙️ '+t('Settings')+'</h2><form id="settings"><div class="grid2"><label class="fld">'+t('Player name')+'<input name="player" maxlength="30" value="'+esc(S.player)+'"></label>'+
      '<label class="fld">'+t('Endgame Stockfish level (0–20)')+'<input name="skill" type="number" min="0" max="20" value="'+S.skill+'"></label></div>'+
      '<label class="fld">'+t('Language')+'<select name="lang">'+[['sk','Slovenčina'],['de','Deutsch'],['en','English']].map(function(o){return '<option value="'+o[0]+'"'+(LANG===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label>'+
      '<label class="row"><input type="checkbox" name="sound"'+(S.sound!==false?' checked':'')+'><span>'+t('Move sounds (Lichess “SFX” sound set)')+'</span></label><button class="btn sm" type="submit">'+t('Save settings')+'</button></form></div>';
    h+='<div class="card"><h2>🎁 '+t('Prize list (for parents)')+'</h2><p class="sub">'+t('After every fully finished session, your child picks one of these. You mark it as given when you hand it over.')+'</p><div class="list">';
    catalog().forEach(function(r){ h+='<div class="coupon"><div class="ci">'+esc(r.icon)+'</div><div class="cm"><b>'+esc(rewardName(r))+'</b></div>'+(catalog().length>1?'<button class="btn ghost sm" data-act="rmprize" data-id="'+r.id+'">'+t('Remove')+'</button>':'')+'</div>'; });
    h+='</div><form id="addprize" class="addprize"><input name="icon" maxlength="4" value="🎁" aria-label="'+t('Icon')+'"><input name="name" maxlength="40" placeholder="'+t('e.g. Ice cream, 30 min tablet time')+'" required><button class="btn sm" type="submit">'+t('Add')+'</button></form></div>';
    h+='<div class="card danger"><h2>🗑 '+t('Delete all data')+'</h2><p class="sub">'+t('Removes all sessions, puzzle progress, prizes, badges progress and game notebooks. This cannot be undone.')+'</p><button class="btn warn" data-act="reset1">'+t('Delete all data…')+'</button></div>';
  }
  return h;
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
function commitSession(s){
  if(Store.mode==='readonly') return;
  var before=compute(), P=PEND[s.slot], settingsChanged=false, full=fullyDone(s);
  if(full) s.reward=true;
  S.sessions.push(s);
  var msg=s.excused?t('Rest day logged ☾ — streak safe'):'+'+sessionXP(s)+' XP!';
  if(!s.excused){
    if(s.slot==='mon' && s.wp){
      var adv=s.wp.items?s.wp.items.length:s.wp.n; S.wpPos+=adv; settingsChanged=true;
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
  else if(act==='leave'){ location.hash='today'; }
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
  } else if(f.id==='addprize'){
    var name=f.elements.name.value.trim(); if(!name) return;
    S.catalog=catalog().concat([{id:uid(),icon:(f.elements.icon.value.trim()||'🎁'),name:name}]); Store.saveSettings(); toast(t('Prize added')); render();
  }
});
document.addEventListener('input',function(e){
  if(e.target.closest('#logform')) updateLive();
  if(e.target.id==='resetword'){ resetWord=e.target.value; var b=document.getElementById('resetgo'); if(b) b.disabled=!wordOk(resetWord); }
});
document.addEventListener('change',function(e){
  if(e.target.closest('#logform')) updateLive();
  var l=e.target.getAttribute&&e.target.getAttribute('data-l'); if(l&&L&&L.change&&inLesson()){ L.change(l,e.target); }
});
window.addEventListener('hashchange',function(){ pendingDel=null; pendingCycle=false; pendingGive=null; render(); window.scrollTo(0,0); });
setInterval(function(){ if(inLesson()&&L.tick) L.tick(); },500);

/* ---------- boot ---------- */
setLang(S.lang);
if(location.hash==='#lesson'){ try{ location.hash='today'; }catch(e){} }
render();
Store.init();
