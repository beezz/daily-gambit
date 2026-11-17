/* Daily Gambit — core: data model, scoring, persistence, board, engine */
'use strict';
var Chess = window.ChessJS.Chess;

/* ---------------- constants ---------------- */
var SLOTS = [
  {k:'mon',day:'Mon',p:'wn',title:'Woodpecker Tactics',min:30,kind:'wp',lesson:'wood',
   parts:['Solved about 20 puzzles from the set (~1 min each)','Retried every failed puzzle with board visualization']},
  {k:'tue',day:'Tue',p:'wr',title:'Theoretical Endgames',min:30,kind:'acc',lesson:'endgame',accLabel:'Endgame positions solved (%)',
   parts:['Pawn endgames: key squares, opposition, triangulation vs Stockfish','Rook endgames: Lucena, Philidor, Vancura']},
  {k:'wed',day:'Wed',p:'wb',title:'Guess-the-Move Master Game',min:30,kind:'acc',lesson:'guess',accLabel:'Moves guessed correctly (%)',
   parts:['Replayed one classic game (Capablanca / Rubinstein) with the moves hidden','Spent 2–3 min calculating at the critical moments']},
  {k:'thu',day:'Thu',p:'wp',title:'Woodpecker Speed & Coordinates',min:30,kind:'wp',lesson:'wood',
   parts:['Re-solved Monday’s exact puzzle set, aiming for 1.5× speed','Rapid-fire quiz: squares, colors, knight routes']},
  {k:'fri',day:'Fri',p:'wq',title:'Blindfold & Threat Drills',min:30,kind:'acc',lesson:'friday',accLabel:'Drills solved correctly (%)',
   parts:['Blindfold tactics (2–3 move combinations from notation)','Threat drills: “What is the opponent’s strongest reply?”']},
  {k:'wk',day:'Wknd',p:'wk',title:'Classical Game & Self-Analysis',min:90,kind:'game',lesson:'weekend',
   parts:['Played 1 serious game (15+10 or 25+10)','Kept the sit-on-hands rule the whole game','Engine-free notebook annotation & blunder tagging']}
];
var SL = {}; SLOTS.forEach(function(s,i){ s.i=i; SL[s.k]=s; });

var RANKS = [
  {n:'Pawn',p:'wp',xp:0},{n:'Knight',p:'wn',xp:600},{n:'Bishop',p:'wb',xp:1500},
  {n:'Rook',p:'wr',xp:3000},{n:'Queen',p:'wq',xp:5000},{n:'King',p:'wk',xp:8000},{n:'Grandmaster',p:'bk',xp:12000,gm:true}
];

var BADGES = [
  {id:'first',g:'♙',n:'First Move',d:'Log your first session',ok:function(c){return c.done>=1}},
  {id:'perfect',g:'🏆',n:'Perfect Week',d:'All 6 sessions in one week',ok:function(c){return c.perfect>=1}},
  {id:'streak6',g:'🔥',n:'Hot Streak',d:'6 sessions in a row',ok:function(c){return c.best>=6}},
  {id:'streak18',g:'☄️',n:'Unstoppable',d:'18 sessions in a row',ok:function(c){return c.best>=18}},
  {id:'sharp',g:'🎯',n:'Sharpshooter',d:'5 sessions at 90%+ accuracy',ok:function(c){return c.acc90>=5}},
  {id:'wise',g:'🦦',n:'Wise Stop',d:'Stopped when accuracy fell below 70%',ok:function(c){return c.wise>=1}},
  {id:'patient',g:'⏳',n:'Engine Patience',d:'5 analyses written before Stockfish',ok:function(c){return c.engine>=5}},
  {id:'speed',g:'⚡',n:'Speedster',d:'Thursday re-solve 1.5× faster than Monday',ok:function(c){return c.speedster}},
  {id:'wp1',g:'🐦',n:'Woodpecker I',d:'Finish puzzle round 1',ok:function(c){return c.cyclesDone>=1}},
  {id:'wp2',g:'🪶',n:'Woodpecker II',d:'Round 2: 40% faster at 90%+ accuracy',ok:function(c){return c.target[2]}},
  {id:'wp3',g:'🦅',n:'Woodpecker III',d:'Round 3: 70% faster at 90%+ accuracy',ok:function(c){return c.target[3]}},
  {id:'endgame',g:'♜',n:'Endgame Expert',d:'Solve all 9 endgame positions',ok:function(c){return c.egSolved>=9}},
  {id:'master',g:'♝',n:'Master Detective',d:'8 guess-the-move games',ok:function(c){return c.by.wed>=8}},
  {id:'opening',g:'📖',n:'Opening Scholar',d:'Master 10 opening lines',ok:function(c){return c.opMastered>=10}},
  {id:'blind',g:'🙈',n:'Blindfold Ninja',d:'8 blindfold & threat sessions',ok:function(c){return c.by.fri>=8}},
  {id:'hunter',g:'🔍',n:'Blunder Hunter',d:'Tag 20 of your own blunders',ok:function(c){return c.blunders>=20}},
  {id:'iron',g:'🧠',n:'Iron Focus',d:'1,000 minutes of training',ok:function(c){return c.minutes>=1000}}
];

