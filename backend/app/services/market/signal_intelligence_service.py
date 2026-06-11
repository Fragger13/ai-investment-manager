from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.agents.explainability_agent import build_market_signal_explainability
from app.agents.market_signal_copy_agent import build_market_signal_copy
from app.agents.market_regime_agent import assess_market_regime
from app.agents.sector_rotation_agent import detect_sector_rotation
from app.agents.signal_impact_agent import build_signal_impact, classify_signal
from app.models.asset_impact_score import AssetImpactScore
from app.models.evidence_item import EvidenceItem
from app.models.market_regime import MarketRegime
from app.models.market_signal import MarketSignal
from app.models.recommendation import RecommendationRecord
from app.models.sector_impact_score import SectorImpactScore
from app.models.signal_contradiction import SignalContradiction
from app.models.signal_evidence_link import SignalEvidenceLink
from app.models.signal_impact_map import SignalImpactMap
from app.models.signal_reliability_score import SignalReliabilityScore
from app.services.intelligence import now_iso


def refresh_signal_intelligence(db: Session, force: bool = False) -> dict:
    signals = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(120).all()
    if not signals:
        from app.agents.research_intelligence_agent import refresh_research

        refresh_research(db, force=force)
        signals = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(120).all()

    payloads = [_signal_payload(signal) for signal in signals]
    contradictions = _detect_signal_contradictions(payloads)
    for signal in signals:
        evidence = _evidence_for_signal(db, signal.id)
        contradiction_links = contradictions.get(signal.id, [])
        related = _related_recommendations(db, signal)
        impact = build_signal_impact(_signal_payload(signal), evidence, contradiction_links, related)
        _save_impact_map(db, signal, impact)
        _save_asset_impacts(db, signal, impact)
        _save_contradictions(db, signal.id, contradiction_links)

    rotation = detect_sector_rotation(payloads)
    _save_sector_scores(db, rotation)
    regime = assess_market_regime(payloads)
    _save_market_regime(db, regime)
    return {
        "status": "refreshed",
        "signalsProcessed": len(signals),
        "impactMapsGenerated": len(signals),
        "regime": regime,
        "retrievedAt": now_iso(),
    }


def latest_market_regime(db: Session) -> dict:
    record = db.query(MarketRegime).order_by(MarketRegime.id.desc()).first()
    if not record:
        refresh_signal_intelligence(db)
        record = db.query(MarketRegime).order_by(MarketRegime.id.desc()).first()
    if not record:
        return {
            "regimeName": "limited-data",
            "confidenceScore": 25,
            "drivers": ["No market intelligence has been generated yet."],
            "supportingEvidence": [],
            "contradictoryEvidence": [],
            "recommendedPortfolioStance": "Refresh research before changing allocation.",
            "summary": "Market regime is not available yet.",
            "dataMode": "limited",
            "retrievedAt": now_iso(),
        }
    return {
        "id": record.id,
        "regimeName": record.regime_name,
        "confidenceScore": record.confidence_score,
        "drivers": _loads(record.drivers_json),
        "supportingEvidence": _loads(record.supporting_evidence_json),
        "contradictoryEvidence": _loads(record.contradictory_evidence_json),
        "recommendedPortfolioStance": record.recommended_portfolio_stance,
        "summary": record.summary,
        "dataMode": record.data_mode,
        "retrievedAt": record.retrieved_at,
    }


def market_signal_list(db: Session, limit: int = 80, llm_enhance_count: int = 0) -> list[dict]:
    rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(limit).all()
    if rows and not _has_recent_impact_maps(db):
        refresh_signal_intelligence(db)
    return [_enriched_signal(db, row, llm_enhance=index < llm_enhance_count) for index, row in enumerate(rows)]


def market_signal_detail(db: Session, signal_id: int, llm_enhance: bool = False) -> dict | None:
    row = db.query(MarketSignal).filter(MarketSignal.id == signal_id).first()
    if not row:
        return None
    if not db.query(SignalImpactMap).filter(SignalImpactMap.signal_id == signal_id).first():
        refresh_signal_intelligence(db)
    return _enriched_signal(db, row, llm_enhance=llm_enhance)


