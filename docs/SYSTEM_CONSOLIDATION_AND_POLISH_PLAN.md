# System Consolidation + Polish Plan

## Current Complexity Issues

The platform now has many strong intelligence layers: research ingestion, market regime, asset intelligence, validation, portfolio optimization, memory, and explainability. The risk is no longer missing intelligence. The risk is too much visible intelligence at once.

Current symptoms to control:

- Recommendation payloads contain repeated reasoning, repeated evidence, and overlapping labels.
- Tactical, watchlist, defensive, and core recommendations can appear with similar visual weight.
- Market cards can expose too much raw signal detail.
- Dashboard can feel like a collection of modules rather than a focused command center.
- Expensive orchestration may recompute on repeated requests.

## Orchestration Issues

Several agents can influence the same fields: conviction, confidence, risk, evidence, validation, and action. Phase 7H adds a final consolidation stage after advanced recommendation generation:

```text
Recommendation engine
  -> quality audit
  -> conflict resolution
  -> consolidation + importance scoring
  -> compression
  -> grouped response
```

This preserves the intelligence underneath while giving the product one final opinion about what deserves attention.

## UX Pain Points

The product should stay simple by default:

- Cards show action, asset, expected return, allocation, conviction, top reason, risk, linked goal.
- Details use progressive disclosure.
- Full evidence, confidence decomposition, reasoning chain, and raw research stay behind accordions.
- Market intelligence answers five questions: what happened, why it matters, who benefits, who suffers, and whether it affects the user.

## Performance Bottlenecks

Likely bottlenecks:

- Repeated recommendation generation on dashboard/recommendation page loads.
- Repeated market signal enrichment.
- Large payloads with raw evidence and long explanations.
- Duplicate persistence of generated reasoning artifacts.

Phase 7H adds a Redis-ready cache abstraction with in-memory fallback. It caches:

- Recommendations
- Market signals
- Market regime
- Evidence-shaped response fragments
- Asset research-shaped fragments

The cache is intentionally small and TTL-based. Redis can be added later without changing call sites.

## Recommendation Consistency Strategy

Each recommendation receives an `importanceScore`, `surfaceGroup`, and compressed UI fields:

- `Top Recommendations`
- `Tactical Opportunities`
- `Watchlist`
- `Risks To Review`

Importance score combines:

- Goal relevance
- Conviction
- Evidence quality
- Portfolio impact
- Diversification impact
- Urgency
- Novelty
- Market-regime alignment
- Risk and contradiction penalties

Quality audit downgrades or flags:

- Duplicate recommendations
- Weak evidence
- Unsupported high-risk ideas
- Overaggressive crypto/tactical exposure
- Portfolio concentration issues
- Excessive overlap

## Alert Prioritization Strategy

Alerts are classified as:

- Critical
- Important
- Watchlist
- Informational

Only critical and important alerts should receive prominent dashboard placement. Watchlist and informational alerts stay accessible but quieter.

## Frontend Simplification Strategy

Recommendation cards should be calm and concise. Detail modals should keep advanced sections collapsed where possible. Dashboard should answer:

1. What should I focus on?
2. What changed?
3. What are the risks?
4. What opportunities matter?
5. Am I on track?

## Production Readiness Hooks

Phase 7H prepares production architecture without deploying infrastructure:

- Cache abstraction
- Structured app logger
- Environment validation helper
- Task queue interface with synchronous fallback
- Rate-limit hook
- Retry/timeout helper patterns
- Additional health metadata endpoint

These hooks make the system easier to harden later without large rewrites.
