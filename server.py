"""Local server for Tech English Daily: serves the app and the AI tutor API.

    python server.py            # http://localhost:8000
    python server.py --port 9000

The Claude API key stays here, on the server (ANTHROPIC_API_KEY in the
environment or in a .env file); the browser never sees it.
"""

import argparse
import json
import logging
import os
import posixpath
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from tutor.prompts import public_scenarios
from tutor.session import RequestError, build_session, load_content

ROOT = Path(__file__).resolve().parent
STATIC_PREFIXES = ("/css/", "/js/", "/data/")
STATIC_FILES = {"/", "/index.html"}
MAX_BODY_BYTES = 200_000
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]"}

log = logging.getLogger("tech-english")


def load_dotenv(path: Path) -> None:
    """Read KEY=VALUE lines from .env without overriding real environment variables."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def tutor_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


class Handler(SimpleHTTPRequestHandler):
    content = {}  # set in main()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        log.debug("%s - %s", self.address_string(), format % args)

    def _path(self) -> str:
        return posixpath.normpath(unquote(urlsplit(self.path).path))

    def _host_is_local(self) -> bool:
        # Rejecting other Host names blocks DNS-rebinding attacks from web pages.
        host = self.headers.get("Host", "")
        name = host.rsplit(":", 1)[0] if not host.endswith("]") else host
        return name in LOCAL_HOSTS

    def _send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._host_is_local():
            self.send_error(403)
            return
        path = self._path()
        if path == "/api/tutor/config":
            self._send_json(200, {"configured": tutor_configured(), "scenarios": public_scenarios()})
        elif path in STATIC_FILES or path.startswith(STATIC_PREFIXES):
            super().do_GET()
        else:
            # Never serve anything else from the project folder (.env, code...).
            self.send_error(404)

    def do_HEAD(self):
        self.send_error(405)

    def do_POST(self):
        if self._path() != "/api/tutor":
            self.send_error(404)
            return
        # Requiring JSON forces a CORS preflight (which this server never
        # approves), so other websites cannot make the browser call the API.
        content_type = self.headers.get("Content-Type", "").split(";")[0].strip()
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if (
            not self._host_is_local()
            or content_type != "application/json"
            or (origin and urlsplit(origin).netloc != host)
        ):
            self._send_json(403, {"error": "Requisição não permitida."})
            return
        if not tutor_configured():
            self._send_json(503, {"error": "O tutor de IA não está configurado (falta ANTHROPIC_API_KEY)."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY_BYTES:
            self._send_json(413, {"error": "Requisição grande demais."})
            return
        try:
            payload = json.loads(self.rfile.read(length))
            session = build_session(payload, self.content)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Requisição inválida."})
            return
        except RequestError as err:
            self._send_json(400, {"error": str(err)})
            return

        from tutor.claude import stream_reply  # imported lazily: needs the anthropic package

        # Newline-delimited JSON, one event per line, written as it arrives.
        # (HTTP/1.0: the response ends when the connection closes.)
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            for event in stream_reply(session):
                self.wfile.write(json.dumps(event, ensure_ascii=False).encode("utf-8") + b"\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            log.info("Browser closed the connection; stopped the reply.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_dotenv(ROOT / ".env")
    Handler.content = load_content(ROOT / "data")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(ROOT)))
    print(f"Tech English Daily: http://localhost:{args.port}")
    if not tutor_configured():
        print("Tutor de IA desativado: crie um arquivo .env com ANTHROPIC_API_KEY=... (veja .env.example)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAté logo!")


if __name__ == "__main__":
    main()
