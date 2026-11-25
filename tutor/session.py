"""Validation of tutor requests coming from the browser.

The browser sends the conversation so far plus a snapshot of the learner's
progress (only item ids and numbers). Item details are looked up here, from the
app's own content files, so the system prompt is built only from trusted data.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from .prompts import KICKOFF_MESSAGE, SCENARIOS, build_system_prompt

MODES = {"chat", "practice", "roleplay"}
MAX_MESSAGES = 60
MAX_MESSAGE_CHARS = 2000
MAX_WEAK_ITEMS = 15
CONTENT_FILES = ("vocabulary", "messages", "phrases")


class RequestError(ValueError):
    """The request is invalid; the message is shown to the learner."""


def load_content(data_dir: Path) -> dict[str, tuple[str, dict]]:
    """Map every content id to (kind, item)."""
    index = {}
    for kind in CONTENT_FILES:
        items = json.loads((data_dir / f"{kind}.json").read_text(encoding="utf-8"))
        for item in items:
            index[item["id"]] = (kind, item)
    return index


@dataclass
class TutorSession:
    system: str
    messages: list[dict]


def _validate_messages(raw) -> list[dict]:
    if not isinstance(raw, list):
        raise RequestError("Formato de conversa inválido.")
    if len(raw) > MAX_MESSAGES:
        raise RequestError("A conversa ficou longa demais. Comece uma nova sessão.")

    # The tutor speaks first, so the history alternates assistant, user, ...
    # and a request always ends with the learner's turn (or is empty: kickoff).
    messages = []
    for i, msg in enumerate(raw):
        expected_role = "assistant" if i % 2 == 0 else "user"
        if not isinstance(msg, dict) or msg.get("role") != expected_role:
            raise RequestError("Formato de conversa inválido.")
        content = msg.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RequestError("Mensagem vazia.")
        if len(content) > MAX_MESSAGE_CHARS:
            raise RequestError(f"Mensagem longa demais (máximo de {MAX_MESSAGE_CHARS} caracteres).")
        messages.append({"role": expected_role, "content": content})

    if messages and messages[-1]["role"] != "user":
        raise RequestError("Formato de conversa inválido.")
    return messages


def _validate_stats(raw) -> dict:
    stats = {}
    raw = raw if isinstance(raw, dict) else {}
    for key in ("answered", "correct", "streak"):
        value = raw.get(key, 0)
        stats[key] = value if isinstance(value, int) and 0 <= value < 10**7 else 0
    stats["correct"] = min(stats["correct"], stats["answered"])
    return stats


def build_session(payload, content: dict[str, tuple[str, dict]]) -> TutorSession:
    if not isinstance(payload, dict):
        raise RequestError("Requisição inválida.")

    mode = payload.get("mode")
    if mode not in MODES:
        raise RequestError("Modo de estudo desconhecido.")
    scenario = payload.get("scenario") if mode == "roleplay" else None
    if mode == "roleplay" and scenario not in SCENARIOS:
        raise RequestError("Simulação desconhecida.")

    progress = payload.get("progress")
    progress = progress if isinstance(progress, dict) else {}
    weak_ids = progress.get("weakIds")
    weak_ids = weak_ids if isinstance(weak_ids, list) else []
    weak_items = []
    for item_id in weak_ids:
        if isinstance(item_id, str) and item_id in content and content[item_id] not in weak_items:
            weak_items.append(content[item_id])
        if len(weak_items) == MAX_WEAK_ITEMS:
            break
    if mode == "practice" and not weak_items:
        raise RequestError("Não há itens para praticar.")

    messages = _validate_messages(payload.get("messages"))
    system = build_system_prompt(mode, scenario, weak_items, _validate_stats(progress.get("stats")))
    # The API requires the first message to come from the user, so a fixed
    # kickoff message opens every conversation (it is not shown in the app).
    return TutorSession(system=system, messages=[{"role": "user", "content": KICKOFF_MESSAGE}, *messages])
