from __future__ import annotations

import json
from typing import Any


SAFETY_INSTRUCTIONS = (
    "Use only the provided JSON context. Do not invent facts, prices, sources, or certainty. "
    "If supporting information is missing, say that supporting information is limited. Do not guarantee returns. "
    "Do not mention raw system fields. Do not use vague filler. "
    "Write like a calm, practical financial coach speaking to a first-time investor. "
    "Use simple words and explain finance terms when they are unavoidable. "
    "Avoid analyst jargon, corporate language, and unnecessary complexity. "
    "Prioritize relevance, clarity, personalization, and reasoning. "
    "When personal details are provided, explain why the idea matters for this user's goal, timeline, comfort with risk, cash flow, or current investments. "
    "When personal details are not provided, do not claim a personal fit. "
    "Do not treat the availability of NAV, price, or source records as proof of reliability, performance, or quality. "
    "Keep language concise, beginner-friendly, and focused on the user's next step. "
    "Every answer must be a complete sentence. Return only the requested final answer."
)


def chat_prompt(message: str, context: dict[str, Any], fallback_answer: str) -> str:
    """Papa-style chat prompt — Indian dad with financial wisdom and sarcasm.

    Persona reference: warm-but-no-nonsense Indian father who cares deeply
    about his child's money decisions. Praises sparingly, scolds gently when
    they're being reckless, encourages when they're starting out, mixes in
    casual Hindi/English the way an actual desi parent would.
    """
    profile = context.get("profile", {}) or {}
    name = str(profile.get("name") or "").strip().split()[:1]
    first_name = name[0] if name else ""

    compact = {
        "profile": {
            "name": first_name or None,
            "age": profile.get("age"),
            "occupation": profile.get("occupation"),
            "city": profile.get("city"),
            "maritalStatus": profile.get("maritalStatus"),
            "monthlyIncome": profile.get("monthlyCashInflow") or profile.get("monthlyIncome"),
            "monthlyExpenses": profile.get("monthlyExpenses"),
            "monthlySurplus": profile.get("monthlySurplus"),
            "rent": profile.get("rent"),
            "totalEmi": profile.get("emi"),
            "subscriptions": profile.get("subscriptions"),
            "totalInvestments": profile.get("totalInvestments"),
            "emergencyFundMonths": profile.get("emergencyFundMonths"),
            "savingsRate": profile.get("savingsRate"),
            "riskComfort": profile.get("riskComfort") or profile.get("shortTermLossTolerance"),
            "investmentHorizon": profile.get("investmentHorizon"),
            "spendingDiscipline": profile.get("spendingDiscipline"),
            "investsMonthly": profile.get("investsMonthly"),
            "investingBlocker": profile.get("investingBlocker"),
            "loans": profile.get("emiLoans") or profile.get("loans"),
        },
        "topRecommendation": _compact_rec(context.get("topRecommendation", {})),
        "recommendations": [_compact_rec(item) for item in context.get("recommendations", [])[:3]],
        "portfolio": context.get("portfolio", {}).get("summary", context.get("portfolio", {})),
        "marketRegime": context.get("market", {}).get("regime", {}),
        "importantSignals": [_compact_signal(item) for item in context.get("importantSignals", [])[:2]],
        "goals": context.get("dashboard", {}).get("goals", [])[:5],
        "keyRisks": context.get("keyRisks", [])[:3],
        "dailyPlan": {
            "recommendedAction": context.get("copilot", {}).get("recommendedAction", {}),
            "cashflowCoach": context.get("cashflowCoach", {}),
        },
    }

    return (
        "You ARE Papa — a caring, dry-humored Indian father who is also financially sharp. "
        "The user is your child. Talk to them the way a real Indian dad would at the kitchen table — "
        "warm, no-nonsense, with quiet pride and gentle scolding mixed in. NOT a chatbot. NOT a financial "
        "advisor reciting a script. Real.\n\n"
        "TONE & VOICE (this is the most important part):\n"
        "- Sound like an Indian dad. Sprinkle 'beta', 'acha', 'arrey', 'haan', 'theek hai' naturally — "
        "  the way a real desi parent does. Don't go overboard, but don't strip it out either.\n"
        "- 'Beta' usually mid-sentence or at the end, not as a stamped opener on every reply. "
        "  Once per reply is plenty; never twice in the same sentence.\n"
        "- Vary openings. Sometimes 'Acha,' or 'Arrey,' or the user's first name, or just dive in.\n"
        "- React emotionally to what they said. Praise sparingly when they're doing well. "
        "  Push back when they're being reckless. Tease gently when the question is silly. "
        "  Show quiet concern when something needs urgent attention.\n"
        "- Use dad-style turns of phrase: 'in that order', 'theek hai', 'pick one and start', "
        "  'before life gets busier', 'don't tell anyone I said that'.\n"
        "- 2-4 sentences usually. Conversational, not formal. Plain language.\n"
        "- End with one practical thing — a number, a next step, or a question back to them.\n\n"
        "AVOID THESE ROBOTIC PATTERNS:\n"
        "- 'Suggested plan adjustment: …', 'Main risk to watch: …', 'conviction X%'.\n"
        "- Naming specific funds or products unless the user asked for them by name.\n"
        "- Bulleted lists of 'why this matters / how to act / things to watch'.\n"
        "- Boilerplate disclaimers ('this is decision support, not a promise of returns').\n"
        "- Repeating 'beta' in every sentence.\n\n"
        "GROUNDING RULES:\n"
        "- Use ONLY the JSON context for numbers, goals, investments, EMIs.\n"
        "- Reference the user's actual income, expenses, goals naturally — not 'as per your context'.\n"
        "- If data is missing, say so plainly ('I don't know your wedding budget yet — tell me').\n"
        "- Never guarantee returns. Be real about uncertainty without sounding like a disclaimer.\n"
        "- Currency is INR. Use 'Rs' or '₹' with Indian number format.\n\n"
        "CONVERSATION CONSISTENCY (critical — read the recent conversation first):\n"
        "- Stay consistent with what you already told the user. NEVER reverse your stance between turns. "
        "  If you just said they can buy something, do not now say they shouldn't — instead help them do it "
        "  sensibly, or spell out the trade-off (e.g. 'spend it all on the phone and there's nothing left to "
        "  invest that month — so split it, or buy outright and keep the SIP going').\n"
        "- A follow-up belongs to the SAME thread. 'it', 'that', 'the phone', 'then' refer to what was just "
        "  discussed — answer the actual question asked, don't restart on a new topic.\n"
        "- If the user asks a 'what if I do X' question, answer the consequence of X honestly; don't lecture "
        "  them out of a decision you already endorsed.\n\n"
        "EXAMPLES OF GOOD PAPA REPLIES (match the tone, don't copy):\n"
        "- 'Six months for a wedding is tight but doable. A simple Indian wedding lands "
        "  around Rs 8-15 lakhs. You would need to set aside about Rs 1.5L a month from somewhere — "
        "  what is the target budget?'\n"
        "- 'Finally investing every month. About time.'\n"
        "- 'Your emergency fund is two months. That is not a fund, it is a sneeze away from disaster. "
        "  Fix this before anything else.'\n"
        "- 'Look at you. Six months saved, SIP running, no new debt. Quietly impressed. "
        "  Now do not get cocky.'\n"
        "- 'A house in this market with that surplus is going to stretch you thin. "
        "  Plan the down payment first, then we talk about the loan.'\n\n"
        f"{_history_block(context.get('conversationHistory') or [])}"
        f"User just asked: \"{message}\"\n\n"
        f"Their financial context:\n{_json(compact)}\n\n"
        f"Single-message draft (the numbers in it are reliable, but it was written WITHOUT seeing the "
        f"conversation above — so borrow its figures and IGNORE its stance if that stance would contradict "
        f"what you already told the user): {fallback_answer}\n\n"
        "Reply as Papa. Natural, varied, real. Under 4 sentences. "
        "Build on the conversation above and never contradict your earlier advice. "
        "Return only the spoken reply — no preamble, no labels, no quotes."
    )


