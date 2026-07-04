"""Indian-system digit grouping for rupee amounts.

Indian numbers group the last three digits, then every two: 2,34,000 (not
234,000), 1,50,414 (not 150,414). Two entry points:

* ``format_inr_indian(amount)`` — format a number for user-facing copy.
* ``indianize_currency(text)`` — repair Western-grouped rupee amounts inside
  already-written text (LLM replies echo whatever grouping they saw).
"""

from __future__ import annotations

import re

_CURRENCY_NUMBER = re.compile(r"((?:Rs\.?|₹|INR)\s?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?)")


def group_digits_indian(digits: str) -> str:
    """'234000' → '2,34,000'; '25069' → '25,069'; '999' → '999'."""
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    pairs: list[str] = []
    while len(head) > 2:
        pairs.insert(0, head[-2:])
        head = head[:-2]
    if head:
        pairs.insert(0, head)
    return ",".join(pairs + [tail])


def format_inr_indian(amount: float, prefix: str = "Rs ") -> str:
    value = round(float(amount or 0))
    sign = "-" if value < 0 else ""
    return f"{sign}{prefix}{group_digits_indian(str(abs(value)))}"


def indianize_currency(text: str) -> str:
    """Re-group any Western-grouped rupee amounts in ``text``.

    Only touches numbers attached to a currency marker (Rs/₹/INR), so dates,
    percentages and bare figures stay as written. Amounts under one lakh are
    identical in both systems and pass through unchanged.
    """

    def _fix(match: re.Match[str]) -> str:
        prefix, number = match.group(1), match.group(2)
        whole, dot, frac = number.partition(".")
        regrouped = group_digits_indian(whole.replace(",", ""))
        return f"{prefix}{regrouped}{dot}{frac}"

    return _CURRENCY_NUMBER.sub(_fix, text or "")
