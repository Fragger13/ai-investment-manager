from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.llm.schemas import LLMRequest, LLMResponse


class LLMUnavailable(RuntimeError):
    pass


class BaseLLMClient(ABC):
    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        raise NotImplementedError

    @abstractmethod
    def is_reachable(self) -> bool:
        raise NotImplementedError
