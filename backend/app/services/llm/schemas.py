from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


LLMTask = Literal[
    "chat",
    "recommendation_explanation",
    "asset_explanation",
    "market_signal_copy",
    "market_explanation",
    "summarize",
]


@dataclass(frozen=True)
class LLMRequest:
    task: LLMTask
    prompt: str
    model: str
    expect_json: bool = False
    timeout_seconds: int = 25
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class LLMResponse:
    text: str
    provider: str
    model: str
    ok: bool
    elapsed_ms: int
    error: str = ""
    raw: dict[str, Any] = field(default_factory=dict)
