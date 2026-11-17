// Check endgame positions with Stockfish (node). Usage: node evmoves.js [movetime_ms]  (needs: npm i chess.js)
// For each start position: evaluate every legal kid move (position after the move), report kid-perspective score.
const {spawn}=require('child_process');
const {Chess}=require('chess.js');
const MT=+process.argv[2]||900;
const eng=spawn('node',[require('path').join(__dirname,'../public/engine/stockfish-17.1-lite-single-03e3232.js')]);
let buf='';const W=[];eng.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);W.slice().forEach(w=>w(l));}});
const send=s=>eng.stdin.write(s+'\n');
const wait=p=>new Promise(r=>{const w=l=>{if(p(l)){W.splice(W.indexOf(w),1);r(l)}};W.push(w)});
async function ev(fen){ let last=null; const w=l=>{const m=l.match(/score (cp|mate) (-?\d+)/); if(m) last=m}; W.push(w);
  send('position fen '+fen); send('go movetime '+MT); await wait(l=>l.startsWith('bestmove')); W.splice(W.indexOf(w),1);
  let v=last[1]==='mate'?(+last[2]>0?1:-1)*(10000-Math.abs(+last[2])*10):+last[2]; return v; }
(async()=>{ send('uci'); await wait(l=>l==='uciok'); send('isready'); await wait(l=>l==='readyok');
 const P={vancura:'R7/6k1/P4r2/8/8/8/8/6K1 b - - 0 1',philidor:'4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',op2:'8/8/8/4k3/8/8/4P3/4K3 b - - 0 1',op3:'4k3/8/8/4K3/4P3/8/8/8 b - - 0 1',luc1:'1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',op1:'8/8/4k3/8/8/4K3/4P3/8 w - - 0 1',tri:'8/1p1k4/1P6/2PK4/8/8/8/8 w - - 0 1'};
 for(const [name,fen] of Object.entries(P)){
   const g=new Chess(fen), kid=g.turn(); const out=[];
   for(const m of g.moves({verbose:true})){ const h=new Chess(fen); h.move(m); const v=await ev(h.fen()); out.push([m.san, -v]); }
   out.sort((a,b)=>b[1]-a[1]); console.log(name.padEnd(9), out.map(x=>x[0]+':'+x[1]).join('  '));
 } process.exit(0); })();
