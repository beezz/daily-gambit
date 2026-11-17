#!/usr/bin/env python3
"""Generate the app icons in public/icons/ from the otter mascot in src/ui.js.

    python3 tools/make_icons.py

Writes icon.svg (rounded square), icon-maskable.svg (full bleed, otter inside the
safe zone) and renders the PNGs with headless Chrome (Playwright).
"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'icons')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
BG = '#f0d9b5'

src = open(os.path.join(ROOT, 'src', 'ui.js'), encoding='utf8').read()
inner = re.search(r"var MASCOT='<svg[^>]*>(.*?)</svg>'", src, re.S).group(1)
CX, CY = 68.5, 68.5  # centre of the otter's drawn content (tail sticks out to the right)


def icon(scale, maskable):
    bg = (f'<rect width="512" height="512" fill="{BG}"/>' if maskable else
          f'<rect width="512" height="512" rx="112" fill="{BG}"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' + bg +
            f'<g transform="translate(256 256) scale({scale}) translate({-CX} {-CY})">' + inner +
            '</g></svg>\n')


os.makedirs(OUT, exist_ok=True)
svgs = {'icon.svg': icon(4.0, False), 'icon-maskable.svg': icon(3.3, True)}
for name, s in svgs.items():
    open(os.path.join(OUT, name), 'w', encoding='utf8').write(s)

from playwright.sync_api import sync_playwright
jobs = [('icon.svg', 'icon-192.png', 192), ('icon.svg', 'icon-512.png', 512),
        ('icon-maskable.svg', 'icon-maskable-512.png', 512),
        ('icon-maskable.svg', 'apple-touch-icon.png', 180),  # iOS rounds the corners itself
        ('icon.svg', 'favicon-32.png', 32)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    for svg, png, size in jobs:
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content('<html><body style="margin:0;background:transparent">' +
                       svgs[svg].replace('<svg ', f'<svg width="{size}" height="{size}" ', 1) + '</body></html>')
        pg.screenshot(path=os.path.join(OUT, png), omit_background=True)
        pg.close()
    b.close()
print('icons written to', OUT)