var DEFAULT_CATALOG=[{id:'pkmn',icon:'🎴',name:null}];
var DEFAULT_STATE = {v:3,lang:'sk',catalog:DEFAULT_CATALOG,sound:true,player:'Champion',setSize:200,wpSet:'easy',wpCycle:1,wpPos:0,blindPos:0,threatPos:0,gamesDone:[],egDone:{},skill:10,sessions:[]};

/* ---------------- helpers ---------------- */
function $(s,el){return (el||document).querySelector(s)}
function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s))}
function pad(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parseD(s){var a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])}
function monday(d){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function wkOf(s){return ymd(monday(parseD(s)))}
function slotIdxOf(d){var i=(d.getDay()+6)%7;return i>4?5:i}
function today(){return ymd(new Date())}
function fmtDate(s){return parseD(s).toLocaleDateString(LOCALES[LANG],{weekday:'short',day:'numeric',month:'short'})}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pc(code,cls){return '<svg class="'+(cls||'')+'" viewBox="0 0 40 40"><use href="#p-'+code+'"></use></svg>'}
function mmss(sec){sec=Math.max(0,Math.round(sec));return Math.floor(sec/60)+':'+pad(sec%60)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clone(o){return JSON.parse(JSON.stringify(o))}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
/* ---------------- players ----------------
   Several players share one app. The active player is chosen per device (dg_user); switching
   reloads the page. Player 'main' keeps the original storage names, so existing progress stays put. */
var UID=lsGet('dg_user')||'main';
var USERS=null;                                   // [{id,name}] once loaded (name here is only a fallback)
var NAMES={};                                     // live names, read from each player's own settings
function K(n,u){ u=u||UID; return u==='main'?'ctq2_'+n:'ctq2u_'+u+'_'+n; }          // localStorage key
function C(n,u){ u=u||UID; return u==='main'?n:'u_'+u+'_'+n; }                      // db collection
function SDOC(u){ return C('progress',u)+'/settings'; }                               // db settings doc

/* ---------------- scoring ---------------- */
function accOf(s){ if(s.wp && s.wp.n>0) return Math.round(s.wp.ok/s.wp.n*100); return (s.acc===0||s.acc)?s.acc:null; }
function sessionXP(s){
  if(s.excused) return 0;
  var x = s.slot==='wk'?80:50;
  x += 10*(s.parts||[]).filter(Boolean).length;
  var a = accOf(s);
  if(a!=null && a>=90) x+=20;
  if(s.slot!=='wk' && a!=null && a<70 && s.stopped) x+=30;
  if(s.slot==='wk'){ if(s.engine) x+=30; x+=Math.min(25,5*(s.blunders||0)); }
  if(s.lesson) x+=10; // trained inside the app
  return x;
}
function wpStats(list){
  var n=0,ok=0,min=0;
  list.forEach(function(s){n+=s.wp.n;ok+=s.wp.ok;min+=s.wp.min||s.min||0});
  return {n:n,ok:ok,min:min,acc:n?Math.round(ok/n*100):null,spp:n?min*60/n:null};
}
function compute(){
  var ses=S.sessions, c={xp:0,done:0,minutes:0,acc90:0,wise:0,engine:0,blunders:0,by:{},perfect:0,speedster:false,target:{},cycles:[],cyclesDone:0};
  SLOTS.forEach(function(s){c.by[s.k]=0});
  var filled={}, weeks={};
  ses.forEach(function(s){
    var key=wkOf(s.date)+'|'+s.slot;
    if(s.excused){ if(!filled[key]) filled[key]='x'; return; }
    filled[key]='d';
    c.xp+=sessionXP(s); c.done++; c.minutes+=(+s.min||0); c.by[s.slot]++;
    var a=accOf(s); if(a!=null&&a>=90) c.acc90++;
    if(s.slot!=='wk'&&a!=null&&a<70&&s.stopped) c.wise++;
    if(s.slot==='wk'){ if(s.engine) c.engine++; c.blunders+=(+s.blunders||0); }
    var w=wkOf(s.date); weeks[w]=weeks[w]||{}; weeks[w][s.slot]=1;
  });
  Object.keys(weeks).forEach(function(w){ if(SLOTS.every(function(s){return weeks[w][s.k]})) c.perfect++; });
  c.xp+=c.perfect*150;
  var op=S.op||{}; c.xp+=(+op.xp||0); c.opMastered=Object.keys(op.lines||{}).filter(function(k){return op.lines[k].b>=3}).length;
  ses.forEach(function(t){
    if(t.slot!=='thu'||!t.wp||!t.wp.n||t.excused) return;
    var w=wkOf(t.date), mons=ses.filter(function(m){return m.slot==='mon'&&m.wp&&m.wp.n&&!m.excused&&wkOf(m.date)===w});
    if(!mons.length) return;
    var ms=wpStats(mons).spp, ts=wpStats([t]).spp;
    if(ms&&ts&&ms/ts>=1.5) c.speedster=true;
  });
  var base=null;
  for(var k=1;k<=S.wpCycle;k++){
    var mon=wpStats(ses.filter(function(s){return s.slot==='mon'&&s.wp&&s.wp.cycle===k&&!s.excused}));
    var thu=wpStats(ses.filter(function(s){return s.slot==='thu'&&s.wp&&s.wp.cycle===k&&!s.excused}));
    var complete = mon.n>=S.setSize;
    if(k===1) base=mon.spp;
    var ratio = (k>1&&base&&mon.spp)?mon.spp/base:null;
    var goal = k===1?null:(k===2?0.6:0.3);
    var hit = complete && ratio!=null && ratio<=goal && mon.acc>=90;
    if(complete){c.cyclesDone++; c.xp+=200;}
    if(hit){c.xp+=200; c.target[k]=true;}
    c.cycles.push({k:k,mon:mon,thu:thu,complete:complete,ratio:ratio,goal:goal,hit:hit});
  }
  c.egSolved=Object.keys(S.egDone||{}).length;
  c.cur=0;c.best=0;c.filled=filled;
  if(ses.length){
    var keys=ses.map(function(s){return wkOf(s.date)+'|'+SL[s.slot].i}).sort();
    var startW=keys[0].split('|')[0], startI=+keys[0].split('|')[1];
    var curW=ymd(monday(new Date())), list=[];
    for(var w=parseD(startW); ymd(w)<=curW; w=addDays(w,7)){
      var wk=ymd(w);
      for(var i=0;i<6;i++){
        if(wk===startW&&i<startI) continue;
        var f=filled[wk+'|'+SLOTS[i].k];
        list.push(f==='d'?'d':f==='x'?'x':(wk===curW?'p':'m'));
      }
    }
    for(var j=list.length-1;j>=0;j--){ if(list[j]==='d') c.cur++; else if(list[j]==='m') break; }
    var run=0; list.forEach(function(st){ if(st==='d'){run++; if(run>c.best)c.best=run;} else if(st==='m') run=0; });
  }
  var r=0; for(var q=0;q<RANKS.length;q++) if(c.xp>=RANKS[q].xp) r=q;
  c.rank=RANKS[r]; c.next=RANKS[r+1]||null;
  c.badges=BADGES.filter(function(b){return b.ok(c)}).map(function(b){return b.id});
  return c;
}

/* ---------------- persistence (db capability) ---------------- */
var S = clone(DEFAULT_STATE);
var REWARDS = [];
var Store = {
  mode:'connecting', db:null, chain:Promise.resolve(), loaded:false, slowTimer:null, slow:false,
  init:function(){
    var self=this, p=null;
    var hosted=false;
    try{ if(window.claude && typeof window.claude.use==='function'){ hosted=true; p=window.claude.use('db'); } }catch(e){}
    var users=function(){ self.loadUsers().then(function(){ if(!inLesson()) render(); }); };
    if(!hosted){ self.mode='device'; self.loadLocal(); self.persist(); users(); render(); return; }   // installed / offline app: everything lives on this device
    Promise.resolve(p).then(function(db){
      if(!db){ self.mode='local'; self.loadLocal(); users(); render(); return; }
      self.db=db; self.mode='live'; users(); self.slowTimer=setTimeout(function(){self.slow=true; if(!inLesson()) render();},10000);
      var got={settings:false,sessions:false};
      var done=function(){ if(got.settings&&got.sessions){ clearTimeout(self.slowTimer); self.slow=false; self.loaded=true; if(!inLesson()) render(); } };
      db.doc(SDOC()).onSnapshot(function(snap){
        if(snap.exists){ var d=snap.data()||{}; var keep=S.sessions; S=Object.assign(clone(DEFAULT_STATE), clone(d)); S.sessions=keep; setLang(S.lang); }
        if(!snap.metadata.fromCache){ got.settings=true; } done(); if(self.loaded && !inLesson()) render();
      }, function(e){ self.fail(e); });
      db.collection(C('rewards')).onSnapshot(function(qs){ REWARDS=qs.docs.map(function(d){return clone(d.data())}); if(self.loaded && !inLesson()) render(); }, function(e){ self.fail(e); });
      db.collection(C('sessions')).onSnapshot(function(qs){
        S.sessions=qs.docs.map(function(d){return clone(d.data())});
        if(!qs.metadata.fromCache){ got.sessions=true; } done(); if(self.loaded && !inLesson()) render();
      }, function(e){ self.fail(e); });
    }).catch(function(){ self.mode='local'; self.loadLocal(); users(); render(); });
  },
  isLocal:function(){ return this.mode==='local'||this.mode==='device'; },
  persist:function(){ try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(function(){}); }catch(e){} },
  allNotebooks:function(){
    if(this.mode==='live') return this.db.collection(C('notebooks')).get().then(function(qs){ var o={}; qs.docs.forEach(function(d){ o[d.id]=clone(d.data()); }); return o; });
    var o={}; try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf(K('nb_'))===0) o[k.slice(K('nb_').length)]=lsGet(k); }); }catch(e){}
    return Promise.resolve(o);
  },
  exportData:function(){
    return this.allNotebooks().then(function(nbs){
      return {app:'daily-gambit',format:1,exportedAt:new Date().toISOString(),state:clone(S),rewards:clone(REWARDS),notebooks:nbs};
    });
  },
  /* replaces everything with the backup's content */
  importAll:function(data){
    var self=this, st=Object.assign(clone(DEFAULT_STATE),clone(data.state||{})), rw=clone(data.rewards||[]), nbs=clone(data.notebooks||{});
    st.sessions=(st.sessions||[]).filter(function(x){return x&&x.id&&x.slot&&x.date});
    return this.resetAll().then(function(){
      S=st; REWARDS=rw; setLang(S.lang);
      if(self.isLocal()){ self.saveLocal(); Object.keys(nbs).forEach(function(id){ lsSet(K('nb_')+id,nbs[id]); }); return; }
      if(self.mode!=='live') return;
      var db=self.db, body=self.settingsBody();
      return self.q(function(){
        return db.doc(SDOC()).set(body)
          .then(function(){ return Promise.all(S.sessions.map(function(x){ return db.collection(C('sessions')).doc(x.id).set(clone(x)); })); })
          .then(function(){ return Promise.all(REWARDS.map(function(x){ return db.collection(C('rewards')).doc(x.id).set(clone(x)); })); })
          .then(function(){ return Promise.all(Object.keys(nbs).map(function(id){ return db.collection(C('notebooks')).doc(id).set(nbs[id]); })); });
      });
    });
  },
  fail:function(e){ clearTimeout(this.slowTimer); if(e && (e.code==='revoked'||e.code==='not_granted')) this.mode='readonly'; else this.slow=true; if(!inLesson()) render(); },
  loadLocal:function(){ var ls=lsGet(K('state')); if(ls){ S=Object.assign(clone(DEFAULT_STATE),ls); setLang(S.lang); } REWARDS=lsGet(K('rewards'))||[]; this.loaded=true; },
  saveLocal:function(){ lsSet(K('state'),S); lsSet(K('rewards'),REWARDS); },
  settingsBody:function(){ var o=clone(S); delete o.sessions; return o; },
  q:function(fn){ var self=this; var p=this.chain.then(fn).catch(function(e){ self.err(e); }); this.chain=p; return p; },
  err:function(e){ var code=e&&e.code; if(code==='invalid_argument'||code==='not_granted'||code==='revoked'){ this.mode='readonly'; render(); toast(t('View only — this account can’t save here')); } else if(code==='quota_exceeded'){ toast(t('Storage is full — delete old sessions')); } else toast(t('Could not save — check your connection')); },
  saveSettings:function(){ if(this.isLocal()){this.saveLocal();return Promise.resolve();} if(this.mode!=='live') return Promise.resolve(); var self=this, body=this.settingsBody(); return this.q(function(){ return self.db.doc(SDOC()).set(body); }); },
  addSession:function(s){ if(this.isLocal()){this.saveLocal();return Promise.resolve();} if(this.mode!=='live') return Promise.resolve(); var self=this; return this.q(function(){ return self.db.collection(C('sessions')).doc(s.id).set(clone(s)); }); },
  delSession:function(id){ if(this.isLocal()){this.saveLocal();return Promise.resolve();} if(this.mode!=='live') return Promise.resolve(); var self=this; return this.q(function(){ return self.db.collection(C('sessions')).doc(id).delete(); }); },
  saveNotebook:function(id,nb){ if(this.isLocal()){ lsSet(K('nb_')+id,nb); return Promise.resolve(); } if(this.mode!=='live') return Promise.resolve(); var self=this; return this.q(function(){ return self.db.collection(C('notebooks')).doc(id).set(clone(nb)); }); },
  saveReward:function(r){ if(this.isLocal()){this.saveLocal();return Promise.resolve();} if(this.mode!=='live') return Promise.resolve(); var self=this; return this.q(function(){ return self.db.collection(C('rewards')).doc(r.id).set(clone(r)); }); },
  resetAll:function(){
    var self=this, ids=S.sessions.map(function(x){return x.id}), rids=REWARDS.map(function(x){return x.id}), lang=S.lang;
    S=clone(DEFAULT_STATE); S.lang=lang; REWARDS=[];
    Store.wipeLocal(UID);
    if(this.isLocal()){ this.saveLocal(); return Promise.resolve(); }
    if(this.mode!=='live') return Promise.resolve();
    var db=this.db, body=this.settingsBody();
    return this.q(function(){
      var jobs=ids.map(function(id){ return db.collection(C('sessions')).doc(id).delete(); })
        .concat(rids.map(function(id){ return db.collection(C('rewards')).doc(id).delete(); }));
      return Promise.all(jobs)
        .then(function(){ return db.collection(C('notebooks')).get(); })
        .then(function(qs){ return Promise.all(qs.docs.map(function(d){ return db.collection(C('notebooks')).doc(d.id).delete(); })); })
        .then(function(){ return db.doc(SDOC()).set(body); });
    });
  },
  /* ---- players ---- */
  wipeLocal:function(u){
    ['pend','wk','state','rewards'].forEach(function(n){ lsSet(K(n,u),null); });
    try{ var pre=K('nb_',u); Object.keys(localStorage).forEach(function(k){ if(k.indexOf(pre)===0) localStorage.removeItem(k); }); }catch(e){}
  },
  loadUsers:function(){
    var fix=function(list){ list=(list||[]).filter(function(x){return x&&x.id}); if(!list.length) list=[{id:'main',name:''}]; if(!list.some(function(x){return x.id===UID})) list.push({id:UID,name:''}); USERS=list; return list; };
    var self=this;
    if(this.mode==='live') return new Promise(function(res){
      var first=true;
      self.db.doc('meta/users').onSnapshot(function(snap){
        fix(snap.exists?(snap.data()||{}).list:null); self.watchNames();
        if(first){ first=false; res(USERS); } else if(!inLesson()) render();
      }, function(){ fix(USERS); if(first){ first=false; res(USERS); } });
    });
    return Promise.resolve(fix(lsGet('dg_users')));
  },
  saveUsers:function(){
    var list=clone(USERS||[]);
    if(this.isLocal()){ lsSet('dg_users',list); return Promise.resolve(); }
    if(this.mode!=='live') return Promise.resolve();
    var self=this; return this.q(function(){ return self.db.doc('meta/users').set({list:list}); });
  },
  /* A player's name lives in their own settings; the list only keeps ids (+ a fallback name). */
  watched:{},
  watchNames:function(){
    var self=this; if(this.mode!=='live') return;
    (USERS||[]).forEach(function(u){
      if(u.id===UID||self.watched[u.id]) return; self.watched[u.id]=true;
      self.db.doc(SDOC(u.id)).onSnapshot(function(snap){
        var d=snap.exists?snap.data():null; if(d&&d.player&&NAMES[u.id]!==d.player){ NAMES[u.id]=d.player; if(!inLesson()) render(); }
      }, function(){});
    });
  },
  userName:function(u){
    if(u.id===UID) return S.player||u.name||t('Player');
    if(this.isLocal()){ var st=lsGet(K('state',u.id)); if(st&&st.player) return st.player; }
    return NAMES[u.id]||u.name||t('Player');
  },
  addUser:function(name){
    var u={id:uid(),name:name}; USERS=(USERS||[]).concat([u]);
    var st=clone(DEFAULT_STATE); st.player=name; st.lang=S.lang; st.sound=S.sound; st.skill=S.skill; st.catalog=clone(S.catalog||DEFAULT_CATALOG);
    var self=this, p=Promise.resolve();
    if(this.isLocal()) lsSet(K('state',u.id),st);
    else if(this.mode==='live'){ var body=clone(st); delete body.sessions; p=this.q(function(){ return self.db.doc(SDOC(u.id)).set(body); }); }
    return p.then(function(){ return self.saveUsers(); }).then(function(){ return u; });
  },
  switchUser:function(id){ var go=function(){ lsSet('dg_user',id); location.hash='today'; location.reload(); }; this.chain.then(go,go); },
  deleteUser:function(id){
    var self=this; USERS=(USERS||[]).filter(function(x){return x.id!==id});
    this.wipeLocal(id);
    var p=Promise.resolve();
    if(this.mode==='live'){
      var db=this.db;
      p=this.q(function(){
        return Promise.all(['sessions','rewards','notebooks'].map(function(n){
          return db.collection(C(n,id)).get().then(function(qs){ return Promise.all(qs.docs.map(function(d){ return db.collection(C(n,id)).doc(d.id).delete(); })); });
        })).then(function(){ return db.doc(SDOC(id)).delete(); });
      });
    }
    return p.then(function(){ return self.saveUsers(); });
  },
  getNotebook:function(id){ if(this.mode==='live') return this.db.collection(C('notebooks')).doc(id).get().then(function(s){return s.exists?s.data():null}); return Promise.resolve(lsGet(K('nb_')+id)); }
};

