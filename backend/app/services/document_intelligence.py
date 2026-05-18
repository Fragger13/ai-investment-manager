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


def _money_values(text: str) -> list[int]:
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
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    return "\n".join(" ".join(cell for cell in row if cell) for row in rows[:2000])


def _extract_xlsx_text(path: Path) -> str:
    values: list[str] = []
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
            for cell in root.iter():
                if not cell.tag.endswith("}c"):
                    continue
                cell_type = cell.attrib.get("t")
                value_node = next((child for child in cell if child.tag.endswith("}v")), None)
                if value_node is None or value_node.text is None:
                    continue
                if cell_type == "s":
                    index = int(value_node.text)
                    values.append(shared_strings[index] if index < len(shared_strings) else "")
                else:
                    values.append(value_node.text)
    return "\n".join(values)


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
        if any(token in line_lower for token in ["salary", "payroll", "wages", "income", "credit salary"]):
            salary_values.append(amount)
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

    if salary_values:
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


def analyze_saved_file(path: Path, file_name: str, file_type: str, document_id: int | None = None) -> dict:
    text = extract_text(path, file_type)
    return response_from_text(file_name, file_type, text, document_id)


def dumps(data: dict) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
