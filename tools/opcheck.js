// Engine check for the opening repertoire: for each of "our" moves, compare it with
// Stockfish's best move. Usage: node opcheck.js moves.json   (written by build_openings.py)
// Exits 1 if any move loses more than LIMIT centipawns.
const {spawn}=require('child_process');
const LIMIT=60, DEPTH=+(process.env.DEPTH||16);
const eng=spawn('node',[require('path').join(__dirname,'../public/engine/stockfish-17.1-lite-single-03e3232.js')]);
let buf='';const waiters=[];
eng.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);waiters.slice().forEach(w=>w(l));}});
const send=s=>eng.stdin.write(s+'\n');
function waitFor(pred){return new Promise(r=>{const w=l=>{if(pred(l)){waiters.splice(waiters.indexOf(w),1);r(l)}};waiters.push(w)})}
async function evalPos(fen,moves){ // score (cp, side to move in fen) when searching only `moves` (or all)
  send('position fen '+fen);let last='';
  const w=l=>{if(l.startsWith('info')&&l.includes(' score ')&&l.includes(' pv '))last=l};waiters.push(w);
  send('go depth '+DEPTH+(moves?' searchmoves '+moves:''));const bm=await waitFor(l=>l.startsWith('bestmove'));waiters.splice(waiters.indexOf(w),1);
  const m=last.match(/score (cp|mate) (-?\d+)/); let cp=0;
  if(m) cp=m[1]==='cp'?+m[2]:(+m[2]>0?10000-+m[2]:-10000-+m[2]);
  return {cp,best:bm.split(' ')[1]};
}
(async()=>{
  send('uci');await waitFor(l=>l==='uciok');send('setoption name Hash value 64');send('isready');await waitFor(l=>l==='readyok');
  const list=JSON.parse(require('fs').readFileSync(process.argv[2]));let bad=0;
  for(const p of list){
    const all=await evalPos(p.fen), mine=p.uci===all.best?all:await evalPos(p.fen,p.uci), loss=all.cp-mine.cp;
    if(loss>LIMIT){bad++;console.log('LOSS',String(loss).padStart(5),'cp',p.rep.padEnd(8),p.path,'| best',all.best,'| eval',mine.cp);}
  }
  console.log('engine check:',list.length,'moves,',bad,'over',LIMIT,'cp (depth '+DEPTH+')');
  process.exit(bad?1:0);
})();
