// Check endgame positions with Stockfish (node). Usage: node sfcheck.js positions.json
const {spawn}=require('child_process');
const eng=spawn('node',[require('path').join(__dirname,'../public/engine/stockfish-17.1-lite-single-03e3232.js')]);
let buf='';const waiters=[];
eng.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);waiters.forEach(w=>w(l));}});
const send=s=>eng.stdin.write(s+'\n');
function waitFor(pred){return new Promise(r=>{const w=l=>{if(pred(l)){waiters.splice(waiters.indexOf(w),1);r(l)}};waiters.push(w)})}
(async()=>{
 send('uci');await waitFor(l=>l==='uciok');
 const list=JSON.parse(require('fs').readFileSync(process.argv[2]));
 for(const p of list){
  send('ucinewgame');send('position fen '+p.fen);let last='';
  const w=l=>{if(l.startsWith('info')&&l.includes(' score '))last=l};waiters.push(w);
  send('go depth '+(p.depth||22));const bm=await waitFor(l=>l.startsWith('bestmove'));waiters.splice(waiters.indexOf(w),1);
  const m=last.match(/score (cp|mate) (-?\d+)/);console.log(p.name.padEnd(28),p.fen.padEnd(40),m?m[1]+' '+m[2]:'?',bm);
 }
 process.exit(0);
})();
