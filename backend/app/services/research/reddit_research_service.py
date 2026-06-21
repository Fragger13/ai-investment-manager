"""Reddit as a *signal* layer (sentiment + underdog discovery), not a source of
recommendations. The quant engine still decides every pick; Reddit only:

1. collates community sentiment for assets the engine already chose
   (``community_sentiment_for``), surfaced to the user and used as a small,
   bounded confidence nudge in the priority engine; and
2. nominates "underdog" candidates being discussed that we do not already
   recommend (``discover_underdogs``) — each of which must still clear the quant
   factor engine before it appears on the Discover page.

No Reddit API key is required: we read public subreddit Atom feeds only. Reddit
rate-limits anonymous RSS aggressively **per IP in bursts** — a single
``/hot/.rss`` request succeeds, but bursts (or any query-string feed such as
``search.rss?q=`` / ``top/.rss?t=week``) return 429. So we fetch a small set of
no-query ``hot/.rss`` feeds **sequentially with a polite gap**, lean on the 24h
disk cache in :mod:`http_client` (which also serves stale copies on 429), and
degrade to empty everywhere. The whole feature is best-effort: on a throttled or
offline run, recommendations and Discover render exactly as before, just without
the community block.
"""

from __future__ import annotations

import html
import re
import time

from app.services.intelligence import now_iso
from app.services.nlp.sentiment_analyzer import analyze_sentiment
from app.services.research.http_client import fetch_text

# Curated, well-known per-class communities. These are *sources*, not assets, so
# they do not violate the "no hardcoded assets" rule. Easy to extend.
CURATED_SUBREDDITS: dict[str, list[str]] = {
    "fund": ["mutualfunds", "IndiaInvestments"],
    "equity": ["IndianStreetBets", "IndiaInvestments"],
    "crypto": ["CryptoCurrency", "CryptoIndia"],
}

_FEED_URL = "https://www.reddit.com/r/{sub}/hot/.rss"
_CACHE_TTL = 24 * 3600       # per-feed disk cache (http_client)
_CORPUS_TTL = 6 * 3600       # in-memory assembled-corpus cache
_REQUEST_GAP = 2.0           # seconds between the (few) live fetches in one build
_MAX_LIVE_PER_BUILD = 2      # Reddit anon RSS is burst-limited per IP — stay gentle
_MIN_MENTIONS_FOR_NUDGE = 3  # below this, sentiment is display-only (see priority engine)

# Generic fund words that carry no matching signal — stripped when building aliases.
_FUND_STOPWORDS = {
    "fund", "direct", "regular", "growth", "plan", "scheme", "mutual", "index",
    "the", "of", "and", "&", "series", "idcw", "dividend", "option",
}
# Style phrases shared by hundreds of funds — too generic to identify a scheme.
_FUND_STYLE_PHRASES = {
    "flexi cap", "small cap", "mid cap", "large cap", "multi cap", "large mid",
    "value fund", "focused fund", "blue chip", "next 50", "nifty 50",
}
# Single English words that collide with asset names — never match on these alone.
_COMMON_WORDS = {
    "figure", "power", "vision", "global", "capital", "money", "gold", "silver",
    "grid", "story", "point", "trust", "first", "new", "best", "one", "max",
    "force", "happy", "info", "data", "smart", "magic", "poly", "fact",
}

_CORPUS_CACHE: dict[str, object] = {"ts": 0.0, "posts": []}
_LIVE_CURSOR: dict[str, int] = {"i": 0}


# ---------------------------------------------------------------------------
# Corpus ingestion (public RSS only, gentle + cached)
# ---------------------------------------------------------------------------


def _all_subreddits() -> list[str]:
    seen: list[str] = []
    for subs in CURATED_SUBREDDITS.values():
        for sub in subs:
            if sub not in seen:
                seen.append(sub)
    return seen