/* ---------------- data files ---------------- */
var DATA={pz:null,games:null};
function loadData(){
  if(DATA.p) return DATA.p;
  DATA.p=Promise.all([fetch('data/puzzles.json').then(function(r){return r.json()}),fetch('data/games.json').then(function(r){return r.json()})])
    .then(function(a){DATA.pz=a[0];DATA.games=a[1];return DATA;})
    .catch(function(e){DATA.p=null;throw e;});
  return DATA.p;
}

/* ---------------- toast ---------------- */
var toastT=null;
function toast(m){ var el=document.getElementById('toast'); if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);} el.textContent=m; requestAnimationFrame(function(){el.classList.add('show')}); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove('show')},3400); }

/* ---------------- chessboard: lichess chessground ---------------- */
var FILES='abcdefgh';
var BOARDS={};
var ROLE={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
function boardFor(el,o){ var key=el.id||'b'; var b=BOARDS[key]; if(!b){ b=new Board(o); BOARDS[key]=b; } else b.opts(o); b.attach(el); return b; }
function Board(o){
  this.root=document.createElement('div'); this.root.className='cgbox';
  this.wrap=document.createElement('div'); this.wrap.className='cg-wrap'; this.root.appendChild(this.wrap);
  this.cg=null; this.game=null; this.last=null; this.prev=null; this.opts(o);
}
Board.prototype.opts=function(o){ o=o||{}; this.flip=!!o.flip; this.onMove=o.onMove||null; this.onTap=o.onTap||null; this.movable=o.movable||null; this.coords=o.coords!==false; this.marks={}; this.labels={}; this.arrows=[]; this.promo=null; };
Board.prototype.attach=function(el){ el.innerHTML=''; el.appendChild(this.root); var cg=this.cg; if(cg) requestAnimationFrame(function(){ cg.redrawAll(); }); };
Board.prototype.set=function(game,last){ this.game=game; this.last=last||null; this.render(); return this; };
Board.prototype.mark=function(m){ this.marks=m||{}; this.render(); return this; };
Board.prototype.render=function(){
  var self=this, g=this.game, fen=g?g.fen():'8/8/8/8/8/8/8/8 w - - 0 1', turn=fen.split(' ')[1]==='w'?'white':'black';
  var dests=new Map(), color;
  if(g && this.movable){ var side=this.movable==='both'?g.turn():this.movable;
    if(g.turn()===side){ color=side==='w'?'white':'black';
      g.moves({verbose:true}).forEach(function(m){ var a=dests.get(m.from); if(!a){a=[];dests.set(m.from,a);} if(a.indexOf(m.to)<0) a.push(m.to); }); } }
  var custom=new Map(), hint=[], shapes=[];
  Object.keys(this.marks).forEach(function(k){ var v=self.marks[k]; if(v==='hint') hint.push(k); else custom.set(k,v); });
  if(hint.length===2) shapes.push({orig:hint[0],dest:hint[1],brush:'paleBlue'});
  this.arrows.forEach(function(a){ shapes.push(a); });
  Object.keys(this.labels).forEach(function(k){ shapes.push({orig:k,brush:'green',label:{text:String(self.labels[k])}}); });
  var placement=fen.split(' ')[0];
  var cfg={fen:placement,orientation:this.flip?'black':'white',turnColor:turn,
    lastMove:this.last?[this.last.from,this.last.to]:undefined,check:(g&&g.inCheck())?turn:false,
    coordinates:this.coords,viewOnly:false,
    movable:{free:false,color:color,dests:dests,showDests:true,events:{after:function(o,d){ self._after(o,d); }}},
    highlight:{lastMove:true,check:true,custom:custom},
    animation:{enabled:true,duration:220},draggable:{enabled:true,showGhost:true},selectable:{enabled:true},
    premovable:{enabled:false},drawable:{enabled:true,visible:true,autoShapes:shapes},
    events:{select:this.onTap?function(k){ self.onTap(k); }:undefined}};
  if(!this.cg) this.cg=window.Chessground(this.wrap,cfg); else { this.cg.set(cfg); this.cg.setAutoShapes(shapes); }
  var lk=this.last?this.last.from+this.last.to:'';
  if(this.prev && this.prev.fen!==placement && lk && this.prev.lk!==lk){ Sound.play(countPieces(placement)<countPieces(this.prev.fen)?'Capture':'Move'); }
  this.prev={fen:placement,lk:lk};
  this._promoEl();
};
function countPieces(p){ return (p.match(/[a-zA-Z]/g)||[]).length; }
Board.prototype._after=function(o,d){
  var g=this.game, p=g&&g.get(o);
  if(p&&p.type==='p'&&(d[1]==='8'||d[1]==='1')){ this.promo={from:o,to:d,color:p.color}; this._promoEl(); return; }
  if(this.onMove) this.onMove({from:o,to:d}); else this.render();
};
Board.prototype._promoEl=function(){
  var old=this.wrap.querySelector('.promo-choice'); if(old) old.remove();
  if(!this.promo) return;
  var self=this, pr=this.promo, f=FILES.indexOf(pr.to[0]), r=+pr.to[1]-1;
  var x=this.flip?7-f:f, top=this.flip?(r===0):(r===7);
  var el=document.createElement('div'); el.className='promo-choice';
  ['q','n','r','b'].forEach(function(t,i){
    var sq=document.createElement('square'); sq.style.left=(x*12.5)+'%'; sq.style.top=((top?i:7-i)*12.5)+'%';
    sq.innerHTML='<piece class="'+ROLE[t]+' '+(pr.color==='w'?'white':'black')+'"></piece>';
    sq.addEventListener('click',function(e){ e.stopPropagation(); self.promo=null; el.remove(); if(self.onMove) self.onMove({from:pr.from,to:pr.to,promotion:t}); });
    el.appendChild(sq);
  });
  el.addEventListener('click',function(){ self.promo=null; el.remove(); self.render(); });
  this.wrap.appendChild(el);
};
window.addEventListener('resize',function(){ Object.keys(BOARDS).forEach(function(k){ var b=BOARDS[k]; if(b.cg) b.cg.redrawAll(); }); });

/* ---------------- sounds (lichess "SFX" theme) ---------------- */
var Sound={ctx:null,buf:{},loading:{},
  unlock:function(){ try{ if(!this.ctx){ var AC=window.AudioContext||window.webkitAudioContext; if(AC) this.ctx=new AC(); } if(this.ctx&&this.ctx.state==='suspended') this.ctx.resume(); }catch(e){} },
  load:function(n){ var self=this; if(this.buf[n]||this.loading[n]||!this.ctx) return; this.loading[n]=fetch('sound/'+n+'.mp3').then(function(r){return r.arrayBuffer()}).then(function(a){ return new Promise(function(res,rej){ self.ctx.decodeAudioData(a,res,rej); }); }).then(function(b){ self.buf[n]=b; return b; }).catch(function(){}); },
  play:function(n){ if(S.sound===false||!this.ctx) return; var self=this; this.load(n);
    var go=function(b){ try{ var s=self.ctx.createBufferSource(); s.buffer=b; var gn=self.ctx.createGain(); gn.gain.value=0.7; s.connect(gn); gn.connect(self.ctx.destination); s.start(0); }catch(e){} };
    if(this.buf[n]) go(this.buf[n]); else if(this.loading[n]) this.loading[n].then(function(b){ if(b) go(b); }); }
};
document.addEventListener('pointerdown',function(){ Sound.unlock(); ['Move','Capture'].forEach(function(n){ Sound.load(n); }); },true);

function uciOf(m){return m.from+m.to+(m.promotion||'')}
function moveFromUci(u){return {from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||undefined}}
function tryMove(g,m){ try{ return g.move(m); }catch(e){ return null; } }
function sanOfUci(fen,u){ var g=new Chess(fen); var m=tryMove(g,moveFromUci(u)); return m?m.san:u; }

/* ---------------- Stockfish ---------------- */
var ENGINE_URL='engine/stockfish-17.1-lite-single-03e3232.js';
var Engine={
  w:null,p:null,lis:null,q:Promise.resolve(),failed:false,
  start:function(){
    var self=this; if(this.p) return this.p;
    this.p=new Promise(function(res,rej){
      var w; try{ w=new Worker(ENGINE_URL); }catch(e){ self.failed=true; rej(e); return; }
      self.w=w; var stage=0;
      var t=setTimeout(function(){ self.failed=true; rej(new Error('timeout')); },45000);
      w.onmessage=function(e){ var l=String(e.data);
        if(stage===0&&l==='uciok'){ stage=1; w.postMessage('setoption name Hash value 16'); w.postMessage('isready'); }
        else if(stage===1&&l==='readyok'){ stage=2; clearTimeout(t); res(self); }
        else if(self.lis) self.lis(l); };
      w.onerror=function(e){ clearTimeout(t); self.failed=true; rej(e); };
      w.postMessage('uci');
    });
    this.p.catch(function(){});
    return this.p;
  },
  run:function(fen,opt){
    var self=this; opt=opt||{};
    var job=function(){ return new Promise(function(res){
      var score=null,pv=null;
      self.lis=function(l){
        if(l.indexOf('info')===0 && l.indexOf(' score ')>0 && l.indexOf(' multipv 2')<0){
          var m=l.match(/score (cp|mate) (-?\d+)/); if(m) score={t:m[1],v:+m[2]};
          var p=l.match(/ pv (.+)$/); if(p) pv=p[1].split(' ');
        } else if(l.indexOf('bestmove')===0){ self.lis=null; res({best:l.split(' ')[1],score:score,pv:pv}); }
      };
      self.w.postMessage('setoption name Skill Level value '+(opt.skill==null?20:opt.skill));
      self.w.postMessage('position fen '+fen);
      var go='go'; if(opt.depth) go+=' depth '+opt.depth; if(opt.movetime) go+=' movetime '+opt.movetime; if(go==='go') go+=' movetime 500';
      self.w.postMessage(go);
    }); };
    var p=this.q.then(function(){return self.start()}).then(job);
    this.q=p.catch(function(){}); return p;
  }
};
/* score from side to move -> centipawns for White */
function cpWhite(score,fen){ if(!score) return 0; var v=score.t==='mate'?(score.v>0?1:-1)*(10000-Math.abs(score.v)*10):score.v; return fen.split(' ')[1]==='w'?v:-v; }

/* ---------------- speech ---------------- */
var Speech={tts:null,tried:false,
  init:function(){ var self=this; if(this.tried) return; this.tried=true; try{ if(window.claude&&window.claude.use) Promise.resolve(window.claude.use('tts')).then(function(t){self.tts=t||null;}).catch(function(){}); }catch(e){} },
  available:function(){ return !!(this.tts || ('speechSynthesis' in window)); },
  say:function(text){
    if(this.tts){ return this.tts.speak(text,{language:LANG}).catch(function(){}); }
    if('speechSynthesis' in window){ try{ speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(text); u.lang=LOCALES[LANG]; u.rate=0.9; speechSynthesis.speak(u);}catch(e){} }
    return Promise.resolve();
  }
};
var PNAMES={en:{K:'King',Q:'Queen',R:'Rook',B:'Bishop',N:'Knight',P:'Pawn'},sk:{K:'Kráľ',Q:'Dáma',R:'Veža',B:'Strelec',N:'Jazdec',P:'Pešiak'},de:{K:'König',Q:'Dame',R:'Turm',B:'Läufer',N:'Springer',P:'Bauer'}};
var PPLUR={en:{K:'King',Q:'Queens',R:'Rooks',B:'Bishops',N:'Knights',P:'Pawns'},sk:{K:'Kráľ',Q:'Dámy',R:'Veže',B:'Strelce',N:'Jazdce',P:'Pešiaky'},de:{K:'König',Q:'Damen',R:'Türme',B:'Läufer',N:'Springer',P:'Bauern'}};
function sanWords(san){
  var N=PNAMES[LANG]||PNAMES.en, mate=san.indexOf('#')>0, chk=!mate&&san.indexOf('+')>0;
  var tail=mate?', '+t('checkmate'):chk?', '+t('check'):'';
  if(/^O-O-O/.test(san)) return t('castles queenside')+tail;
  if(/^O-O/.test(san)) return t('castles kingside')+tail;
  var m=san.replace(/[+#!?]/g,'').match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([QRBN]))?$/);
  if(!m) return san;
  var out=[]; out.push(m[1]?N[m[1]]:(m[4]&&m[2]?m[2]:''));
  if(m[1]&&(m[2]||m[3])) out.push((m[2]||'')+(m[3]||''));
  if(m[4]) out.push(t('takes'));
  out.push(m[5][0]+' '+m[5][1]);
  if(m[7]) out.push(t('promotes to')+' '+N[m[7]]);
  return out.join(' ').replace(/\s+/g,' ').trim()+tail;
}
function describeSide(fen,color){
  var g=new Chess(fen), N=PNAMES[LANG]||PNAMES.en, PL=PPLUR[LANG]||PPLUR.en, out=[];
  ['K','Q','R','B','N','P'].forEach(function(T){
    var sq=[]; g.board().forEach(function(r){ r.forEach(function(p){ if(p&&p.color===color&&p.type===T.toLowerCase()) sq.push(p.square); }); });
    if(!sq.length) return; sq.sort();
    out.push((sq.length>1?PL[T]:N[T])+' '+(sq.length>1?sq.slice(0,-1).join(', ')+' '+t('and')+' '+sq[sq.length-1]:sq[0]));
  });
  return out.join('; ');
}
