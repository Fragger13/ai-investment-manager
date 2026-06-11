from __future__ import annotations


def clean_market_headline(summary: str, signal_type: str, sectors: list[str] | None = None, macro_themes: list[str] | None = None) -> str:
    sectors = sectors or []
    macro_themes = macro_themes or []
    text = " ".join((summary or signal_type).split())
    lower = text.lower()
    if "amfi nav record" in lower:
        if "liquid" in lower:
            return "Liquid fund NAV update supports emergency reserve review"
        if "nifty" in lower or "index" in lower:
            return "Index fund NAV update supports long-term SIP review"
        return "Mutual fund NAV update supports allocation review"
    if "rbi" in lower or "repo" in lower or "rate" in lower:
        return "Rate and liquidity signals may affect banks, NBFCs, and real estate"
    if "infra" in lower or "capex" in lower or "budget" in lower:
        return "Infrastructure spending could support capital goods, cement, and construction"
    if "defence" in lower or "geopolitical" in lower or "war" in lower:
        return "Geopolitical and defence signals may support defence suppliers and gold"
    if "oil" in lower or "crude" in lower:
        return "Oil moves may shift profits between energy and oil-consuming sectors"
    if "rupee" in lower or "currency" in lower or "dollar" in lower:
        return "Currency moves may help exporters and pressure import-heavy sectors"
    if "gold" in lower:
        return "Gold signals may indicate demand for portfolio hedges"
    if "crypto" in lower or "bitcoin" in lower or "ethereum" in lower:
        return "Crypto signals remain tactical and high-risk"
    if sectors:
        return f"{sectors[0].title()} signal: {_short_title(text)}"
    if macro_themes:
        return f"{macro_themes[0].title()} signal: {_short_title(text)}"
    return _short_title(text)


def _short_title(value: str) -> str:
    value = " ".join(value.split())
    return value[:88].rstrip() + ("..." if len(value) > 88 else "")
