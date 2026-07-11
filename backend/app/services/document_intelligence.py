from __future__ import annotations

import csv
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree

from app.schemas.document import DocumentAnalyzeRequest


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


def _extract_pdf_text(path: Path) -> str:
    # Lightweight MVP fallback: many digital PDFs expose readable text fragments.
    raw = path.read_bytes()
    decoded = raw.decode("latin-1", errors="ignore")
    fragments = re.findall(r"\(([^()]{0,200})\)", decoded)
    return "\n".join(fragments) if fragments else decoded[:250000]


def _extract_csv_text(path: Path) -> str:
    rows = _csv_rows(path)
    structured = _structured_statement_text(rows)
    if structured is not None:
        return structured
    return "\n".join(" ".join(cell for cell in row if cell) for row in rows[:2000])


def _csv_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.reader(handle))[:2000]


# Column headers that mark transaction amounts vs. the running balance.
_AMOUNT_HEADERS = ("debit", "withdrawal", "credit", "deposit", "amount", "dr", "cr")
_BALANCE_HEADERS = ("balance", "closing")


def _structured_statement_text(rows: list[list[str]]) -> str | None:
    """Bank exports carry a running-balance column that is almost always the
    largest number on the row — naive per-line "take the biggest value"
    extraction reads the balance instead of the transaction. When a header row
    identifies amount columns, rebuild each row as description + amount only,
    so downstream keyword inference sees the right figures."""
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
    amount_columns = [
        i for i, cell in enumerate(header)
        if any(h == cell or h in cell for h in _AMOUNT_HEADERS) and not any(b in cell for b in _BALANCE_HEADERS)
    ]
    balance_columns = {i for i, cell in enumerate(header) if any(b in cell for b in _BALANCE_HEADERS)}
    if not amount_columns:
        return None
    lines: list[str] = []
    for row in rows[header_index + 1 :]:
        if not any(cell.strip() for cell in row):
            continue
        description = " ".join(
            cell for i, cell in enumerate(row) if i not in amount_columns and i not in balance_columns and cell.strip()
        )
        amounts = [row[i].strip() for i in amount_columns if i < len(row) and row[i].strip()]
        if amounts:
            lines.append(f"{description} {' '.join(amounts)}")
    return "\n".join(lines) if lines else None


def _extract_xlsx_text(path: Path) -> str:
    rows = _xlsx_rows(path)
    structured = _structured_statement_text(rows)
    if structured is not None:
        return structured
    return "\n".join(" ".join(cell for cell in row if cell) for row in rows)


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
        return _extract_csv_text(path)
    if normalized in {"xlsx", "xls"}:
        return _extract_xlsx_text(path)
    if normalized == "pdf":
        return _extract_pdf_text(path)
    return ""


def infer_financials(text: str) -> dict:
    lower = text.lower()
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


def _field(label: str, field: str, value: int | str, confidence: int, explanation: str) -> dict:
    return {
        "field": field,
        "label": label,
        "value": value,
        "confidence": confidence,
        "status": "Ready to use" if confidence >= 75 else "Needs your review",
        "explanation": explanation,
    }


# Fields each named document is allowed to fill. None means no restriction
# (backward compatible with callers that send no doc_type).
DOC_TYPE_FIELDS: dict[str, set[str]] = {
    "salary_slip": {"monthlySalary", "monthlyCashInflow"},
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


def response_from_text(file_name: str, file_type: str, text: str, document_id: int | None = None) -> dict:
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
    inferred = infer_financials(text)
    patch = inferred["profilePatch"]
    fields = [
        _field("Fixed monthly salary", "monthlySalary", patch.get("monthlySalary", 0), inferred["confidence"], "Detected from salary or income-like credits."),
        _field("Monthly expenses", "monthlyExpenses", patch.get("monthlyExpenses", 0), 72 if patch.get("monthlyExpenses") else 35, "Estimated from common expense lines such as rent, UPI, card, groceries, and food."),
        _field("Monthly EMI", "emi", patch.get("emi", 0), 80 if patch.get("emi") else 40, "Detected from EMI or loan payment labels."),
        _field("Subscriptions", "subscriptions", patch.get("subscriptions", 0), 78 if patch.get("subscriptions") else 35, "Detected from subscription-like merchant names."),
        _field("Mutual funds / investments", "mutualFundsValue", patch.get("mutualFundsValue", 0), 76 if patch.get("mutualFundsValue") else 35, "Detected from SIP, mutual fund, brokerage, or investment labels."),
    ]
    status = "completed" if inferred["confidence"] >= 50 else "completed_with_review"
    return {
        "id": document_id,
        "fileName": file_name,
        "fileType": normalized,
        "status": status,
        "summary": {
            "extractionStatus": "Ready for your review" if patch else "Needs your review",
            "confidence": inferred["confidence"],
            "detectedIncome": inferred["detectedIncome"],
            "recurringExpenses": inferred["detectedExpenses"],
            "subscriptions": inferred["subscriptions"],
            "netWorthExtracted": inferred["netWorth"],
        },
        "documents": [
            {
                "type": file_name,
                "status": "Parsed",
                "insight": f"Read {inferred['textLength']} characters and extracted likely income, expenses, investments, and recurring payments.",
            }
        ],
        "extractedCategories": inferred["categories"],
        "extractedFields": fields,
        "profilePatch": patch,
        "aiFindings": [
            "Please review extracted values before saving them to your profile.",
            "Fields marked 'Needs your review' were inferred from weak labels or limited document text.",
            "Image OCR is not enabled in this MVP; upload PDF, CSV, or XLSX for extraction.",
        ],
    }


def analyze_document(payload: DocumentAnalyzeRequest) -> dict:
    return response_from_text(payload.file_name, payload.file_type, "")


def analyze_saved_file(path: Path, file_name: str, file_type: str, document_id: int | None = None, doc_type: str | None = None) -> dict:
    text = extract_text(path, file_type)
    return _restrict_to_doc_type(response_from_text(file_name, file_type, text, document_id), doc_type)


def dumps(data: dict) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
