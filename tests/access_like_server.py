"""Like cf_like_server.py, plus a Cloudflare Access-like login wall: every request needs the
cookie CF_Authorization=ok, otherwise it is redirected (302) to a login page on another origin.
GET /__deploy rebuilds nothing — tests swap the served directory with ?dir=... instead.
Usage: python3 tests/access_like_server.py [port] [directory]"""
import http.server, os, sys, functools, urllib.parse
STATE = {'dir': None}
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=STATE['dir'], **k)
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/__serve':      # test hook: switch the served directory (a "new deploy")
            STATE['dir'] = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)['dir'][0]
            self.send_response(204); self.end_headers(); return
        if 'CF_Authorization=ok' not in (self.headers.get('Cookie') or ''):
            self.send_response(302); self.send_header('Location', 'http://127.0.0.1:%d/login' % (PORT + 1)); self.end_headers(); return
        if path == '/index.html':
            self.send_response(307); self.send_header('Location', '/'); self.end_headers(); return
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=0, must-revalidate')   # what Cloudflare sends for static assets
        super().end_headers()
    def log_message(self, *a): pass
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
STATE['dir'] = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'dist')
http.server.ThreadingHTTPServer(('', PORT), H).serve_forever()
