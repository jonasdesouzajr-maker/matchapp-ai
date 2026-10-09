#!/usr/bin/env python3
"""MatchApp Ai — local voice and text companion. Python standard library only."""
from __future__ import annotations

import argparse
import json
import socket
import sys
import threading
import webbrowser
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from chat_api import provider, respond

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s\n" % (fmt % args))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def local_host(self) -> bool:
        host = self.headers.get("Host", "")
        return host in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}")

    def send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if not self.local_host():
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if self.path == "/api/health":
            self.send_json(HTTPStatus.OK, {"service": "jonas", "chat_configured": bool(provider()),
                                           "mode": "local-preview"})
            return
        if self.path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Unknown endpoint."})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if not self.local_host():
            return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Invalid host."})
        if self.path != "/api/ask":
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Unknown endpoint."})
        respond(self)


def free_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", preferred))
        except OSError:
            sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Run MatchApp Ai locally.")
    parser.add_argument("--port", type=int, default=8899)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not (WEB / "index.html").is_file():
        print("Missing web/index.html.", file=sys.stderr)
        return 1
    port = free_port(args.port)
    handler = partial(QuietHandler, directory=str(WEB))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"MatchApp Ai on {url}", flush=True)
    print("AI provider: configured" if provider() else "AI provider: not configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)", flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
