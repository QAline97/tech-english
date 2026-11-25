"""Tests for the AI tutor backend. They never call the real Claude API.

    python -m unittest discover tests
"""

import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import server
from tutor import claude
from tutor.prompts import KICKOFF_MESSAGE, SCENARIOS
from tutor.session import MAX_MESSAGES, RequestError, build_session, load_content

ROOT = Path(__file__).resolve().parent.parent
CONTENT = load_content(ROOT / "data")


def payload(**overrides):
    body = {"mode": "chat", "messages": [], "progress": {"weakIds": [], "stats": {}}}
    body.update(overrides)
    return body


class BuildSessionTests(unittest.TestCase):
    def test_kickoff_is_prepended(self):
        session = build_session(payload(), CONTENT)
        self.assertEqual(session.messages, [{"role": "user", "content": KICKOFF_MESSAGE}])

    def test_history_must_alternate_starting_with_tutor(self):
        good = [{"role": "assistant", "content": "Hi!"}, {"role": "user", "content": "Hello"}]
        self.assertEqual(len(build_session(payload(messages=good), CONTENT).messages), 3)
        for bad in (
            [{"role": "user", "content": "Hello"}],
            [{"role": "assistant", "content": "Hi!"}],  # must end with the learner
            [{"role": "assistant", "content": "Hi!"}, {"role": "system", "content": "x"}],
            [{"role": "assistant", "content": "Hi!"}, {"role": "user", "content": "  "}],
            [{"role": "assistant", "content": "Hi!"}, {"role": "user", "content": 42}],
            "not a list",
        ):
            with self.subTest(bad=bad), self.assertRaises(RequestError):
                build_session(payload(messages=bad), CONTENT)

    def test_limits(self):
        too_long = [{"role": "assistant", "content": "Hi"}, {"role": "user", "content": "a" * 2001}]
        with self.assertRaises(RequestError):
            build_session(payload(messages=too_long), CONTENT)
        too_many = [
            {"role": "assistant" if i % 2 == 0 else "user", "content": "ok"}
            for i in range(MAX_MESSAGES + 2)
        ]
        with self.assertRaises(RequestError):
            build_session(payload(messages=too_many), CONTENT)

    def test_unknown_mode_and_scenario(self):
        with self.assertRaises(RequestError):
            build_session(payload(mode="hack"), CONTENT)
        with self.assertRaises(RequestError):
            build_session(payload(mode="roleplay", scenario="nope"), CONTENT)

    def test_roleplay_uses_scenario_prompt(self):
        session = build_session(payload(mode="roleplay", scenario="daily"), CONTENT)
        self.assertIn(SCENARIOS["daily"]["prompt"], session.system)

    def test_weak_items_come_from_content_files_only(self):
        progress = {"weakIds": ["voc-001", "msg-001", "made-up", "voc-001", 7], "stats": {}}
        session = build_session(payload(progress=progress), CONTENT)
        self.assertIn('"meeting" = reunião', session.system)
        self.assertIn('"Connection timed out"', session.system)
        self.assertNotIn("made-up", session.system)
        self.assertEqual(session.system.count('"meeting"'), 1)

    def test_practice_needs_items(self):
        with self.assertRaises(RequestError):
            build_session(payload(mode="practice"), CONTENT)
        progress = {"weakIds": ["voc-002"], "stats": {}}
        self.assertIn("deadline", build_session(payload(mode="practice", progress=progress), CONTENT).system)

    def test_stats_are_sanitized(self):
        progress = {"weakIds": [], "stats": {"answered": 10, "correct": 50, "streak": "x"}}
        session = build_session(payload(progress=progress), CONTENT)
        self.assertIn("10 answers so far, 100% correct; current streak: 0 days", session.system)

    def test_system_prompt_is_stable_for_a_session(self):
        progress = {"weakIds": ["voc-001"], "stats": {"answered": 3, "correct": 2, "streak": 1}}
        first = build_session(payload(progress=progress), CONTENT).system
        later = build_session(
            payload(progress=progress, messages=[
                {"role": "assistant", "content": "Hi"}, {"role": "user", "content": "Hello"},
            ]),
            CONTENT,
        ).system
        self.assertEqual(first, later)


