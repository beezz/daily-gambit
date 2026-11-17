#!/usr/bin/env python3
"""Build Daily Gambit into dist/ (a folder of static files you can host anywhere).

    python3 build.py

- joins src/*.js into dist/app.js
- inlines the piece sprite into dist/index.html
- copies everything in public/ (libraries, engine, data, sounds, css, fonts, icons)
- copies src/pwa.js and generates dist/sw.js, the offline service worker, whose
  precache list is every file in dist/ and whose cache name is a hash of them all
"""
import hashlib, json, os, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, PUB, DIST = (os.path.join(ROOT, d) for d in ('src', 'public', 'dist'))
ORDER = ['i18n.js', 'core.js', 'lessons.js', 'openings.js', 'ui.js']

if os.path.isdir(DIST):
    shutil.rmtree(DIST)
shutil.copytree(PUB, DIST)
js = ''.join(open(os.path.join(SRC, f), encoding='utf8').read() + '\n' for f in ORDER)
open(os.path.join(DIST, 'app.js'), 'w', encoding='utf8').write('(function(){\n' + js + '\n})();\n')
html = open(os.path.join(SRC, 'index.html'), encoding='utf8').read()
html = html.replace('<!--SPRITE-->', open(os.path.join(SRC, 'pieces-sprite.svg'), encoding='utf8').read())
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf8').write(html)
shutil.copy(os.path.join(SRC, 'pwa.js'), os.path.join(DIST, 'pwa.js'))

# service worker: precache every file in dist/ (except _headers); new hash = new cache
SKIP = {'_headers', 'sw.js'}
files = sorted(os.path.relpath(os.path.join(d, f), DIST).replace(os.sep, '/')
               for d, _, fs in os.walk(DIST) for f in fs)
files = [f for f in files if f not in SKIP]
sw = open(os.path.join(SRC, 'sw.js'), encoding='utf8').read()
h = hashlib.sha256(sw.encode('utf8'))
for f in files:
    h.update(f.encode('utf8') + b'\0')
    h.update(open(os.path.join(DIST, f), 'rb').read())
sw = sw.replace('__CACHE_NAME__', 'daily-gambit-' + h.hexdigest()[:12])
sw = sw.replace('__PRECACHE_LIST__', json.dumps(files, indent=0))
open(os.path.join(DIST, 'sw.js'), 'w', encoding='utf8').write(sw)
print('built', DIST)
