from __future__ import annotations

import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings
from app.services.llm.llm_client import BaseLLMClient, LLMUnavailable
from app.services.llm.schemas import LLMRequest, LLMResponse


def _think_setting() -> bool | str:
    """Resolve the Ollama `think` request field from config.

    Local non-reasoning models (qwen3:8b) want `False`. Hosted reasoning models
    like gpt-oss ignore `False` and reason anyway — which, under a small
    num_predict, burns the whole token budget on hidden reasoning and returns
    an empty answer. For those, set OLLAMA_THINK=low so reasoning stays minimal
    and the visible answer is produced. Accepts false/true or low/medium/high.
    """
    raw = str(settings.ollama_think or "").strip().lower()
    if raw in ("", "false", "off", "no", "0"):
        return False
    if raw in ("true", "on", "yes", "1"):
        return True
    return raw


class OllamaClient(BaseLLMClient):
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")

    def generate(self, request: LLMRequest) -> LLMResponse:
        started = time.perf_counter()
        payload: dict[str, object] = {
            "model": request.model,
            "prompt": request.prompt,
            "stream": False,
            "think": _think_setting(),
            "keep_alive": "10m",
            "options": {
                "temperature": 0.2,
                "top_p": 0.8,
                "num_ctx": int(request.metadata.get("num_ctx", 2048)),
                "num_predict": int(request.metadata.get("num_predict", 520 if request.expect_json else 180)),
            },
        }
        if request.expect_json:
            payload["format"] = "json"
        try:
            data = self._post_json("/api/generate", payload, request.timeout_seconds)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            elapsed = round((time.perf_counter() - started) * 1000)
            raise LLMUnavailable(str(exc)) from exc
        elapsed = round((time.perf_counter() - started) * 1000)
        text = str(data.get("response") or "").strip()
        return LLMResponse(text=text, provider="ollama", model=request.model, ok=bool(text), elapsed_ms=elapsed, raw=data)

    def is_reachable(self) -> bool:
        try:
            self._get_json("/api/tags", timeout_seconds=2)
            return True
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            return False

    def has_model(self, model: str) -> bool:
        try:
            payload = self._get_json("/api/tags", timeout_seconds=2)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            return False
        requested = model.strip().lower()
        for entry in payload.get("models", []):
            if not isinstance(entry, dict):
                continue
            available = str(entry.get("name") or entry.get("model") or "").strip().lower()
            if available == requested:
                return True
        return False

    def _post_json(self, path: str, payload: dict[str, object], timeout_seconds: int) -> dict:
        body = json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            data=body,
            headers={"Content-Type": "application/json", **self._auth_headers()},
            method="POST",
        )
        with urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    def _get_json(self, path: str, timeout_seconds: int) -> dict:
        request = Request(f"{self.base_url}{path}", headers=self._auth_headers(), method="GET")
        with urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def _auth_headers() -> dict[str, str]:
        # Ollama Cloud (https://ollama.com) authenticates with an API key;
        # a local Ollama ignores the header entirely.
        key = (settings.ollama_api_key or "").strip()
        return {"Authorization": f"Bearer {key}"} if key else {}