class FakeStream:
    def __init__(self, chunks, stop_reason="end_turn"):
        self.text_stream = iter(chunks)
        self.final = SimpleNamespace(
            stop_reason=stop_reason,
            content=[SimpleNamespace(type="thinking"), SimpleNamespace(type="text", text="".join(chunks))],
            usage=SimpleNamespace(input_tokens=10, cache_read_input_tokens=0, output_tokens=5),
        )

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return self.final


def fake_client(stream):
    calls = []

    def make_stream(**kwargs):
        calls.append(kwargs)
        return stream

    client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(stream=make_stream)))
    return client, calls


class StreamReplyTests(unittest.TestCase):
    def run_reply(self, stream):
        client, calls = fake_client(stream)
        session = build_session(payload(), CONTENT)
        with mock.patch.object(claude, "get_client", return_value=client):
            return list(claude.stream_reply(session)), calls

    def test_streams_text_then_done(self):
        events, calls = self.run_reply(FakeStream(["Hi ", "there!"]))
        self.assertEqual(events, [
            {"type": "text", "text": "Hi "},
            {"type": "text", "text": "there!"},
            {"type": "done", "text": "Hi there!"},
        ])
        request = calls[0]
        self.assertEqual(request["model"], claude.MODEL)
        self.assertEqual(request["fallbacks"], "default")
        self.assertIn("server-side-fallback-2026-07-01", request["betas"])

    def test_refusal_becomes_error(self):
        events, _ = self.run_reply(FakeStream(["Hi"], stop_reason="refusal"))
        self.assertEqual(events[-1]["type"], "error")


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.Handler.content = CONTENT
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(ROOT)))
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def request(self, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as err:
            with err:
                return err.code, err.read()

    def test_serves_app_files_only(self):
        self.assertEqual(self.request("/")[0], 200)
        self.assertEqual(self.request("/js/app.js")[0], 200)
        self.assertEqual(self.request("/data/vocabulary.json")[0], 200)
        for path in ("/server.py", "/.env", "/.env.example", "/tutor/prompts.py",
                     "/js/../server.py", "/%2e%2e/server.py", "/.git/config"):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_config(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
            status, body = self.request("/api/tutor/config")
        config = json.loads(body)
        self.assertEqual(status, 200)
        self.assertTrue(config["configured"])
        self.assertEqual({s["id"] for s in config["scenarios"]}, set(SCENARIOS))
        self.assertNotIn("prompt", config["scenarios"][0])

    def test_rejects_cross_site_requests(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
            # text/plain would skip the browser's CORS preflight
            status, _ = self.request("/api/tutor", payload(), {"Content-Type": "text/plain"})
            self.assertEqual(status, 403)
            status, _ = self.request("/api/tutor", payload(), {
                "Content-Type": "application/json", "Origin": "https://evil.example",
            })
            self.assertEqual(status, 403)
            status, _ = self.request("/api/tutor/config", headers={"Host": "evil.example"})
            self.assertEqual(status, 403)

    def test_validation_error_is_400(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}):
            status, body = self.request("/api/tutor", payload(mode="nope"), {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(body))

    def test_streams_reply(self):
        client, _ = fake_client(FakeStream(["Hello!"]))
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
                mock.patch.object(claude, "get_client", return_value=client):
            status, body = self.request("/api/tutor", payload(), {"Content-Type": "application/json"})
        events = [json.loads(line) for line in body.decode().splitlines()]
        self.assertEqual(status, 200)
        self.assertEqual(events[-1], {"type": "done", "text": "Hello!"})

    def test_not_configured(self):
        env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        with mock.patch.dict(os.environ, env, clear=True):
            status, _ = self.request("/api/tutor", payload(), {"Content-Type": "application/json"})
        self.assertEqual(status, 503)


if __name__ == "__main__":
    unittest.main()