def impact_map_list(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(SignalImpactMap).order_by(SignalImpactMap.retrieved_at.desc()).limit(limit).all()
    if not rows:
        refresh_signal_intelligence(db)
        rows = db.query(SignalImpactMap).order_by(SignalImpactMap.retrieved_at.desc()).limit(limit).all()
    return [_impact_payload(row) for row in rows]


def _enriched_signal(db: Session, signal: MarketSignal, llm_enhance: bool = False) -> dict:
    payload = _signal_payload(signal)
    impact = db.query(SignalImpactMap).filter(SignalImpactMap.signal_id == signal.id).order_by(SignalImpactMap.id.desc()).first()
    evidence = _evidence_for_signal(db, signal.id)
    if impact:
        impact_payload = _impact_payload(impact)
    else:
        impact_payload = build_signal_impact(payload, evidence, [], _related_recommendations(db, signal))
    clean_type = impact_payload["signalClassification"]
    beneficiaries = impact_payload["likelyBeneficiaries"]
    losers = impact_payload["likelyLosers"]
    reliability = _signal_reliability(db, payload["signalType"], clean_type)
    enriched = {
        **payload,
        "signalType": clean_type,
        "signalClassification": clean_type,
        "signalCategory": clean_type.title(),
        "title": _clean_headline(payload, impact_payload),
        "affectedAssets": impact_payload["affectedAssetClasses"],
        "likelyBeneficiaries": beneficiaries,
        "likelyLosers": losers,
        "relevantInstruments": impact_payload["relevantInstruments"],
        "shortTermImpact": impact_payload["shortTermImpact"],
        "longTermImpact": impact_payload["longTermImpact"],
        "whyItMatters": _why_it_matters(clean_type, beneficiaries, losers, impact_payload),
        "portfolioRelevance": impact_payload["portfolioRelevance"],
        "userRelevance": impact_payload["goalRelevance"],
        "impactScore": impact_payload["confidenceScore"],
        "historicalReliability": reliability["historicalReliability"],
        "signalStrength": reliability["signalStrength"],
        "regimeRelevance": reliability["regimeRelevance"],
        "contradictionScore": reliability["contradictionScore"],
        "validationNote": reliability["validationNote"],
        "sourceCount": len({item.get("sourceUrl") or item.get("sourceName") for item in evidence}) or 1,
        "evidence": evidence,
        "conflictingEvidence": impact_payload["contradictionLinks"],
        "relatedRecommendations": impact_payload["relatedRecommendations"],
        "relatedRecommendation": ", ".join(impact_payload["relatedRecommendations"][:2]) if impact_payload["relatedRecommendations"] else None,
        "impactMap": impact_payload,
    }
    copy = build_market_signal_copy(enriched, llm_enhance=llm_enhance)
    enriched["title"] = copy["title"]
    enriched["clean_headline"] = copy.get("clean_headline", copy["title"])
    enriched["cleanHeadline"] = copy.get("clean_headline", copy["title"])
    enriched["summary"] = copy["summary"]
    enriched["whyItMatters"] = copy["whyItMatters"]
    enriched["why_it_matters"] = copy.get("why_it_matters", copy["whyItMatters"])
    enriched["who_benefits"] = copy.get("who_benefits", beneficiaries[:3])
    enriched["who_is_at_risk"] = copy.get("who_is_at_risk", losers[:3])
    enriched["likely_beneficiaries"] = enriched["who_benefits"]
    enriched["likely_risks"] = enriched["who_is_at_risk"]
    enriched["related_assets"] = enriched.get("relevantInstruments") or enriched.get("affectedAssets") or []
    enriched["user_relevance"] = copy.get("user_relevance", "")
    enriched["whatToWatchNext"] = copy.get("whatToWatchNext") or copy.get("what_to_watch_next") or ""
    enriched["what_to_watch_next"] = copy.get("what_to_watch_next") or enriched["whatToWatchNext"]
    for key in ["llm_enhanced", "llm_provider", "llm_model", "llm_generated_at", "llm_fallback_reason", "llmEnhanced", "llmProvider", "llmModel", "llmGeneratedAt", "llmFallbackReason"]:
        enriched[key] = copy.get(key)
    enriched.update(build_market_signal_explainability(enriched))
    enriched["cleanSummary"] = {
        **enriched.get("cleanSummary", {}),
        "whatHappened": enriched["clean_headline"],
        "whyItMatters": enriched["whyItMatters"],
        "whoBenefits": ", ".join(enriched.get("who_benefits", []) or beneficiaries[:3]) or "Not clear",
        "whoSuffers": ", ".join(enriched.get("who_is_at_risk", []) or losers[:3]) or "Not clear",
        "doesItAffectMe": enriched.get("user_relevance") or enriched.get("cleanSummary", {}).get("doesItAffectMe", ""),
        "whatToWatchNext": enriched.get("whatToWatchNext", ""),
    }
    return enriched


def _signal_payload(signal: MarketSignal) -> dict:
    return {
        "id": signal.id,
        "title": signal.summary[:90],
        "summary": signal.summary,
        "signalType": signal.signal_type,
        "sentiment": signal.sentiment,
        "assetClasses": _loads(signal.asset_classes),
        "instruments": _loads(signal.instruments),
        "sectors": _loads(signal.sectors),
        "macroThemes": _loads(signal.macro_themes),
        "riskSignals": _loads(signal.risk_signals),
        "opportunitySignals": _loads(signal.opportunity_signals),
        "relevanceScore": signal.relevance_score,
        "credibilityScore": signal.credibility_score,
        "confidenceScore": signal.confidence_score,
        "sourceName": signal.source_name,
        "sourceUrl": signal.source_url,
        "publishedAt": signal.published_at,
        "retrievedAt": signal.retrieved_at,
        "dataMode": signal.data_mode,
    }


def _save_impact_map(db: Session, signal: MarketSignal, impact: dict) -> None:
    existing = db.query(SignalImpactMap).filter(SignalImpactMap.signal_id == signal.id).first()
    payload = {
        "signal_classification": impact["signalClassification"],
        "affected_sectors_json": json.dumps(impact["affectedSectors"]),
        "affected_asset_classes_json": json.dumps(impact["affectedAssetClasses"]),
        "likely_beneficiaries_json": json.dumps(impact["likelyBeneficiaries"]),
        "likely_losers_json": json.dumps(impact["likelyLosers"]),
        "relevant_instruments_json": json.dumps(impact["relevantInstruments"]),
        "short_term_impact": impact["shortTermImpact"],
        "long_term_impact": impact["longTermImpact"],
        "confidence_score": impact["confidenceScore"],
        "evidence_links_json": json.dumps(impact["evidenceLinks"]),
        "contradiction_links_json": json.dumps(impact["contradictionLinks"]),
        "related_recommendations_json": json.dumps(impact["relatedRecommendations"]),
        "portfolio_relevance": impact["portfolioRelevance"],
        "goal_relevance": impact["goalRelevance"],
        "retrieved_at": now_iso(),
    }
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
    else:
        db.add(SignalImpactMap(signal_id=signal.id, **payload))
    db.commit()


def _save_market_regime(db: Session, regime: dict) -> None:
    mode = "live" if regime.get("supportingEvidence") else "limited"
    db.add(
        MarketRegime(
            regime_name=regime.get("regimeName", regime.get("regime", "limited-data")),
            confidence_score=regime.get("confidenceScore", 50),
            supporting_evidence_json=json.dumps(regime.get("supportingEvidence", [])),
            contradictory_evidence_json=json.dumps(regime.get("contradictoryEvidence", [])),
            drivers_json=json.dumps(regime.get("drivers", [])),
            recommended_portfolio_stance=regime.get("recommendedPortfolioStance", ""),
            summary=regime.get("summary", ""),
            data_mode=mode,
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _save_sector_scores(db: Session, rotation: dict) -> None:
    retrieved_at = now_iso()
    for item in rotation.get("scores", [])[:20]:
        db.add(
            SectorImpactScore(
                sector=item["sector"],
                direction=item["direction"],
                relative_strength_score=item["relativeStrengthScore"],
                macro_support_score=item["macroSupportScore"],
                sentiment_score=item["earningsMomentumScore"],
                risk_score=item["riskScore"],
                confidence_score=item["confidenceScore"],
                retrieved_at=retrieved_at,
            )
        )
    db.commit()


def _save_asset_impacts(db: Session, signal: MarketSignal, impact: dict) -> None:
    retrieved_at = now_iso()
    direction = "bullish" if signal.sentiment == "bullish" else "bearish" if signal.sentiment == "bearish" else "neutral"
    for asset in impact["relevantInstruments"][:12]:
        existing = db.query(AssetImpactScore).filter(AssetImpactScore.signal_id == signal.id, AssetImpactScore.asset_name == asset).first()
        payload = {
            "asset_type": impact["signalClassification"],
            "impact_score": impact["confidenceScore"],
            "direction": direction,
            "reason": impact["shortTermImpact"],
            "retrieved_at": retrieved_at,
        }
        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(AssetImpactScore(asset_name=asset, signal_id=signal.id, **payload))
    db.commit()


def _save_contradictions(db: Session, signal_id: int, contradictions: list[dict]) -> None:
    for item in contradictions[:5]:
        exists = (
            db.query(SignalContradiction)
            .filter(SignalContradiction.signal_id == signal_id, SignalContradiction.entity == item.get("entity", ""))
            .first()
        )
        if exists:
            continue
        db.add(
            SignalContradiction(
                signal_id=signal_id,
                contradictory_signal_id=item.get("signalId"),
                entity=item.get("entity", ""),
                contradiction_type=item.get("type", "sentiment_conflict"),
                summary=item.get("summary", ""),
                evidence_url=item.get("sourceUrl", ""),
                retrieved_at=now_iso(),
            )
        )
    db.commit()


def _impact_payload(row: SignalImpactMap) -> dict:
    return {
        "id": row.id,
        "signalId": row.signal_id,
        "signalClassification": row.signal_classification,
        "affectedSectors": _loads(row.affected_sectors_json),
        "affectedAssetClasses": _loads(row.affected_asset_classes_json),
        "likelyBeneficiaries": _loads(row.likely_beneficiaries_json),
        "likelyLosers": _loads(row.likely_losers_json),
        "relevantInstruments": _loads(row.relevant_instruments_json),
        "shortTermImpact": row.short_term_impact,
        "longTermImpact": row.long_term_impact,
        "confidenceScore": row.confidence_score,
        "evidenceLinks": _loads(row.evidence_links_json),
        "contradictionLinks": _loads(row.contradiction_links_json),
        "relatedRecommendations": _loads(row.related_recommendations_json),
        "portfolioRelevance": row.portfolio_relevance,
        "goalRelevance": row.goal_relevance,
        "retrievedAt": row.retrieved_at,
    }


def _evidence_for_signal(db: Session, signal_id: int | None) -> list[dict]:
    if not signal_id:
        return []
    rows = (
        db.query(EvidenceItem)
        .join(SignalEvidenceLink, SignalEvidenceLink.evidence_id == EvidenceItem.id)
        .filter(SignalEvidenceLink.signal_id == signal_id)
        .order_by(EvidenceItem.confidence_contribution.desc())
        .limit(6)
        .all()
    )
    return [
        {
            "sourceName": row.source_name,
            "sourceUrl": row.source_url,
            "summary": row.summary,
            "signalType": row.evidence_type,
            "credibilityScore": row.credibility_score,
            "relevanceScore": row.relevance_score,
            "confidenceContribution": row.confidence_contribution,
            "dataMode": row.data_mode,
            "retrievedAt": row.retrieved_at,
        }
        for row in rows
    ]


def _detect_signal_contradictions(signals: list[dict]) -> dict[int, list[dict]]:
    by_entity: dict[str, list[dict]] = {}
    for signal in signals:
        for entity in set(signal.get("sectors", [])) | set(signal.get("instruments", [])) | set(signal.get("assetClasses", [])):
            by_entity.setdefault(entity, []).append(signal)
    contradictions: dict[int, list[dict]] = {}
    for entity, items in by_entity.items():
        bullish = [item for item in items if item.get("sentiment") == "bullish"]
        bearish = [item for item in items if item.get("sentiment") == "bearish"]
        if not bullish or not bearish:
            continue
        for item in bullish + bearish:
            opposite = bearish[0] if item in bullish else bullish[0]
            contradictions.setdefault(item["id"], []).append(
                {
                    "signalId": opposite["id"],
                    "entity": entity,
                    "type": "sentiment_conflict",
                    "summary": f"Conflicting {opposite.get('sentiment')} signal exists for {entity}: {opposite.get('summary', '')[:180]}",
                    "sourceName": opposite.get("sourceName", ""),
                    "sourceUrl": opposite.get("sourceUrl", ""),
                    "retrievedAt": opposite.get("retrievedAt", ""),
                }
            )
    return contradictions


def _related_recommendations(db: Session, signal: MarketSignal) -> list[str]:
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(80).all()
    noisy_terms = {"equity", "debt", "mutual", "fund", "funds", "market", "broad", "crypto", "stock", "stocks"}
    raw_terms = _loads(signal.instruments) + _loads(signal.sectors)
    signal_terms = [term.lower() for term in raw_terms if len(term) > 3 and term.lower() not in noisy_terms and term.lower() != "broad market"]
    matches: list[str] = []
    for row in rows:
        try:
            data = json.loads(row.recommendation_data)
        except json.JSONDecodeError:
            continue
        haystack = " ".join(
            [
                data.get("instrumentName", ""),
                data.get("assetType", ""),
                data.get("strategyBucket", ""),
                data.get("currentMarketReasoning", ""),
                " ".join(data.get("supportingSignalSummaries", [])),
            ]
        ).lower()
        source_match = any(source.get("url") == signal.source_url for source in data.get("sourceLinks", []))
        term_match = any(term and term in haystack for term in signal_terms)
        if source_match or term_match:
            name = data.get("instrumentName") or data.get("recommendationTitle")
            if name and name not in matches:
                matches.append(name)
        if len(matches) >= 4:
            break
    return matches


def _clean_headline(signal: dict, impact: dict) -> str:
    classification = impact["signalClassification"]
    beneficiaries = impact["likelyBeneficiaries"]
    losers = impact["likelyLosers"]
    summary = signal.get("summary", "").lower()
    title = signal.get("title", "").lower()
    if "amfi nav record" in summary or "amfi nav record" in title:
        if "liquid" in summary or "liquid" in title:
            return "Liquid fund NAV update supports emergency reserve review"
        if "nifty" in summary or "index" in summary or "nifty" in title or "index" in title:
            return "Index fund NAV update supports long-term SIP review"
        return "Mutual fund NAV update supports allocation review"
    if ("rbi" in summary or "rate" in summary or "liquidity" in summary) and beneficiaries:
        return f"Liquidity easing may support {', '.join(beneficiaries[:3])}"
    if ("oil" in summary or "crude" in summary) and losers:
        return f"Rising crude prices may pressure {', '.join(losers[:3])}"
    if ("infra" in summary or "budget" in summary or "capex" in summary) and beneficiaries:
        return f"Infrastructure spending may benefit {', '.join(beneficiaries[:3])}"
    if ("rupee" in summary or "currency" in summary or "dollar" in summary) and beneficiaries:
        return f"Currency moves may help {', '.join(beneficiaries[:3])}"
    if classification == "macro" and beneficiaries:
        return f"Macro conditions may support {', '.join(beneficiaries[:3])}"
    if classification == "policy" and beneficiaries:
        return f"Policy changes may benefit {', '.join(beneficiaries[:3])}"
    if classification == "geopolitical" and beneficiaries:
        return f"Geopolitical risk may support {', '.join(beneficiaries[:3])}"
    if classification == "commodity" and losers:
        return f"Commodity move may pressure {', '.join(losers[:3])}"
    if classification == "currency" and beneficiaries:
        return f"Currency movement may help {', '.join(beneficiaries[:3])}"
    if classification == "crypto":
        return "Crypto signal remains tactical and high risk"
    raw = signal.get("summary", "")
    return raw[:1].upper() + raw[1:110] if raw else f"{classification.title()} signal needs review"


def _why_it_matters(classification: str, beneficiaries: list[str], losers: list[str], impact: dict) -> str:
    if beneficiaries and losers:
        return f"This matters because it can shift money toward {', '.join(beneficiaries[:2])} and away from {', '.join(losers[:2])}, which can affect allocation timing."
    if beneficiaries:
        return f"This matters because {', '.join(beneficiaries[:3])} may see better demand, earnings, or sentiment if the signal persists."
    return impact["shortTermImpact"] or "This signal is useful context, but not a standalone reason to change your portfolio."


def _has_recent_impact_maps(db: Session) -> bool:
    return bool(db.query(SignalImpactMap).order_by(SignalImpactMap.id.desc()).first())


def _signal_reliability(db: Session, raw_type: str, clean_type: str) -> dict:
    row = (
        db.query(SignalReliabilityScore)
        .filter(SignalReliabilityScore.signal_type.in_([raw_type, clean_type]))
        .order_by(SignalReliabilityScore.id.desc())
        .first()
    )
    if not row:
        return {
            "historicalReliability": 35,
            "signalStrength": 35,
            "regimeRelevance": 35,
            "contradictionScore": 0,
            "validationNote": "Historical reliability has not been refreshed yet.",
        }
    return {
        "historicalReliability": row.reliability_score,
        "signalStrength": row.evidence_score,
        "regimeRelevance": row.reliability_score,
        "contradictionScore": row.decay_penalty,
        "validationNote": row.notes,
    }


def _loads(value: str) -> list:
    try:
        return json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