def _history_block(history: list[dict[str, Any]]) -> str:
    if not history:
        return ""
    turns = []
    for turn in history[-6:]:
        role = "You" if turn.get("role") == "user" else "Papa"
        content = " ".join(str(turn.get("content") or "").split())
        if content:
            turns.append(f"{role}: {content}")
    if not turns:
        return ""
    return "Recent conversation:\n" + "\n".join(turns) + "\n\n"


def recommendation_explanation_prompt(recommendation: dict[str, Any], cards: list[dict[str, str]]) -> str:
    context = {
        "asset": recommendation.get("instrumentName") or recommendation.get("assetName"),
        "assetType": recommendation.get("assetType"),
        "action": recommendation.get("action"),
        "allocation": recommendation.get("suggestedAllocationPercentage"),
        "riskLevel": recommendation.get("riskLevel"),
        "goal": recommendation.get("goal"),
        "userContext": recommendation.get("userContext"),
        "market": recommendation.get("market") or recommendation.get("marketRegime"),
        "portfolio": recommendation.get("portfolio"),
        "scores": recommendation.get("scores"),
        "supportingSignals": recommendation.get("supportingSignals", [])[:3],
        "contradictorySignals": recommendation.get("contradictorySignals", [])[:2],
        "risk": recommendation.get("risks") or recommendation.get("primaryRisk") or recommendation.get("whatCanGoWrong"),
        "validation": recommendation.get("validation"),
        # Quant factor facts (funds) — already-computed numbers for the model to
        # phrase. The safety rule forbids inventing any figures beyond these.
        "fundFactors": _compact_fund_factors(recommendation.get("factorInsights", {})),
        "factorDrivers": recommendation.get("factorDrivers", [])[:3],
        "marketReasoning": recommendation.get("currentMarketReasoning"),
        "goalFunding": _compact_goal_funding(recommendation.get("goalFunding", {})),
        "communitySentiment": _compact_community((recommendation.get("sentimentSignal") or {}).get("community", {})),
        "fallbackCards": _compact_cards(cards),
    }
    return (
        f"{SAFETY_INSTRUCTIONS}\n"
        "Return minified JSON only. Use q=why the user is seeing this, n=why it may be a good time, s=what makes it promising, x=what to be careful about, c=what to do next. "
        "For q, connect the actual asset to the user's linked goal, priority, timeline, or current investment mix when provided. "
        "For n, explain the current market condition, signal, or reason to invest gradually. "
        "For s, use the strongest provided evidence or historical check. For x, name a realistic downside and review trigger. "
        "For c, give one simple action with the provided amount, allocation limit, or review date when available. Use consider, not a command. "
        "Preserve whether an amount is monthly. If the context recommends gradual or staggered entry, do not tell the user to invest the full amount now. "
        "Each field must be one complete asset-specific sentence under 175 characters. "
        "a and r must each be one complete plain-English sentence under 210 characters. "
        "Shape: {\"q\":\"...\",\"n\":\"...\",\"s\":\"...\",\"x\":\"...\",\"c\":\"...\",\"a\":\"...\",\"r\":\"...\"}.\n"
        f"Context JSON:\n{_json(context, limit=1900)}"
    )


