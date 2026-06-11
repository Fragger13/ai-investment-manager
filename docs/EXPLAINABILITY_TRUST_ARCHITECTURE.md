# Explainability + Trust Architecture

## Philosophy

The investment engine must explain why a recommendation exists, not only what the recommendation is. The trust layer should make the system feel like an analyst showing its work: evidence-backed, risk-aware, explicit about contradictions, and clear about uncertainty.

The app must never present a recommendation as certain. Every explanation should preserve decision-support language: consider, may benefit, current evidence suggests, and thesis depends on.

## Explainability Pipeline

The explainability layer runs after recommendation generation and before persistence/versioning:

```text
Generated recommendation
  -> Evidence summarization
  -> Contradiction analysis
  -> Uncertainty analysis
  -> Invalidation rules
  -> Confidence decomposition
  -> Reasoning chain
  -> Trust labels and concise explanation cards
  -> Database persistence
```

This keeps the existing recommendation engine intact while making every output inspectable.

## Confidence Decomposition

The single confidence score is broken into components:

- Evidence strength: source quality, recency, and number of supporting sources.
- Historical reliability: validation score from the backtesting layer.
- Regime alignment: fit with the current market regime.
- Technical quality: timing and trend quality.
- Fundamental quality: business or fund quality where available.
- Macro support: support from macro/policy/sector signals.
- Sentiment support: news and signal sentiment contribution.
- Liquidity confidence: penalty-aware estimate of whether the asset can be exited.
- Contradiction penalty: confidence reduction from conflicting evidence.

The displayed confidence remains the headline, but the breakdown explains why it is not 100%.

## Contradiction Framework

Each recommendation must surface what could be wrong with the thesis. Contradictions come from:

- Explicit contradictory market signals.
- Weak historical validation.
- High volatility or high drawdown.
- Weak technical or fundamental score.
- Portfolio concentration or allocation drift.
- Limited/fallback data mode.
- Regime mismatch.

Contradictions are ranked by severity and shown separately from risk notes so the user can see that the system is not blindly bullish.

## Uncertainty Framework

Uncertainty is not treated as a failure. It is a trust signal. The system labels uncertainty when:

- Historical sample size is small.
- Data mode is limited, cached, or fallback.
- Signals are mixed.
- Market regime confidence is moderate or low.
- Technical/fundamental evidence is incomplete.
- The recommendation is tactical, underdog, speculative, or crypto.

Each uncertainty item includes why it matters and how it affects action: smaller sizing, watchlist status, staggered entry, or stricter review.

## Invalidation Logic

Every recommendation gets invalidation rules:

- Market invalidation: regime change, volatility spike, sector reversal.
- Asset invalidation: price breaks support, weak liquidity, earnings miss, NAV/fund risk change.
- Portfolio invalidation: allocation cap breach, concentration drift, crypto/tactical bucket creep.
- Goal invalidation: goal deadline approaches, funding gap widens, short-term money becomes exposed to volatility.
- Evidence invalidation: source support weakens or contradictory evidence becomes stronger.

Invalidation rules are written as practical review triggers, not predictions.

## Database Design

Phase 7G adds these tables:

- `recommendation_reasoning`
- `recommendation_contradictions`
- `recommendation_uncertainties`
- `recommendation_invalidation_rules`
- `confidence_breakdowns`
- `reasoning_chains`

The tables store generated artifacts by `recommendation_key`, instrument, model version, and timestamp. This supports auditability, recommendation version comparison, and future explainability analytics.

## UX Principles

The UI should stay concise:

- Cards show only the strongest trust labels and one-line reason.
- Detail modal adds sections for Why This Exists, Contradictions, Uncertainty, Invalidation, and AI Confidence Breakdown.
- Confidence is visualized as component bars rather than a wall of text.
- Evidence and contradiction chips should be scannable.
- Full research remains optional.

## Trust-Building Rules

Always show:

- Supporting evidence.
- Contradicting evidence.
- Uncertainty.
- Invalidation triggers.
- Assumptions and limitations.
- Why confidence is below perfect.

Never show:

- Guaranteed language.
- Hidden contradictions.
- Overconfident tactical or crypto recommendations.
- Weak-data ideas as high conviction.
