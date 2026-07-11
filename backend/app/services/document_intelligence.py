"""Document upload analysis.

Three layers, best available wins per field:
1. Structure: CSV/XLSX statements are parsed into real transactions
   (debit/credit columns, never the running balance), and salary/EMI/rent
   emerge from recurrence patterns — salary is the recurring monthly credit,
   EMIs are recurring identical debits, whatever the narration says.
2. Language model: the same text goes through an LLM extraction pass with
   evidence, but every value it reports must literally appear in the
   document — a hallucinated number can never reach the profile.
3. Keywords: the original line-keyword heuristics remain as the floor for
   unstructured text, and the whole thing degrades gracefully to it when the
   model is unreachable.
"""
from __future__ import annotations

import csv
import json
import re
import statistics
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree

from app.schemas.document import DocumentAnalyzeRequest
from app.services.document_extraction_llm import llm_extract


SUPPORTED_TYPES = {"pdf", "csv", "xlsx", "xls"}

_DATE_TOKEN = re.compile(r"\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b")


def _money_values(text: str) -> list[int]:
    # Dates like 01/06/2026 would otherwise contribute "2026" as an amount.
    text = _DATE_TOKEN.sub(" ", text)
    values = []
    for match in re.findall(r"(?:rs\.?|inr|₹)?\s*([0-9][0-9,]{2,}(?:\.\d+)?)", text, flags=re.IGNORECASE):
        try:
            value = int(float(match.replace(",", "")))
        except ValueError:
            continue
        if 100 <= value <= 100000000:
            values.append(value)
    return values


# ------------------------------------------------------------ text extraction

def _extract_pdf_text(path: Path) -> str:
    # Real extraction first; the legacy latin-1 fragment scrape stays as the
    # floor for odd or image-based PDFs (until OCR lands).
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages[:40]]
        text = "\n".join(pages).strip()
        if len(text) > 40:
            return text
    except Exception:
        pass
    raw = path.read_bytes()
    decoded = raw.decode("latin-1", errors="ignore")
    fragments = re.findall(r"\(([^()]{0,200})\)", decoded[:400000])
    return "\n".join(fragments) if fragments else decoded[:250000]


def _csv_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.reader(handle))[:2000]


def _xlsx_rows(path: Path) -> list[list[str]]:
    rows: list[list[str]] = []
    with zipfile.ZipFile(path) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
            for node in root.iter():
                if node.tag.endswith("}t") and node.text:
                    shared_strings.append(node.text)
        for name in workbook.namelist():
            if not name.startswith("xl/worksheets/sheet") or not name.endswith(".xml"):
                continue
            root = ElementTree.fromstring(workbook.read(name))
            for row_node in root.iter():
                if not row_node.tag.endswith("}row"):
                    continue
                row: list[str] = []
                for cell in row_node:
                    if not cell.tag.endswith("}c"):
                        continue
                    cell_type = cell.attrib.get("t")
                    value_node = next((child for child in cell if child.tag.endswith("}v")), None)
                    if value_node is None or value_node.text is None:
                        row.append("")
                        continue
                    if cell_type == "s":
                        index = int(value_node.text)
                        row.append(shared_strings[index] if index < len(shared_strings) else "")
                    else:
                        row.append(value_node.text)
                if row:
                    rows.append(row)
    return rows[:2000]


def extract_text(path: Path, file_type: str) -> str:
    normalized = file_type.lower().lstrip(".")
    if normalized == "csv":
        return "\n".join(" ".join(cell for cell in row if cell) for row in _csv_rows(path))
    if normalized in {"xlsx", "xls"}:
        return "\n".join(" ".join(cell for cell in row if cell) for row in _xlsx_rows(path))
    if normalized == "pdf":
        return _extract_pdf_text(path)
    return ""


# --------------------------------------------------------------- transactions

_AMOUNT_HEADERS = ("debit", "withdrawal", "credit", "deposit", "amount", "dr", "cr")
_BALANCE_HEADERS = ("balance", "closing")
_DATE_FORMATS = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y", "%d-%b-%Y", "%d %b %Y", "%d-%b-%y")


