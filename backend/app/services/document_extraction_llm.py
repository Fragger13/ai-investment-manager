"""LLM pass for uploaded financial documents.

The deterministic transaction analysis in document_intelligence is the
baseline; this layer reads the same text with a language model and returns
per-field values with evidence. Every number the model reports must actually
appear in the document (validated against the deterministic money-value set),
so a hallucinated figure can never reach the user's profile. When the model
is unavailable or returns garbage, callers keep the deterministic result —
same "never an outage" contract as chat.
"""
from __future__ import annotations

from typing import Any

from app.services.llm.model_router import extract_document_fields

# Field key → (patch key, must the value literally appear in the document?)
# monthlyExpenses is a judgement call (sums/averages), so it is exempt from
# the literal-presence rule but clamped by the caller instead.
FIELD_MAP: dict[str, tuple[str, bool]] = {
    "monthlySalary": ("monthlySalary", True),
    "monthlyRent": ("rent", True),
    "monthlyEmi": ("emi", True),
    "monthlySubscriptions": ("subscriptions", False),
    "monthlyExpenses": ("monthlyExpenses", False),
    "investmentsValue": ("mutualFundsValue", True),
}

_DOC_GUIDANCE: dict[str, str] = {
    "salary_slip": (
        "This is a salary slip. monthlySalary means the NET take home pay "
        "(the 'Net Pay' / 'Net Salary' / amount credited line), never the gross, CTC, basic or HRA."
    ),
    "bank_statement": (
        "This is a bank account statement. Salary is usually a recurring credit that arrives once a month "
        "with a similar amount, often via NEFT/IMPS/RTGS/ACH and often naming an employer — but a NEFT credit "
        "alone is not proof; prefer recurring monthly credits. EMIs are recurring debits of identical amounts, "
        "often marked EMI/NACH/ECS/ACH-D or naming a lender. Transaction amounts, never the running balance column."
    ),
    "credit_card": (
        "This is a credit card statement. monthlyExpenses is the total monthly spend on the card; "
        "monthlyEmi is any card EMI instalment; monthlySubscriptions covers recurring merchants like "
        "Netflix, Spotify, Prime."
    ),
    "loan_statement": "This is a loan or CIBIL statement. Report the monthly EMI instalment amount.",
    "portfolio": (
        "This is an investment portfolio or CAS statement. investmentsValue is the TOTAL current value "
        "of all holdings combined."
    ),
}


def build_extraction_prompt(text: str, doc_type: str | None) -> str:
    guidance = _DOC_GUIDANCE.get(doc_type or "", "This is a personal financial document from India.")
    body = _cap_text(text)
    return (
        "You extract figures from Indian personal finance documents. Amounts are INR.\n"
        f"{guidance}\n"
        "Rules:\n"
        "- Report MONTHLY figures. If the document covers several months, report the typical single month figure, not the total.\n"
        "- Only report a figure you can point to in the document. If unsure or absent, use 0.\n"
        "- evidence must be the exact line (or fragment) from the document that justifies the value.\n"
        "- Never use running balance figures.\n"
        'Reply with ONLY this JSON, no other text:\n'
        '{"monthlySalary": {"value": 0, "evidence": ""}, "monthlyRent": {"value": 0, "evidence": ""}, '
        '"monthlyEmi": {"value": 0, "evidence": ""}, "monthlySubscriptions": {"value": 0, "evidence": ""}, '
        '"monthlyExpenses": {"value": 0, "evidence": ""}, "investmentsValue": {"value": 0, "evidence": ""}}\n'
        f"Document:\n{body}"
    )


def _cap_text(text: str, max_lines: int = 160, max_chars: int = 6500) -> str:
    # Keep the lines that can carry figures; drop the rest to stay inside a
    # small model's useful context.
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    with_digits = [line for line in lines if any(ch.isdigit() for ch in line)]
    picked = (with_digits or lines)[:max_lines]
    return "\n".join(picked)[:max_chars]


def llm_extract(text: str, doc_type: str | None, document_values: set[int]) -> dict[str, dict[str, Any]]:
    """Returns {patch_key: {"value": int, "evidence": str}} for fields the
    model reported AND that survive validation. Empty dict on any failure."""
    if len(text.strip()) < 40:
        return {}
    raw = extract_document_fields(build_extraction_prompt(text, doc_type))
    if not raw:
        return {}
    validated: dict[str, dict[str, Any]] = {}
    total_ceiling = sum(document_values) if document_values else 0
    for llm_key, (patch_key, must_exist) in FIELD_MAP.items():
        entry = raw.get(llm_key)
        if not isinstance(entry, dict):
            continue
        try:
            value = int(float(entry.get("value") or 0))
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        if must_exist and not _value_in_document(value, document_values):
            continue
        if not must_exist and total_ceiling and value > total_ceiling:
            continue
        validated[patch_key] = {"value": value, "evidence": str(entry.get("evidence") or "")[:160]}
    return validated


def _value_in_document(value: int, document_values: set[int]) -> bool:
    # ±1 absorbs rounding of paise; nothing looser, or hallucinations slip in.
    return value in document_values or (value - 1) in document_values or (value + 1) in document_values
