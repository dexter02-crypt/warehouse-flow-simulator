from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
root=Path(__file__).resolve().parent
os.chdir(root)
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        super().end_headers()
server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
url=f"http://127.0.0.1:{server.server_port}/"
print(url)
try:webbrowser.open(url)
except Exception:pass
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
