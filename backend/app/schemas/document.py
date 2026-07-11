from typing import Any

from pydantic import BaseModel


class DocumentAnalyzeRequest(BaseModel):
    file_name: str
    file_type: str


class ExtractedField(BaseModel):
    field: str
    label: str
    value: int | str
    confidence: int
    status: str
    explanation: str


class DocumentSummary(BaseModel):
    extractionStatus: str
    confidence: int
    detectedIncome: int
    recurringExpenses: int
    subscriptions: int
    netWorthExtracted: int


class DocumentItem(BaseModel):
    type: str
    status: str
    insight: str


class ExtractedCategory(BaseModel):
    name: str
    value: int


class EmiBreakdownItem(BaseModel):
    name: str
    amount: int
    occurrences: int = 1


class StatementInsights(BaseModel):
    periodStart: str = ""
    periodEnd: str = ""
    periodDays: int = 0
    periodLabel: str = ""  # "12 days" | "about 3 months"
    totalMonthlySpend: int = 0  # all debits, normalised to one month
    emiBreakdown: list[EmiBreakdownItem] = []


class DocumentAnalysisResponse(BaseModel):
    id: int | None = None
    fileName: str = ""
    fileType: str = ""
    status: str = "completed"
    summary: DocumentSummary
    documents: list[DocumentItem]
    extractedCategories: list[ExtractedCategory]
    extractedFields: list[ExtractedField] = []
    profilePatch: dict[str, Any] = {}
    aiFindings: list[str]
    statement: StatementInsights | None = None
