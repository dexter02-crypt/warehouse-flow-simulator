"""Loopback-only asset server. Never serves a repository directory listing or .git."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
import webbrowser

ROOT = Path(__file__).resolve().parent
TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
         '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png'}


def asset_paths(root: Path) -> frozenset[str]:
    obj = json.loads((root / 'ASSETS.json').read_text(encoding='utf-8'))
    if not isinstance(obj, list) or not obj or len(obj) != len(set(obj)):
        raise ValueError('Invalid asset list')
    for path in obj:
        if not isinstance(path, str):
            raise ValueError('Invalid asset path')
        p = PurePosixPath(path)
        if (not isinstance(path, str) or p.is_absolute() or not p.parts or
                any(part.startswith('.') or part in ('.', '..') for part in p.parts) or
                p.as_posix() != path or '\\' in path):
            raise ValueError('Invalid asset path')
    return frozenset(obj)


class Handler(BaseHTTPRequestHandler):
    def __init__(self, *args, root: Path, assets: frozenset[str], **kwargs):
        self.root, self.assets = root, assets
        super().__init__(*args, **kwargs)

    def do_HEAD(self):
        self.respond(head=True)

    def do_GET(self):
        self.respond(head=False)

    def respond(self, head: bool):
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if self.headers.get('Host', '') not in hosts:
            self.send_error(403); return
        origin = self.headers.get('Origin')
        if origin and origin not in {f'http://{h}' for h in hosts}:
            self.send_error(403); return
        raw = unquote(urlsplit(self.path).path)
        if raw == '/favicon.ico':
            self.send_response(204); self.send_header('Content-Length', '0'); self.end_headers(); return
        name = 'index.html' if raw == '/' else raw.removeprefix('/')
        if name not in self.assets or '\\' in name:
            self.send_error(404); return
        target = self.root
        for part in PurePosixPath(name).parts:
            target = target / part
            if target.is_symlink():
                self.send_error(404); return
        try:
            if not target.is_file() or self.root not in target.resolve().parents or target.stat().st_size > 4 * 1024 * 1024:
                self.send_error(404); return
            data = target.read_bytes()
        except OSError:
            self.send_error(404); return
        self.send_response(200)
        self.send_header('Content-Type', TYPES.get(target.suffix, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
        self.end_headers()
        if not head:
            self.wfile.write(data)


def make_server(root: Path = ROOT, port: int = 0) -> ThreadingHTTPServer:
    root = root.resolve()
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, root=root, assets=asset_paths(root)))
    server.daemon_threads = True
    return server


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-open', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error('port must be 0–65535')
    with make_server(port=args.port) as server:
        url = f'http://127.0.0.1:{server.server_port}/'
        print(url, flush=True)
        if not args.no_open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