def _strip_html(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_feed(xml_text: str, subreddit: str) -> list[dict]:
    posts: list[dict] = []
    for entry in re.findall(r"<entry>(.*?)</entry>", xml_text, re.S):
        title_m = re.search(r"<title>(.*?)</title>", entry, re.S)
        content_m = re.search(r"<content[^>]*>(.*?)</content>", entry, re.S)
        link_m = re.search(r'<link[^>]*href="([^"]+)"', entry)
        title = _strip_html(title_m.group(1)) if title_m else ""
        body = _strip_html(content_m.group(1)) if content_m else ""
        if not title:
            continue
        # Skip recurring advice/promo megathreads — they are noise for matching.
        low = title.lower()
        if any(tag in low for tag in ("advice thread", "promotional content", "daily discussion", "weekly discussion", "rules of")):
            continue
        posts.append(
            {
                "subreddit": subreddit,
                "title": title,
                "text": f"{title}. {body}",
                "url": link_m.group(1) if link_m else f"https://www.reddit.com/r/{subreddit}/",
            }
        )
    return posts


def _disk_cached_feed(url: str) -> str:
    """Return a feed body from http_client's disk cache without any network call
    (so assembling the corpus never bursts). Empty string when not cached."""
    try:
        from app.services.research.http_client import _read_cache

        result = _read_cache(url, _CACHE_TTL)
        if result and result.text:
            return result.text
    except Exception:  # noqa: BLE001
        pass
    return ""


def fetch_subreddit_corpus(force: bool = False) -> list[dict]:
    """Recent ``hot`` posts across the curated subreddits. Assembled mostly from the
    24h disk cache (no network), topping up at most ``_MAX_LIVE_PER_BUILD`` feeds
    with live requests per build (round-robin) to respect Reddit's burst limit. The
    coverage self-heals across runs as the disk cache fills. Never raises; returns
    whatever it has (possibly empty)."""
    now = time.time()
    cached = _CORPUS_CACHE.get("posts") or []
    if not force and cached and now - float(_CORPUS_CACHE.get("ts", 0.0)) < _CORPUS_TTL:
        return cached  # type: ignore[return-value]

    subs = _all_subreddits()
    if not subs:
        return cached  # type: ignore[return-value]
    start = _LIVE_CURSOR["i"] % len(subs)
    _LIVE_CURSOR["i"] = start + 1
    # Round-robin order so a different feed gets the live slot each build.
    ordered = subs[start:] + subs[:start]

    posts: list[dict] = []
    live_used = 0
    for sub in ordered:
        url = _FEED_URL.format(sub=sub)
        text = _disk_cached_feed(url)
        if not text and live_used < _MAX_LIVE_PER_BUILD:
            if live_used:
                time.sleep(_REQUEST_GAP)
            live_used += 1
            try:
                # retries=0 so http_client doesn't itself burst; it still falls back
                # to a stale disk copy on 429.
                result = fetch_text(url, timeout=10, retries=0, cache_ttl_seconds=_CACHE_TTL, require_xml=True)
                if result.ok and result.text:
                    text = result.text
            except Exception:  # noqa: BLE001 — Reddit must never break the pipeline
                text = ""
        if text:
            posts.extend(_parse_feed(text, sub))

    if posts:
        _CORPUS_CACHE.update(ts=now, posts=posts)
        return posts
    # Nothing available this run — keep returning the last good corpus if any.
    return cached  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Aliases + matching
# ---------------------------------------------------------------------------


def aliases_for(name: str, asset_class: str = "") -> list[str]:
    """Distinctive match aliases for a recommended asset, built to keep false
    positives low. Aliases are tagged so :func:`_matches` knows how to match them:
    ``__TICKER__SYM`` / ``__WORD__Proper`` = whole-word, case-sensitive; a phrase
    with a space = lowercase substring; anything else = lowercase substring."""
    name = (name or "").strip()
    if not name:
        return []
    aliases: set[str] = set()

    if asset_class == "fund":
        low = name.lower()
        tokens = [t for t in re.split(r"[^a-z0-9]+", low) if t and t not in _FUND_STOPWORDS]
        # Distinctive AMC + leading-style phrase, e.g. "parag parikh", "hdfc flexi".
        if len(tokens) >= 2:
            phrase = " ".join(tokens[:2])
            if phrase not in _FUND_STYLE_PHRASES:
                aliases.add(phrase)
        # Known AMC short forms.
        if "parag" in tokens and "parikh" in tokens:
            aliases.update({"ppfas", "parag parikh"})
    else:  # equity / crypto
        ticker = ""
        try:
            if asset_class == "equity":
                from app.services.research.equity_factor_service import ticker_from_constituents

                ticker = (ticker_from_constituents(name) or "").replace(".NS", "")
            elif asset_class == "crypto":
                from app.services.research.crypto_factor_service import crypto_ticker_for_name

                ticker = crypto_ticker_for_name(name) or ""
        except Exception:  # noqa: BLE001
            ticker = ""
        if ticker and len(ticker) >= 2:
            aliases.add(f"${ticker.upper()}")            # cashtag form
            aliases.add(f"__TICKER__{ticker.upper()}")    # uppercase standalone
        words = [w for w in re.split(r"\s+", name) if w]
        clean = [w for w in words if w.lower() not in {"ltd", "ltd.", "limited", "industries", "the", "inc", "inc.", "corporation"}]
        if len(clean) >= 2:
            aliases.add(" ".join(clean).lower())          # full multi-word name (specific)
        elif len(clean) == 1 and len(clean[0]) >= 5 and clean[0].lower() not in _COMMON_WORDS:
            aliases.add(f"__WORD__{clean[0]}")            # single proper-noun name, case-sensitive
    return sorted(aliases)


def _matches(post: dict, aliases: list[str]) -> bool:
    text = post.get("text", "")
    low = text.lower()
    for alias in aliases:
        if alias.startswith("__TICKER__"):
            sym = alias[len("__TICKER__"):]
            if re.search(rf"(?<![A-Za-z0-9]){re.escape(sym)}(?![A-Za-z0-9])", text):
                return True
        elif alias.startswith("__WORD__"):
            word = alias[len("__WORD__"):]
            if re.search(rf"(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])", text):
                return True
        elif alias in low:  # phrase or distinctive substring
            return True
    return False


# ---------------------------------------------------------------------------
# Public: community sentiment for an already-chosen recommendation
# ---------------------------------------------------------------------------


def community_sentiment_for(name: str, asset_class: str = "") -> dict:
    """Collated Reddit sentiment for a recommended asset. Returns ``{}`` when the
    corpus is empty or the asset is not being discussed (no fabrication)."""
    corpus = fetch_subreddit_corpus()
    if not corpus:
        return {}
    aliases = aliases_for(name, asset_class)
    if not aliases:
        return {}
    matched = [p for p in corpus if _matches(p, aliases)]
    if not matched:
        return {}

    scores: list[int] = []
    bullish_terms: set[str] = set()
    bearish_terms: set[str] = set()
    counts = {"bullish": 0, "bearish": 0, "mixed": 0, "neutral": 0}
    for post in matched:
        s = analyze_sentiment(post["text"])
        scores.append(int(s.get("sentimentScore", 50)))
        counts[s.get("sentiment", "neutral")] = counts.get(s.get("sentiment", "neutral"), 0) + 1
        bullish_terms.update(s.get("bullishTerms", []))
        bearish_terms.update(s.get("bearishTerms", []))

    mean_score = round(sum(scores) / len(scores))
    if mean_score >= 60 and counts["bullish"] >= counts["bearish"]:
        overall = "positive"
    elif mean_score <= 40 and counts["bearish"] > counts["bullish"]:
        overall = "negative"
    elif counts["bullish"] and counts["bearish"]:
        overall = "mixed"
    else:
        overall = "neutral"

    # Sample the most opinionated posts (furthest from neutral) for display.
    samples = sorted(matched, key=lambda p: abs(analyze_sentiment(p["text"]).get("sentimentScore", 50) - 50), reverse=True)
    sample_posts = [{"title": p["title"][:140], "url": p["url"], "subreddit": p["subreddit"]} for p in samples[:3]]

    return {
        "source": "reddit",
        "mentionCount": len(matched),
        "sentiment": overall,
        "sentimentScore": mean_score,
        "bullishTerms": sorted(bullish_terms)[:6],
        "bearishTerms": sorted(bearish_terms)[:6],
        "subreddits": sorted({p["subreddit"] for p in matched}),
        "samplePosts": sample_posts,
        "disclaimer": "Community chatter is noisy and can be biased or manipulated — it is context, not advice.",
        "asOf": now_iso(),
    }


# ---------------------------------------------------------------------------
# Public: underdog discovery (nominate, do not decide)
# ---------------------------------------------------------------------------


def discover_underdogs(existing_names: set[str] | None = None, limit: int = 6) -> list[dict]:
    """Equity/crypto names being discussed that we do not already recommend, ranked
    by mention frequency × positive sentiment. These map to the live NSE/CoinGecko
    universes (so the quant engine can validate them); funds are intentionally out
    of scope here (their full names rarely appear verbatim and match poorly).
    Returns nominations only — the caller must factor-check before surfacing."""
    corpus = fetch_subreddit_corpus()
    if not corpus:
        return []
    excluded = {e.strip().lower() for e in (existing_names or set())}

    universe: list[dict] = []
    try:
        from app.services.research.equity_factor_service import constituents

        for member in constituents():
            universe.append(
                {
                    "name": member["name"],
                    "assetClass": "equity",
                    "ticker": member["symbol"],
                    "aliases": aliases_for(member["name"], "equity"),
                }
            )
    except Exception:  # noqa: BLE001
        pass
    try:
        from app.services.research.crypto_factor_service import crypto_universe_list

        for coin in crypto_universe_list():
            universe.append(
                {
                    "name": coin["name"],
                    "assetClass": "crypto",
                    "ticker": coin["symbol"],
                    "coinId": coin["id"],
                    "aliases": aliases_for(coin["name"], "crypto"),
                }
            )
    except Exception:  # noqa: BLE001
        pass

    nominations: list[dict] = []
    for item in universe:
        if item["name"].strip().lower() in excluded or item["ticker"].lower() in excluded:
            continue
        matched = [p for p in corpus if _matches(p, item["aliases"])]
        if len(matched) < 2:  # need a minimum of genuine chatter
            continue
        scores = [int(analyze_sentiment(p["text"]).get("sentimentScore", 50)) for p in matched]
        mean_score = round(sum(scores) / len(scores))
        if mean_score < 52:  # only surface net-positive chatter
            continue
        nominations.append(
            {
                "name": item["name"],
                "assetClass": item["assetClass"],
                "ticker": item["ticker"],
                "coinId": item.get("coinId", ""),
                "mentionCount": len(matched),
                "sentiment": "positive" if mean_score >= 60 else "mixed",
                "sentimentScore": mean_score,
                "subreddits": sorted({p["subreddit"] for p in matched}),
                "samplePosts": [{"title": p["title"][:140], "url": p["url"]} for p in matched[:2]],
            }
        )

    nominations.sort(key=lambda n: (n["mentionCount"], n["sentimentScore"]), reverse=True)
    return nominations[:limit]