def asset_explanation_prompt(asset: dict[str, Any], evidence: list[dict[str, Any]], fallback_copy: dict[str, Any]) -> str:
    context = {
        "assetName": asset.get("assetName") or asset.get("instrumentName") or asset.get("name"),
        "ticker": asset.get("ticker"),
        "assetType": asset.get("assetType") or asset.get("assetClass"),
        "sectorTheme": asset.get("sectorTheme"),
        "category": asset.get("category"),
        "action": asset.get("action") or asset.get("suggestedAction"),
        "confidenceScore": asset.get("confidenceScore"),
        "suitabilityNotes": asset.get("suitabilityNotes"),
        "technical": _compact_technical(asset.get("technical") or {}),
        "fundamental": _compact_fundamental(asset.get("fundamental") or {}),
        "liquidity": _compact_liquidity(asset.get("liquidity") or {}),
        "risk": _compact_risk(asset.get("risk") or {}),
        "crypto": _compact_crypto(asset.get("crypto") or {}),
        "evidence": _compact_evidence(evidence, 3),
    }
    return (
        f"{SAFETY_INSTRUCTIONS}\n"
        "Return minified JSON only. Explain the investment idea like a trusted financial coach speaking to a beginner. "
        "Do not repeat raw NAV, price, or API facts. Do not attach unrelated evidence. Use the asset name in the summary. "
        "Use compact keys: s=what the opportunity is, m=why it matters, n=why it is interesting now, e=up to 3 reasons it could work, r=up to 3 risks, i=what could stop it from working, u=who it may suit. "
        "Each text value must be one complete sentence under 175 characters. Use only checked information. If direct evidence is weak, say so clearly. "
        "Shape: {\"s\":\"...\",\"m\":\"...\",\"n\":\"...\",\"e\":[\"...\"],\"r\":[\"...\"],\"i\":\"...\",\"u\":\"...\"}.\n"
        f"Context JSON:\n{_json(context, limit=1450)}"
    )


