"""Build public/data/openings.json from tools/openings_src.py.

  python3 tools/build_openings.py NAMES_DIR [--check]

NAMES_DIR holds a.tsv … e.tsv from https://github.com/lichess-org/chess-openings (CC0),
used for opening names. --check runs Stockfish (tools/opcheck.js) on every move of "our"
side and fails if one loses more than 60 centipawns against the engine's best move.
"""
import sys, os, json, csv, subprocess, tempfile
import chess
sys.path.insert(0, os.path.dirname(__file__))
from openings_src import REPS, NOTES

ROOT = os.path.join(os.path.dirname(__file__), '..')
names_dir = sys.argv[1]
check = '--check' in sys.argv

def epd(b): return ' '.join(b.fen().split(' ')[:4])

# opening names by position (later = more specific rows win on equal positions)
NAMES = {}
for f in 'abcde':
    with open(os.path.join(names_dir, f + '.tsv'), encoding='utf8') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            b = chess.Board()
            for tok in row['pgn'].split():
                if tok.endswith('.'): continue
                b.push_san(tok)
            NAMES[epd(b)] = (row['eco'], row['name'])

out = {'reps': []}
to_check = []
for rep in REPS:
    nodes = {'': {'fen': chess.STARTING_FEN, 'ch': []}}
    lines = []
    for li, line in enumerate(rep['lines']):
        b = chess.Board(); path = []
        for i, san in enumerate(line.split()):
            mv = b.parse_san(san)        # raises on illegal / ambiguous SAN
            norm = b.san(mv)
            if norm != san: raise SystemExit('%s line %d: write %s as %s' % (rep['id'], li, san, norm))
            parent = ' '.join(path)
            ours = (b.turn == chess.WHITE) == (rep['side'] == 'w')
            before = b.fen()
            b.push(mv); path.append(san); key = ' '.join(path)
            if key not in nodes:
                nodes[key] = {'fen': b.fen(), 'ch': []}
                nodes[parent]['ch'].append(san)
                if ours: to_check.append({'rep': rep['id'], 'path': key, 'fen': before, 'uci': mv.uci()})
            node = nodes[key]
            node['ours'] = ours
            if epd(b) in NAMES: node['eco'], node['name'] = NAMES[epd(b)]
            if ours and key in NOTES: node['note'] = NOTES[key]
        if not nodes[' '.join(path)].get('ours'):
            raise SystemExit('%s line %d must end with our move: %s' % (rep['id'], li, line))
        lines.append(line)
    # fill names down the tree (a position without its own name keeps the parent's)
    for key in sorted(nodes, key=lambda k: len(k.split()) if k else 0):
        if key and 'name' not in nodes[key]:
            par = nodes[' '.join(key.split()[:-1])]
            if 'name' in par: nodes[key]['eco'], nodes[key]['name'] = par['eco'], par['name']
    # a line that is a prefix of another line is not a separate drill line
    keep = [l for l in lines if not any(o != l and o.startswith(l + ' ') for o in lines)]
    out['reps'].append({'id': rep['id'], 'side': rep['side'], 'icon': rep['icon'], 'title': rep['title'],
                        'lines': keep, 'nodes': nodes})
    print('%-8s %3d lines, %3d positions, %3d notes' % (rep['id'], len(keep), len(nodes), sum(1 for n in nodes.values() if 'note' in n)))

if check:
    tmp = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False); json.dump(to_check, tmp); tmp.close()
    res = subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'opcheck.js'), tmp.name], capture_output=True, text=True)
    print(res.stdout, end='')
    if res.returncode: print(res.stderr); raise SystemExit('engine check failed')

dst = os.path.join(ROOT, 'public', 'data', 'openings.json')
json.dump(out, open(dst, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print('wrote', dst, os.path.getsize(dst), 'bytes')
