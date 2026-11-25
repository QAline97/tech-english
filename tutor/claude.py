"""Streams tutor replies from the Claude API."""

import logging
import os
from collections.abc import Iterator

import anthropic

from .session import TutorSession

log = logging.getLogger(__name__)

MODEL = os.environ.get("TUTOR_MODEL", "claude-opus-5-5")
# Short conversational turns do well at low effort; raise it for deeper answers.
EFFORT = os.environ.get("TUTOR_EFFORT", "low")
MAX_TOKENS = 16000

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
    return _client


def stream_reply(session: TutorSession) -> Iterator[dict]:
    """Yield events: {"type": "text"}, then one {"type": "done"} or {"type": "error"}.

    The history holds only the text of earlier turns (no thinking blocks), so
    it is rebuilt the same way on every request and the cached prefix stays valid.
    """
    try:
        with get_client().beta.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=session.system,
            messages=session.messages,
            output_config={"effort": EFFORT},
            cache_control={"type": "ephemeral"},
            # If a safety classifier declines the request, retry server-side
            # on the model Anthropic recommends for that case.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        ) as stream:
            for text in stream.text_stream:
                yield {"type": "text", "text": text}
            final = stream.get_final_message()
    except anthropic.AuthenticationError:
        yield _error("A chave da API é inválida. Confira o ANTHROPIC_API_KEY no arquivo .env.")
        return
    except anthropic.PermissionDeniedError:
        yield _error("A chave da API não tem permissão para usar este modelo.")
        return
    except anthropic.RateLimitError:
        yield _error("Muitas mensagens em pouco tempo. Espere um minuto e tente de novo.")
        return
    except anthropic.APIConnectionError:
        yield _error("Não foi possível conectar à API. Confira sua internet.")
        return
    except anthropic.APIStatusError as err:
        log.error("Claude API error %s (request id: %s)", err.status_code, err.request_id)
        yield _error("O tutor está indisponível agora. Tente de novo em instantes.")
        return

    if final.stop_reason == "refusal":
        yield _error("O tutor não pode responder a essa mensagem. Tente escrever de outro jeito.")
        return

    text = "".join(block.text for block in final.content if block.type == "text").strip()
    if not text:
        yield _error("O tutor não respondeu. Tente de novo.")
        return
    usage = final.usage
    log.info(
        "reply: %s input, %s cached, %s output tokens",
        usage.input_tokens, usage.cache_read_input_tokens, usage.output_tokens,
    )
    yield {"type": "done", "text": text}


def _error(message: str) -> dict:
    return {"type": "error", "message": message}