def market_explanation_prompt(signal: dict[str, Any], fallback_explainability: dict[str, Any]) -> str:
    context = {
        "headline": signal.get("title"),
        "signalType": signal.get("signalType"),
        "sentiment": signal.get("sentiment"),
        "affectedSectors": signal.get("sectors") or signal.get("affectedSectors"),
        "affectedAssets": signal.get("affectedAssets"),
        "beneficiaries": signal.get("likelyBeneficiaries"),
        "losers": signal.get("likelyLosers"),
        "summary": signal.get("summary"),
        "whyItMatters": signal.get("whyItMatters"),
        "confidenceScore": signal.get("confidenceScore"),
        "evidence": signal.get("evidence", [])[:4],
        "conflictingEvidence": signal.get("conflictingEvidence", [])[:2],
        "fallbackExplainability": fallback_explainability,
    }
    return (
        f"{SAFETY_INSTRUCTIONS}\n"
        "Rewrite this market update as JSON only. Explain what happened, why the user should care, who may benefit, who may be affected negatively, and what remains uncertain. "
        "Keep each field concise and do not imply certainty. Return keys: whySignalMatters, beneficiaryRationale, loserRationale, confidenceExplanation, contradictionExplanation, regimeDependence.\n"
        f"Context JSON:\n{_json(context)}"
    )


def market_signal_copy_prompt(signal: dict[str, Any], fallback_copy: dict[str, Any]) -> str:
    context = {
        "rawHeadline": _trim(signal.get("summary") or signal.get("title"), 220),
        "fallbackHeadline": _trim(fallback_copy.get("clean_headline") or fallback_copy.get("title"), 120),
        "fallbackSummary": _trim(fallback_copy.get("summary"), 160),
        "signalType": signal.get("signalType"),
        "sentiment": signal.get("sentiment"),
        "affectedAssets": (signal.get("affectedAssets") or [])[:3],
        "beneficiaries": (signal.get("likelyBeneficiaries") or [])[:3],
        "losers": (signal.get("likelyLosers") or [])[:3],
        "relatedRecommendations": (signal.get("relatedRecommendations") or [])[:3],
        "relatedRecommendation": signal.get("relatedRecommendation"),
        "portfolioRelevance": signal.get("portfolioRelevance"),
        "goalRelevance": signal.get("userRelevance"),
        "riskSignals": (signal.get("riskSignals") or [])[:3],
        "opportunitySignals": (signal.get("opportunitySignals") or [])[:3],
        "sourceName": signal.get("sourceName"),
        "confidenceScore": signal.get("confidenceScore"),
        "evidence": _compact_evidence(signal.get("evidence", []), 2),
    }
    return (
        f"{SAFETY_INSTRUCTIONS}\n"
        "Rewrite this market update for a beginner-friendly dashboard card. Return minified JSON only. "
        "Explain what happened, why it matters, who could benefit, who could be affected negatively, what the user should watch next, and why the user may care. "
        "Do not add new sectors, assets, sources, or certainty. When a related suggestion is provided, use it to explain personal relevance. "
        "Use compact keys: h=headline, s=summary, m=why it matters, b=beneficiaries, r=risks, w=what to watch next, u=user relevance. "
        "The headline must be under 100 characters. Other text values must be one complete sentence under 175 characters. "
        "Shape: {\"h\":\"...\",\"s\":\"...\",\"m\":\"...\",\"b\":[\"...\"],\"r\":[\"...\"],\"w\":\"...\",\"u\":\"...\"}.\n"
        f"Context JSON:\n{_json(context, limit=1450)}"
    )


