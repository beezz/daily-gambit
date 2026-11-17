"""Pick the puzzle sets from a filtered Lichess puzzle CSV.

Usage: python3 build_puzzles.py candidates.csv out/puzzles.json [seed]
(candidates.csv = rows of the Lichess puzzle database, https://database.lichess.org/#puzzles,
 filtered to rating 600–2100, popularity >= 85, plays >= 1500, rating deviation <= 85, 2–6 plies)
"""
import csv, json, random, sys, chess
random.seed(int(sys.argv[3]) if len(sys.argv)>3 else 0)  # the shipped set used a different, unpublished seed
rows=list(csv.reader(open(sys.argv[1])))
def themes(r): return r[7].split()
BAD={'veryLong','long','superGM','master','masterVsMaster'}
def ok(r): return not (set(themes(r))&{'veryLong'})
# --- Woodpecker sets: stratified by primary motif for variety
MOTIFS=['fork','pin','skewer','discoveredAttack','mateIn1','mateIn2','hangingPiece','backRankMate','deflection','attraction','doubleCheck','trappedPiece','promotion','sacrifice','clearance','interference','xRayAttack','advancedPawn','capturingDefender','quietMove','intermezzo','kingsideAttack','exposedKing','smotheredMate','endgame']
def pick_set(lo,hi,n,used):
    pool=[r for r in rows if lo<=int(r[3])<hi and ok(r) and r[0] not in used and int(r[5])>=90 and int(r[6])>=3000]
    random.shuffle(pool)
    out=[];cnt={}
    cap=n//10
    for r in pool:
        th=themes(r); m=next((t for t in MOTIFS if t in th),'other')
        if cnt.get(m,0)>=cap: continue
        cnt[m]=cnt.get(m,0)+1; out.append(r); used.add(r[0])
        if len(out)==n: break
    out.sort(key=lambda r:int(r[3]))
    return out,cnt
used=set(); sets={}
for name,lo,hi in [('easy',700,1200),('medium',1200,1600),('hard',1600,2000)]:
    s,c=pick_set(lo,hi,200,used); sets[name]=s; print(name,len(s),int(s[0][3]),int(s[-1][3]),sorted(c.items(),key=lambda x:-x[1])[:8])
def short_th(r):
    keep=[t for t in themes(r) if t in MOTIFS or t in ('mate','crushing','advantage')]
    return ' '.join(keep[:4])
wood={k:[[r[0],r[1],r[2],int(r[3]),short_th(r)] for r in v] for k,v in sets.items()}

# --- piece description
NAMES={chess.KING:'King',chess.QUEEN:'Queen',chess.ROOK:'Rook',chess.BISHOP:'Bishop',chess.KNIGHT:'Knight',chess.PAWN:'Pawn'}
ORDER=[chess.KING,chess.QUEEN,chess.ROOK,chess.BISHOP,chess.KNIGHT,chess.PAWN]
def describe(b,color):
    parts=[]
    for pt in ORDER:
        sqs=sorted(chess.square_name(s) for s in b.pieces(pt,color))
        if not sqs: continue
        nm=NAMES[pt]+('s' if len(sqs)>1 else '')
        parts.append(nm+' '+(', '.join(sqs[:-1])+' and '+sqs[-1] if len(sqs)>1 else sqs[0]))
    return '; '.join(parts)
def distractors(b,correct,k=3):
    legal=[m for m in b.legal_moves if m!=correct]
    def score(m):
        s=0
        if b.is_capture(m): s+=2
        if b.gives_check(m): s+=3
        if b.piece_type_at(m.from_square)==b.piece_type_at(correct.from_square): s+=1
        return s+random.random()
    legal.sort(key=score,reverse=True)
    return [b.san(m) for m in legal[:k]]

# --- Blindfold: few pieces, short
blind=[]
pool=[r for r in rows if 700<=int(r[3])<1500 and r[0] not in used and len(r[2].split()) in (2,4)]
random.shuffle(pool)
for r in pool:
    b=chess.Board(r[1]); mv=r[2].split()
    first=chess.Move.from_uci(mv[0]); opp_san=b.san(first); b.push(first)
    if len(b.piece_map())>8: continue
    th=themes(r)
    if not any(t in th for t in ('mateIn1','mateIn2','fork','skewer','pin','promotion','hangingPiece','discoveredAttack','backRankMate','deflection')): continue
    me=b.turn; fen=b.fen()
    steps=[]; bb=b.copy()
    for i,u in enumerate(mv[1:]):
        m=chess.Move.from_uci(u)
        if i%2==0: steps.append({'san':bb.san(m),'uci':u,'alt':distractors(bb,m)})
        else: steps.append({'san':bb.san(m),'uci':u,'opp':True})
        bb.push(m)
    side='White' if me==chess.WHITE else 'Black'
    blind.append({'id':r[0],'fen':fen,'r':int(r[3]),'side':side,'last':opp_san,
        'w':describe(b,chess.WHITE),'b':describe(b,chess.BLACK),'steps':steps,'th':short_th(r)})
    used.add(r[0])
    if len(blind)>=120: break
blind.sort(key=lambda x:x['r'])
print('blind',len(blind))

# --- Threat drills: after first move, the side to move has a strong move; kid plays the *other* side and must spot it
threat=[]
pool=[r for r in rows if 700<=int(r[3])<1600 and r[0] not in used and int(r[5])>=90]
random.shuffle(pool)
cnt={}
for r in pool:
    th=themes(r); m=next((t for t in MOTIFS if t in th),'other')
    if cnt.get(m,0)>=15: continue
    b=chess.Board(r[1]); mv=r[2].split()
    first=chess.Move.from_uci(mv[0]); last=b.san(first); b.push(first)
    ans=chess.Move.from_uci(mv[1])
    # accept any mate-in-1 too
    alts=[x.uci() for x in b.legal_moves if x!=ans and (b.copy(stack=False).is_checkmate() if False else False)]
    mates=[]
    for x in b.legal_moves:
        b.push(x)
        if b.is_checkmate(): mates.append(x.uci())
        b.pop()
    threat.append({'id':r[0],'fen':r[1],'pre':mv[0],'last':last,'ans':mv[1],'ansSan':b.san(ans),'mates':mates,'r':int(r[3]),'th':short_th(r)})
    cnt[m]=cnt.get(m,0)+1; used.add(r[0])
    if len(threat)>=150: break
threat.sort(key=lambda x:x['r'])
print('threat',len(threat))
json.dump({'wood':wood,'blind':blind,'threat':threat},open(sys.argv[2],'w'),separators=(',',':'))
