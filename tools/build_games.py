"""Pick decisive Capablanca and Rubinstein wins for Guess-the-Move.

Usage: python3 build_games.py Capablanca.pgn Rubinstein.pgn out/games.json
(PGNs from https://github.com/rozim/ChessData/tree/master/PgnMentor)
"""
import chess.pgn, json, io, random, re, sys
random.seed(7)
FAMOUS=[('Capablanca','Tartakower','1924'),('Rotlewi','Rubinstein','1907'),('Bernstein','Capablanca','1914'),('Capablanca','Treybal','1929'),
 ('Janowski','Capablanca','1916'),('Capablanca','Fonaroff','1918'),('Capablanca','Spielmann','1927'),('Nimzowitsch','Capablanca','1927'),
 ('Capablanca','Lasker','1921'),('Lasker','Capablanca','1921'),('Rubinstein','Lasker','1909'),('Rubinstein','Teichmann','1908'),
 ('Rubinstein','Schlechter','1912'),('Rubinstein','Cohn','1909'),('Rubinstein','Salwe','1908'),('Rubinstein','Takacs','1926'),
 ('Capablanca','Alekhine','1927'),('Marshall','Capablanca','1909'),('Capablanca','Villegas','1914'),('Capablanca','Ed Lasker','1915'),
 ('Rubinstein','Hromadka','1923'),('Rubinstein','Maroczy','1920'),('Capablanca','Yates','1924'),('Capablanca','Kostic','1919'),
 ('Alekhine','Capablanca','1914'),('Capablanca','Nimzowitsch','1913'),('Rubinstein','Alekhine','1912'),('Bogoljubow','Rubinstein','1920')]
games=[]
for hero,fn in [('Capablanca',sys.argv[1]),('Rubinstein',sys.argv[2])]:
    f=open(fn,encoding='latin-1')
    while True:
        g=chess.pgn.read_game(f)
        if g is None: break
        h=g.headers; res=h.get('Result')
        if res not in ('1-0','0-1'): continue
        w,b=h.get('White',''),h.get('Black','')
        heroW = hero in w; heroB= hero in b
        if not (heroW or heroB): continue
        if (res=='1-0')!=heroW: continue
        if g.errors: continue
        moves=list(g.mainline_moves())
        n=(len(moves)+1)//2
        if not (22<=n<=60): continue
        if h.get('SetUp')=='1' or 'FEN' in h: continue
        yr=(h.get('Date','????')[:4])
        sanb=chess.Board(); sans=[]
        for m in moves: sans.append(sanb.san(m)); sanb.push(m)
        fam=any(a in w and c in b and yr==y for a,c,y in FAMOUS)
        games.append({'hero':hero,'w':w,'b':b,'ev':h.get('Event',''),'site':h.get('Site',''),'yr':yr,'res':res,'side':'w' if heroW else 'b','san':' '.join(sans),'n':n,'fam':fam})
print(len(games),'candidates; famous found:',sum(g['fam'] for g in games))
for g in games:
    if g['fam']: print(' *',g['w'],'-',g['b'],g['yr'],g['n'])
fam=[g for g in games if g['fam']]
# dedupe famous same pairing/year keep first
seen=set(); sel=[]
for g in fam:
    k=(g['w'],g['b'],g['yr'])
    if k in seen: continue
    seen.add(k); sel.append(g)
rest=[g for g in games if not g['fam'] and 25<=g['n']<=45]
random.shuffle(rest)
for hero in ('Capablanca','Rubinstein'):
    need=20-sum(1 for g in sel if g['hero']==hero)
    sel+= [g for g in rest if g['hero']==hero][:max(0,need)]
sel.sort(key=lambda g:(g['yr'],g['w']))
for g in sel: del g['fam']
json.dump(sel,open(sys.argv[3],'w'),separators=(',',':'))
print('selected',len(sel))