def _compact_rec(rec: dict[str, Any]) -> dict[str, Any]:
    goal = (rec.get("linkedGoals") or [{}])[0]
    return {
        "instrumentName": rec.get("instrumentName"),
        "assetType": rec.get("assetType"),
        "action": rec.get("action"),
        "goalTag": rec.get("goalTag"),
        "goalPriority": goal.get("priority") or rec.get("goalPriority"),
        "goalTimelineMonths": goal.get("timeHorizonMonths") or rec.get("goalTimeHorizonMonths"),
        "allocation": rec.get("suggestedAllocationPercentage"),
        "monthlyAmount": rec.get("suggestedMonthlyAmount"),
        "riskLevel": rec.get("riskLevel"),
        "convictionScore": rec.get("convictionScore"),
        "evidenceScore": rec.get("evidenceScore"),
        "reason": rec.get("conciseReason") or rec.get("userSpecificReasoning"),
        "risk": rec.get("primaryRisk") or rec.get("whatCanGoWrong"),
        "portfolioImpact": rec.get("allocationImpact"),
    }


def _compact_fund_factors(insights: dict[str, Any]) -> dict[str, Any]:
    """Only the headline factor numbers, for the LLM to phrase (never invent)."""
    if not insights:
        return {}
    keys = ("sortino", "calmar", "maxDrawdown3y", "downCapture", "alpha", "volatility", "sortinoPercentile", "drawdownPercentile")
    return {k: insights[k] for k in keys if insights.get(k) is not None}


def _compact_goal_funding(funding: dict[str, Any]) -> dict[str, Any]:
    if not funding:
        return {}
    return {
        "fundingPercent": funding.get("fundingPercent"),
        "requiredMonthly": funding.get("requiredMonthlyInvestment"),
        "gap": funding.get("gap"),
        "fix": funding.get("fix"),
    }


def _compact_community(community: dict[str, Any]) -> dict[str, Any]:
    """Reddit community sentiment facts for the model to phrase (never invent).
    Empty when the asset is not being discussed."""
    if not community or not community.get("mentionCount"):
        return {}
    return {
        "sentiment": community.get("sentiment"),
        "mentions": community.get("mentionCount"),
        "subreddits": community.get("subreddits", [])[:3],
        "note": "social chatter, noisy and not advice",
    }


def _compact_cards(cards: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "title": item.get("title", ""),
            "summary": _trim(item.get("summary"), 100),
            "tone": item.get("tone", "neutral"),
        }
        for item in cards[:5]
        if isinstance(item, dict)
    ]


def _compact_signal(signal: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": signal.get("title"),
        "signalType": signal.get("signalType"),
        "whyItMatters": signal.get("whyItMatters"),
        "confidenceScore": signal.get("confidenceScore"),
        "likelyBeneficiaries": signal.get("likelyBeneficiaries"),
        "likelyLosers": signal.get("likelyLosers"),
    }


def _compact_asset(asset: dict[str, Any]) -> dict[str, Any]:
    return {
        "assetName": asset.get("assetName"),
        "ticker": asset.get("ticker"),
        "assetType": asset.get("assetType"),
        "summary": asset.get("summary"),
        "whyThisMatters": asset.get("whyThisMatters"),
        "risk": asset.get("riskNotes") or asset.get("risks"),
        "confidenceScore": asset.get("confidenceScore"),
        "dataMode": asset.get("dataMode"),
    }


