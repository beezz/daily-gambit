"""Static server for dist/ that behaves like Cloudflare's asset hosting:
/index.html redirects (307) to / , and / serves index.html.
Usage: python3 tests/cf_like_server.py [port] [directory]"""
import http.server, os, sys, functools
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/index.html':
            self.send_response(307); self.send_header('Location', '/'); self.end_headers(); return
        return super().do_GET()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
d = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'dist')
http.server.ThreadingHTTPServer(('', port), functools.partial(H, directory=d)).serve_forever()