def _parse_date(cell: str) -> str:
    token = (cell or "").strip()[:12]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(token, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def _parse_amount_cell(cell: str) -> int:
    digits = re.sub(r"[^0-9.]", "", cell or "")
    if not digits:
        return 0
    try:
        value = float(digits)
    except ValueError:
        return 0
    return int(value) if 1 <= value <= 100000000 else 0


def _parse_transactions(rows: list[list[str]]) -> list[dict] | None:
    """Bank exports become real transaction records; the running balance
    column is dropped entirely. Handles both layouts: separate
    debit/withdrawal + credit/deposit columns, and a single amount column
    with a Dr/Cr type column (Kotak-style)."""
    header_index = None
    header: list[str] = []
    for index, row in enumerate(rows[:10]):
        lowered = [cell.strip().lower() for cell in row]
        if any(any(h == cell or h in cell for h in _AMOUNT_HEADERS) for cell in lowered):
            header_index = index
            header = lowered
            break
    if header_index is None:
        return None
    debit_cols = [i for i, c in enumerate(header) if ("debit" in c or "withdrawal" in c or c == "dr") and "amount" not in c and not any(b in c for b in _BALANCE_HEADERS)]
    credit_cols = [i for i, c in enumerate(header) if ("credit" in c or "deposit" in c or c == "cr") and "amount" not in c and not any(b in c for b in _BALANCE_HEADERS)]
    amount_only_cols = [i for i, c in enumerate(header) if "amount" in c and not any(b in c for b in _BALANCE_HEADERS)]
    # "Debit Amount"/"Credit Amount" style headers land in amount_only unless reclaimed:
    for i in list(amount_only_cols):
        if "debit" in header[i] or "withdrawal" in header[i]:
            debit_cols.append(i)
            amount_only_cols.remove(i)
        elif "credit" in header[i] or "deposit" in header[i]:
            credit_cols.append(i)
            amount_only_cols.remove(i)
    type_cols = [i for i, c in enumerate(header) if c in {"dr/cr", "dr / cr", "type", "cr/dr", "transaction type", "txn type"}]
    balance_cols = {i for i, c in enumerate(header) if any(b in c for b in _BALANCE_HEADERS)}
    date_cols = [i for i, c in enumerate(header) if "date" in c]

    two_column = bool(debit_cols and credit_cols)
    amount_typed = bool(amount_only_cols and type_cols)
    if not two_column and not amount_typed:
        return None
    amount_cols = set(debit_cols) | set(credit_cols) | set(amount_only_cols)

    txns: list[dict] = []
    for row in rows[header_index + 1 :]:
        if not any(cell.strip() for cell in row):
            continue
        if two_column:
            debit = max((_parse_amount_cell(row[i]) for i in debit_cols if i < len(row)), default=0)
            credit = max((_parse_amount_cell(row[i]) for i in credit_cols if i < len(row)), default=0)
        else:
            amount = max((_parse_amount_cell(row[i]) for i in amount_only_cols if i < len(row)), default=0)
            marker = " ".join(row[i].strip().lower() for i in type_cols if i < len(row))
            is_credit = "cr" in marker and "dr" not in marker.replace("cr", "")
            debit, credit = (0, amount) if is_credit else (amount, 0)
        if debit == 0 and credit == 0:
            continue
        date = ""
        for i in date_cols:
            if i < len(row):
                date = _parse_date(row[i])
                if date:
                    break
        if not date:
            for cell in row:
                date = _parse_date(cell)
                if date:
                    break
        description = " ".join(
            cell.strip() for i, cell in enumerate(row) if i not in amount_cols and i not in balance_cols and i not in set(type_cols) and cell.strip()
        )
        txns.append({"raw": description, "desc": description.lower(), "debit": debit, "credit": credit, "date": date, "month": date[:7] if date else ""})
    return txns if len(txns) >= 3 else None


def _transactions_text(txns: list[dict]) -> str:
    lines = []
    for t in txns[:300]:
        kind = "CR" if t["credit"] else "DR"
        amount = t["credit"] or t["debit"]
        lines.append(f"{t['month']} {t['raw']} {kind} {amount}")
    return "\n".join(lines)


# --------------------------------------------------- deterministic analysis

_SALARY_KW = ("salary", "sal cr", "payroll", "stipend", "wages")
_TRANSFER_KW = ("neft", "imps", "rtgs", "ach", "trf", "transfer")
_INVEST_KW = ("sip", "mutual fund", "mf ", "zerodha", "groww", "kuvera", "etmoney", "indmoney", "smallcase", "nps", "ppf", "elss", "indian clearing", "icclearing", "bse limited")
_SUBS_KW = ("netflix", "spotify", "prime", "hotstar", "youtube", "google one", "apple.com", "jiocinema", "sonyliv", "subscription")
_RENT_KW = ("rent", "landlord")
_EMI_KW = ("emi", "nach", "ecs", "ach d", "achdr", "loan", "bajaj fin", "hdfc ltd", "lic housing", "repayment", "instalment", "installment")


def _norm_group_key(desc: str) -> str:
    tokens = re.sub(r"[^a-z ]", " ", desc).split()
    return " ".join(tokens[:4]) or desc[:24]


def _group(txns: list[dict], side: str) -> list[dict]:
    groups: dict[str, dict] = {}
    for t in txns:
        amount = t[side]
        if amount <= 0:
            continue
        key = _norm_group_key(t["desc"])
        bucket = groups.setdefault(key, {"key": key, "raw": t["raw"], "amounts": []})
        bucket["amounts"].append(amount)
    return list(groups.values())


def _has_kw(group: dict, keywords: tuple[str, ...]) -> bool:
    haystack = f"{group['key']} {group['raw'].lower()}"
    return any(kw in haystack for kw in keywords)


def _is_recurring(group: dict, min_amount: int = 1000, spread: float = 1.35) -> bool:
    amounts = group["amounts"]
    return len(amounts) >= 2 and min(amounts) >= min_amount and max(amounts) <= spread * min(amounts)


def _field(value: int, confidence: int, explanation: str) -> dict:
    return {"value": int(value), "confidence": confidence, "explanation": explanation}


def _statement_period(txns: list[dict]) -> tuple[str, str, int, float, str]:
    """(start, end, days, month_factor, label). month_factor normalises totals
    to a single month: a 12 day statement has factor ~0.4, a quarter ~3."""
    dates = sorted(t["date"] for t in txns if t.get("date"))
    if not dates:
        return "", "", 0, 1.0, "unknown period"
    start, end = dates[0], dates[-1]
    days = (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days + 1
    factor = max(days / 30.44, 0.25)
    if days < 25:
        label = f"{days} days"
    else:
        approx_months = max(1, round(days / 30.44))
        label = f"about {approx_months} month{'s' if approx_months > 1 else ''}"
    return start, end, days, factor, label


def _emi_display_name(raw: str) -> str:
    """'ACH D- BAJAJFIN LTD 40912' → 'Bajajfin Ltd'."""
    cleaned = re.sub(r"(?i)\b(ach|nach|ecs|adhoc|d|dr|debit|emi|mandate|si|tp)\b", " ", raw)
    cleaned = re.sub(r"[^A-Za-z ]", " ", cleaned)
    words = [w for w in cleaned.split() if len(w) > 1]
    return " ".join(w.capitalize() for w in words[:4]) or "EMI"


def _analyze_transactions(txns: list[dict]) -> tuple[dict[str, dict], list[dict], dict]:
    fields: dict[str, dict] = {}
    categories: dict[str, int] = defaultdict(int)

    start, end, days, month_factor, period_label = _statement_period(txns)
    # Recurrence needs at least ~6 weeks of data to mean anything.
    recurrence_possible = days >= 45

    # Salary: prefer recurring credits that say so; then any recurring monthly
    # credit; a lone NEFT/IMPS credit is only a weak hint. The value is the
    # MEDIAN of one group — a 3 month statement counts salary once, never 3x.
    credit_groups = _group(txns, "credit")
    salary_pick = None
    for group in credit_groups:
        if _has_kw(group, _SALARY_KW) and _is_recurring(group, min_amount=8000):
            salary_pick = (group, 92, "Recurring monthly credit that names salary, counted once.")
            break
    if not salary_pick:
        kw_singles = [g for g in credit_groups if _has_kw(g, _SALARY_KW)]
        if kw_singles:
            best = max(kw_singles, key=lambda g: statistics.median(g["amounts"]))
            salary_pick = (best, 80, "Credit line that names salary.")
    if not salary_pick and recurrence_possible:
        recurring = [g for g in credit_groups if _is_recurring(g, min_amount=10000)]
        if recurring:
            best = max(recurring, key=lambda g: statistics.median(g["amounts"]))
            salary_pick = (best, 78, "Largest credit that repeats monthly with a similar amount, which is how salaries look. Counted once per month.")
    if not salary_pick:
        transfers = [g for g in credit_groups if _has_kw(g, _TRANSFER_KW) and statistics.median(g["amounts"]) >= 15000]
        if transfers:
            best = max(transfers, key=lambda g: statistics.median(g["amounts"]))
            salary_pick = (best, 45, "Largest bank transfer credit. Could be salary, please check.")
    if salary_pick:
        group, confidence, why = salary_pick
        value = int(statistics.median(group["amounts"]))
        fields["monthlySalary"] = _field(value, confidence, why)
        categories["Salary credits"] += sum(group["amounts"])

    # Debits: classify each recurring/named group. Per-month figures use the
    # group MEDIAN (one occurrence), so multi-month statements never double count.
    emi_total = 0
    emi_recurring = False
    emi_breakdown: list[dict] = []
    subs_total = 0
    rent_value = 0
    classified_sum = 0
    debit_groups = _group(txns, "debit")
    for group in debit_groups:
        median = int(statistics.median(group["amounts"]))
        total = sum(group["amounts"])
        if _has_kw(group, _INVEST_KW):
            categories["Investments"] += total
            classified_sum += total
        elif _has_kw(group, _SUBS_KW):
            subs_total += median
            categories["Subscriptions"] += total
            classified_sum += total
        elif _has_kw(group, _RENT_KW):
            if median > rent_value:
                rent_value = median
            categories["Rent"] += total
            classified_sum += total
        elif _has_kw(group, _EMI_KW):
            emi_total += median
            emi_recurring = emi_recurring or len(group["amounts"]) >= 2
            emi_breakdown.append({"name": _emi_display_name(group["raw"]), "amount": median, "occurrences": len(group["amounts"])})
            categories["EMI / loan payments"] += total
            classified_sum += total

    emi_breakdown.sort(key=lambda item: -item["amount"])
    if emi_total:
        plural = "instalments" if len(emi_breakdown) > 1 else "instalment"
        fields["emi"] = _field(emi_total, 88 if emi_recurring else 72, f"{len(emi_breakdown)} monthly {plural}, each counted once: " + ", ".join(f"{i['name']} ₹{i['amount']:,}" for i in emi_breakdown[:4]))
    if subs_total:
        fields["subscriptions"] = _field(subs_total, 80, "Recurring subscription merchants.")
    if rent_value:
        fields["rent"] = _field(rent_value, 85, "Recurring debit that names rent.")

    total_debits = sum(t["debit"] for t in txns)
    other_spend = max(0, round((total_debits - classified_sum) / month_factor))
    if other_spend:
        fields["monthlyExpenses"] = _field(other_spend, 62, f"Everything else that left the account over {period_label}, normalised to one month. Excludes rent, EMIs, investments and subscriptions.")
        categories["Expenses"] += total_debits - classified_sum

    statement_insights = {
        "periodStart": start,
        "periodEnd": end,
        "periodDays": days,
        "periodLabel": period_label,
        "totalMonthlySpend": round(total_debits / month_factor),
        "emiBreakdown": emi_breakdown,
    }
    return fields, [{"name": k, "value": v} for k, v in categories.items()], statement_insights


def infer_financials(text: str) -> dict:
    """Keyword floor for unstructured text (kept for compatibility and as the
    no-structure fallback)."""
    values = _money_values(text)
    categories: dict[str, int] = defaultdict(int)
    profile_patch: dict[str, int] = {}
    salary_values: list[int] = []
    net_salary_values: list[int] = []
    expense_values: list[int] = []
    investment_values: list[int] = []
    emi_values: list[int] = []
    subscription_values: list[int] = []

    for line in text.splitlines():
        line_lower = line.lower()
        line_values = _money_values(line)
        if not line_values:
            continue
        amount = max(line_values)
        if any(token in line_lower for token in ["salary", "payroll", "wages", "income", "credit salary", "net pay", "take home", "in hand"]):
            salary_values.append(amount)
            # Salary slips list basic/HRA/gross AND the take-home figure; the
            # take-home line is the one that means "monthly salary" here.
            if any(token in line_lower for token in ["net pay", "net salary", "take home", "in hand"]):
                net_salary_values.append(amount)
            categories["Salary credits"] += amount
        elif any(token in line_lower for token in ["sip", "mutual", "nse", "bse", "broker", "zerodha", "groww", "investment"]):
            investment_values.append(amount)
            categories["Investments"] += amount
        elif any(token in line_lower for token in ["emi", "loan", "mortgage"]):
            emi_values.append(amount)
            categories["EMI / loan payments"] += amount
        elif any(token in line_lower for token in ["netflix", "spotify", "prime", "subscription", "saas"]):
            subscription_values.append(amount)
            categories["Subscriptions"] += amount
        elif any(token in line_lower for token in ["rent", "grocery", "swiggy", "zomato", "uber", "debit", "upi", "card"]):
            expense_values.append(amount)
            categories["Expenses"] += amount

    if net_salary_values:
        profile_patch["monthlySalary"] = round(sum(net_salary_values[-3:]) / min(len(net_salary_values), 3))
    elif salary_values:
        profile_patch["monthlySalary"] = round(sum(salary_values[-3:]) / min(len(salary_values), 3))
    elif values:
        profile_patch["monthlySalary"] = max(values) if max(values) < 1000000 else 0
    if expense_values:
        profile_patch["monthlyExpenses"] = round(sum(expense_values) / max(1, min(3, len(expense_values))))
    if emi_values:
        profile_patch["emi"] = round(sum(emi_values) / max(1, min(3, len(emi_values))))
    if subscription_values:
        profile_patch["subscriptions"] = sum(subscription_values)
    if investment_values:
        profile_patch["mutualFundsValue"] = max(investment_values)
    detected_income = profile_patch.get("monthlySalary", 0)
    detected_expenses = profile_patch.get("monthlyExpenses", 0)
    net_worth = profile_patch.get("mutualFundsValue", 0)
    if detected_income:
        profile_patch["monthlyCashInflow"] = detected_income
    return {
        "profilePatch": profile_patch,
        "categories": [{"name": key, "value": value} for key, value in categories.items()] or [{"name": "Values found", "value": sum(values[:20]) if values else 0}],
        "detectedIncome": detected_income,
        "detectedExpenses": detected_expenses,
        "subscriptions": len(subscription_values),
        "netWorth": net_worth,
        "confidence": 82 if profile_patch else 38,
        "textLength": len(text),
    }


def _fields_from_text_inference(text: str) -> tuple[dict[str, dict], list[dict]]:
    inferred = infer_financials(text)
    patch = inferred["profilePatch"]
    fields: dict[str, dict] = {}
    mapping = {
        "monthlySalary": (72, "Detected from salary or income-like lines."),
        "monthlyExpenses": (55, "Estimated from common expense lines."),
        "emi": (65, "Detected from EMI or loan labels."),
        "subscriptions": (65, "Detected from subscription-like merchants."),
        "mutualFundsValue": (55, "Detected from investment-like lines."),
    }
    for key, (confidence, why) in mapping.items():
        if patch.get(key):
            fields[key] = _field(patch[key], confidence, why)
    return fields, inferred["categories"]


# --------------------------------------------------------------- merge + API

_FIELD_LABELS = {
    "monthlySalary": "Fixed monthly salary",
    "rent": "Monthly house rent",
    "emi": "Monthly EMI",
    "subscriptions": "Subscriptions",
    "monthlyExpenses": "Monthly expenses",
    "mutualFundsValue": "Mutual funds / investments",
}

# Fields each named document is allowed to fill. None means no restriction
# (backward compatible with callers that send no doc_type).
DOC_TYPE_FIELDS: dict[str, set[str]] = {
    "salary_slip": {"monthlySalary", "monthlyCashInflow"},
    "bank_statement": {"monthlySalary", "monthlyCashInflow", "monthlyExpenses", "emi", "subscriptions", "rent"},
    "credit_card": {"monthlyExpenses", "subscriptions", "emi"},
    "loan_statement": {"emi"},
    "portfolio": {"mutualFundsValue"},
}


def _restrict_to_doc_type(analysis: dict, doc_type: str | None) -> dict:
    allowed = DOC_TYPE_FIELDS.get(doc_type or "")
    if allowed is None:
        return analysis
    analysis["profilePatch"] = {key: value for key, value in analysis["profilePatch"].items() if key in allowed}
    analysis["extractedFields"] = [field for field in analysis["extractedFields"] if field["field"] in allowed]
    return analysis


def _merge_field(det: dict | None, llm: dict | None) -> dict | None:
    if det and llm:
        det_v, llm_v = det["value"], llm["value"]
        if abs(det_v - llm_v) <= 0.1 * max(det_v, llm_v):
            return _field(llm_v, 92, det["explanation"])
        return _field(det_v, 55, f"Pattern analysis says {det_v:,}, the reading model says {llm_v:,}. Please check which is right.")
    if llm:
        return _field(llm["value"], 75, f"Read from the document: {llm['evidence'][:90]}" if llm.get("evidence") else "Read from the document.")
    return det


def response_from_text(
    file_name: str,
    file_type: str,
    text: str,
    document_id: int | None = None,
    doc_type: str | None = None,
    transactions: list[dict] | None = None,
) -> dict:
    normalized = file_type.lower().lstrip(".")
    if normalized not in SUPPORTED_TYPES:
        return {
            "id": document_id,
            "fileName": file_name,
            "fileType": normalized,
            "status": "failed",
            "summary": {"extractionStatus": "Unsupported file type", "confidence": 0, "detectedIncome": 0, "recurringExpenses": 0, "subscriptions": 0, "netWorthExtracted": 0},
            "documents": [{"type": file_name, "status": "Failed", "insight": "PDF, CSV, and XLSX files are supported. Image OCR structure is ready, but OCR is coming soon."}],
            "extractedCategories": [],
            "extractedFields": [],
            "profilePatch": {},
            "aiFindings": ["OCR support for images is coming soon."],
        }

    # Deterministic layer: transaction patterns when the file has real
    # structure, keyword lines otherwise.
    statement_insights: dict | None = None
    if transactions:
        det_fields, categories, statement_insights = _analyze_transactions(transactions)
        llm_text = _transactions_text(transactions)
    else:
        det_fields, categories = _fields_from_text_inference(text)
        llm_text = text

    # Language-model layer, validated against numbers present in the document.
    document_values = set(_money_values(text))
    if transactions:
        for t in transactions:
            document_values.add(t["debit"])
            document_values.add(t["credit"])
    document_values.discard(0)
    llm_fields = llm_extract(llm_text, doc_type, document_values)

    merged: dict[str, dict] = {}
    for key in _FIELD_LABELS:
        result = _merge_field(det_fields.get(key), llm_fields.get(key))
        if result and result["value"] > 0:
            merged[key] = result

    patch: dict[str, int] = {key: field["value"] for key, field in merged.items()}
    if patch.get("monthlySalary"):
        patch["monthlyCashInflow"] = patch["monthlySalary"]

    fields = [
        {
            "field": key,
            "label": _FIELD_LABELS[key],
            "value": field["value"],
            "confidence": field["confidence"],
            "status": "Ready to use" if field["confidence"] >= 75 else "Needs your review",
            "explanation": field["explanation"],
        }
        for key, field in merged.items()
    ]

    confidences = [field["confidence"] for field in merged.values()]
    overall = round(sum(confidences) / len(confidences)) if confidences else 35
    analysis = {
        "id": document_id,
        "fileName": file_name,
        "fileType": normalized,
        "status": "completed" if overall >= 50 else "completed_with_review",
        "summary": {
            "extractionStatus": "Ready for your review" if patch else "Needs your review",
            "confidence": overall,
            "detectedIncome": patch.get("monthlySalary", 0),
            "recurringExpenses": patch.get("monthlyExpenses", 0),
            "subscriptions": 1 if patch.get("subscriptions") else 0,
            "netWorthExtracted": patch.get("mutualFundsValue", 0),
        },
        "documents": [
            {
                "type": file_name,
                "status": "Parsed",
                "insight": (
                    f"Read {len(transactions)} transactions and matched income, EMIs and recurring payments by pattern."
                    if transactions
                    else f"Read {len(text)} characters and extracted likely figures from labelled lines."
                ),
            }
        ],
        "extractedCategories": categories,
        "extractedFields": fields,
        "profilePatch": patch,
        "aiFindings": [
            "Please review extracted values before saving them to your profile.",
            "Fields marked 'Needs your review' were inferred from weak signals or disagreeing sources.",
        ],
        "statement": statement_insights,
    }
    return _restrict_to_doc_type(analysis, doc_type)


def analyze_document(payload: DocumentAnalyzeRequest) -> dict:
    return response_from_text(payload.file_name, payload.file_type, "")


def analyze_saved_file(path: Path, file_name: str, file_type: str, document_id: int | None = None, doc_type: str | None = None) -> dict:
    normalized = file_type.lower().lstrip(".")
    transactions: list[dict] | None = None
    if normalized == "csv":
        transactions = _parse_transactions(_csv_rows(path))
    elif normalized in {"xlsx", "xls"}:
        transactions = _parse_transactions(_xlsx_rows(path))
    text = extract_text(path, file_type)
    return response_from_text(file_name, file_type, text, document_id, doc_type=doc_type, transactions=transactions)


def dumps(data: dict) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