def _compact_technical(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "trend": value.get("breakoutStatus"),
        "trendStrength": value.get("trendStrength"),
        "rsi": value.get("rsi"),
        "supportZone": value.get("supportZone"),
        "resistanceZone": value.get("resistanceZone"),
        "buyRange": value.get("buyRange"),
        "reviewZone": value.get("reviewZone"),
        "stopLossReference": value.get("stopLossReference"),
        "confidenceScore": value.get("confidenceScore"),
    }


def _compact_fundamental(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataCompleteness": value.get("dataCompleteness"),
        "earningsMomentum": value.get("earningsMomentum"),
        "sectorTailwindScore": value.get("sectorTailwindScore"),
        "recentNewsSentiment": value.get("recentNewsSentiment"),
        "fundamentalScore": value.get("fundamentalScore"),
        "redFlags": value.get("redFlags"),
    }


def _compact_liquidity(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "marketCapTier": value.get("marketCapTier"),
        "liquidityScore": value.get("liquidityScore"),
        "minimumLiquidityPassed": value.get("minimumLiquidityPassed"),
        "liquidityNotes": value.get("liquidityNotes"),
    }


def _compact_risk(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "riskCategory": value.get("riskCategory"),
        "volatilityScore": value.get("volatilityScore"),
        "drawdownScore": value.get("drawdownScore"),
        "concentrationRisk": value.get("concentrationRisk"),
        "riskNotes": value.get("riskNotes"),
    }


def _compact_crypto(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "narrative": value.get("narrative"),
        "marketCapTier": value.get("marketCapTier"),
        "liquidityScore": value.get("liquidityScore"),
        "volatilityScore": value.get("volatilityScore"),
        "narrativeStrength": value.get("narrativeStrength"),
        "evidenceScore": value.get("evidenceScore"),
        "recommendedAction": value.get("recommendedAction"),
        "allocationCap": value.get("allocationCap"),
        "riskWarning": value.get("riskWarning"),
    }


def _compact_asset_fallback(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": _trim(value.get("summary"), 170),
        "why_this_matters": _trim(value.get("why_this_matters") or value.get("whyThisMatters"), 170),
        "why_now": _trim(value.get("why_now") or value.get("whyNow"), 170),
        "supporting_evidence": [_trim(item, 120) for item in _first_strings(value.get("supporting_evidence") or value.get("supportingEvidence"), 2)],
        "risks": [_trim(item, 120) for item in _first_strings(value.get("risks"), 2)],
        "data_points": [_trim(item, 110) for item in _first_strings(value.get("data_points") or value.get("dataPoints"), 2)],
        "invalidation_trigger": _trim(value.get("invalidation_trigger") or value.get("invalidationTrigger"), 150),
    }


