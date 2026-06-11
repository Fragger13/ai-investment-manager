# Strategy Validation Architecture

## Validation Philosophy

Phase 7D adds historical validation as a supporting evidence layer, not a price-prediction engine.

The system answers:

> Has this type of setup historically behaved reasonably well under similar conditions?

It must not answer:

> Will this asset rise from here?

Every validation result is treated as probabilistic context. Weak historical evidence downgrades conviction, allocation, or action status. Strong historical evidence can improve confidence, but never removes market risk.

## Architecture

```text
Asset / Signal / Recommendation
    -> Historical Price Cache
    -> Lightweight Strategy Backtest
    -> Benchmark Comparison
    -> Regime-Aware Reliability
    -> Signal Quality Scoring
    -> Tactical Setup Validation
    -> Portfolio-Level Risk Validation
    -> Recommendation Confidence Adjustment
    -> UI / Chat Explanation
```

## Components

- `historical_price_cache`: stores compact historical close/volume series with source, mode, and timestamp.
- `strategy_backtests`: stores moving-average, breakout, defensive, and tactical validation metrics.
- `benchmark_comparisons`: compares each setup against NIFTY/SENSEX or asset-class benchmark proxies.
- `signal_validation_results`: stores signal-level reliability and sample-size warnings.
- `regime_backtest_results`: stores strategy behavior by bull, bear, risk-on, risk-off, high-volatility, and defensive regimes.
- `portfolio_validation_results`: stores diversification, concentration, drawdown, and volatility-stacking checks.
- `signal_reliability_scores`: stores reusable reliability scores by signal type, setup type, asset class, and regime.

## Reliability Scoring

Reliability combines:

- sample size
- win rate
- average and median forward return
- max drawdown
- volatility and downside deviation
- benchmark-relative return
- signal decay
- data freshness
- current market regime fit

Low sample size or stale data caps reliability even if returns look strong.

## Regime-Aware Logic

The same signal is scored differently depending on regime:

- momentum can score higher in risk-on or bull regimes
- breakouts are penalized in high-volatility regimes
- defensive rotation receives more weight in risk-off or inflationary regimes
- crypto setups receive faster signal-decay penalties

## Benchmark Comparison

The first implementation compares against simple benchmark proxies:

- Indian equities / ETFs: NIFTY 50 proxy
- broad defensive assets: NIFTY 50 plus risk penalty
- crypto: BTC proxy when relevant
- fallback: equal-period buy-and-hold benchmark

Benchmark comparison reduces recommendation strength if a setup has poor risk-adjusted relative behavior.

## Recommendation Integration

The orchestrator consumes validation output before final ranking:

- high validation quality can modestly improve conviction and risk-adjusted score
- weak validation downgrades high-risk/tactical ideas to Watchlist
- insufficient sample size prevents high-conviction language
- max drawdown and volatility feed risk copy and allocation caps

## UI Integration

Recommendation details show a concise Historical Validation section:

- reliability
- win rate
- max drawdown
- benchmark comparison
- best regime
- sample size
- setup quality

The Strategy Lab page allows inspection of validated strategies and signal reliability without turning the product into a quant terminal.

## Anti-Overfitting Safeguards

- no intraday or HFT systems
- minimum sample-size labels
- no exact future target claims
- no validation for illiquid or weak-data assets as high conviction
- validation is one evidence input only
- backtests are labelled as historical and non-predictive

## Limitations

The first implementation is lightweight and rule-based. It intentionally avoids heavy optimization and future leakage. Optional future hooks can add vectorbt, Monte Carlo simulation, Bayesian portfolio optimization, or FinRL-style experiments behind feature flags.
