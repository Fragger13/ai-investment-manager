from app.services.research.source_registry import SourceDefinition


def credibility_for_source(source: SourceDefinition) -> int:
    method_bonus = 5 if source.allowed_ingestion_method.startswith("official") else 0
    api_bonus = 3 if source.source_type == "api" else 0
    return min(100, source.reliability_score + method_bonus + api_bonus)


def score_signal(base_confidence: int, source_credibility: int, data_mode: str, relevance: int) -> int:
    mode_adjustment = {"live": 8, "cached": 2, "limited": -6, "fallback": -18}.get(data_mode, -8)
    score = (base_confidence * 0.35) + (source_credibility * 0.35) + (relevance * 0.3) + mode_adjustment
    return round(max(20, min(96, score)))