def _compact_evidence(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return [
        {
            "sourceName": item.get("sourceName") or item.get("source"),
            "sourceUrl": item.get("sourceUrl") or item.get("url"),
            "summary": _trim(item.get("summary"), 170),
            "signalType": item.get("signalType"),
            "relationshipType": item.get("relationship_type"),
            "relevanceScore": item.get("relevance_score"),
            "retrievedAt": item.get("retrievedAt") or item.get("timestamp"),
        }
        for item in (items or [])[:limit]
        if isinstance(item, dict)
    ]


def _json(value: Any, limit: int = 5000) -> str:
    encoded = json.dumps(value, ensure_ascii=False, default=str)
    if len(encoded) <= limit or not isinstance(value, dict):
        return encoded[:limit]
    compact: dict[str, Any] = {}
    for key, item in value.items():
        candidate = _compact_json_value(item)
        trial = json.dumps({**compact, key: candidate}, ensure_ascii=False, default=str)
        if len(trial) <= limit:
            compact[key] = candidate
    return json.dumps(compact, ensure_ascii=False, default=str)


def _compact_json_value(value: Any) -> Any:
    if isinstance(value, str):
        return _trim(value, 110)
    if isinstance(value, list):
        return [_compact_json_value(item) for item in value[:1]]
    if isinstance(value, dict):
        return {
            key: _compact_json_value(item)
            for key, item in list(value.items())[:5]
            if item is not None and item != "" and item != [] and item != {}
        }
    return value


def _first_strings(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value[:limit] if str(item or "").strip()]


def _trim(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").replace("...", ".").split()).strip()
    if len(text) <= limit:
        return text
    window = text[:limit]
    sentence_end = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
    if sentence_end >= 45:
        return window[: sentence_end + 1].strip()
    words = window.split()
    return " ".join(words[:-1]).strip()


def goal_estimate_prompt(
    goal_type: str,
    answers: dict[str, Any],
    profile_ctx: dict[str, Any],
    baseline: dict[str, Any],
) -> str:
    """Ask the model to refine a deterministic goal-cost baseline into a single
    realistic India figure. The baseline is the anchor; the model nudges it using
    the user's specifics and stays close to it."""
    description = str((answers or {}).get("description") or "").strip()
    payload = {
        "goalType": goal_type,
        "goalDescription": description or None,
        "answers": answers,
        "user": {
            "city": profile_ctx.get("city"),
            "occupation": profile_ctx.get("occupation"),
            "monthlyIncome": profile_ctx.get("monthlyIncome"),
        },
        "baselineEstimate": {
            "amount": baseline.get("amount"),
            "low": baseline.get("low"),
            "high": baseline.get("high"),
        },
    }
    if description:
        anchor = (
            "'goalDescription' is exactly what the user is saving for. Estimate its realistic current cost in "
            "India from your own knowledge, taking the clarifying answers into account. Some goals are small "
            "(a gadget can be well under ₹1,00,000) and some are large — give the true figure, not a rounded-up "
            "one. The baseline is only a rough hint, not a constraint; ignore it if it looks off. "
        )
    else:
        anchor = (
            "A baseline estimate has already been computed from Indian cost tables and goal inflation — treat it "
            "as your anchor. Adjust the figure only if the user's specifics clearly warrant it, and keep it "
            "realistic for India and close to the baseline (within roughly its low–high range). "
        )
    return (
        "You are a practical Indian financial coach helping a first-time investor put a realistic number "
        "on a money goal. " + anchor +
        "All amounts are Indian rupees as whole numbers — no commas, no currency symbol, no text inside numbers.\n"
        "Return ONLY a JSON object, nothing else, in exactly this shape:\n"
        '{"amount": <int>, "low": <int>, "high": <int>, "rationale": "<one short plain-English sentence>"}\n\n'
        f"Context:\n{json.dumps(payload, ensure_ascii=False, default=str)}"
    )


def goal_clarify_prompt(description: str, profile_ctx: dict[str, Any]) -> str:
    """Given a free-form goal description, ask the model for ONE short clarifying
    question (with concrete chip options) that most affects its cost in India.
    One question keeps the onboarding round-trip fast."""
    payload = {
        "goalDescription": description,
        "user": {"city": profile_ctx.get("city"), "occupation": profile_ctx.get("occupation")},
    }
    return (
        "A first-time Indian investor wants to save up for the goal described below but isn't sure how much it costs. "
        "Ask exactly ONE short clarifying question whose answer most changes the price in India (e.g. for 'Apple Watch': "
        "which model; for 'a vacation': domestic or international). The question must have 2 to 4 concrete quick-reply "
        "options. Do NOT ask the user how much it costs — that's the whole point, they don't know. "
        "Keep the prompt under 12 words and option labels under 5 words. Use a short snake_case key.\n"
        "Return ONLY a JSON object with exactly ONE question, nothing else, in this shape:\n"
        '{"questions": [{"key": "<snake_case>", "prompt": "<question>", '
        '"options": [{"value": "<short_code>", "label": "<short label>"}]}]}\n\n'
        f"Context:\n{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
