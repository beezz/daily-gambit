#!/usr/bin/env python3
"""Build Daily Gambit into dist/ (a folder of static files you can host anywhere).

    python3 build.py

- joins src/*.js into dist/app.js
- inlines the piece sprite into dist/index.html
- copies everything in public/ (libraries, engine, data, sounds, css)
"""
import os, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, PUB, DIST = (os.path.join(ROOT, d) for d in ('src', 'public', 'dist'))
ORDER = ['i18n.js', 'core.js', 'lessons.js', 'ui.js']

if os.path.isdir(DIST):
    shutil.rmtree(DIST)
shutil.copytree(PUB, DIST)
js = ''.join(open(os.path.join(SRC, f), encoding='utf8').read() + '\n' for f in ORDER)
open(os.path.join(DIST, 'app.js'), 'w', encoding='utf8').write('(function(){\n' + js + '\n})();\n')
html = open(os.path.join(SRC, 'index.html'), encoding='utf8').read()
html = html.replace('<!--SPRITE-->', open(os.path.join(SRC, 'pieces-sprite.svg'), encoding='utf8').read())
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf8').write(html)
print('built', DIST)
