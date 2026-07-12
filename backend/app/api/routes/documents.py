from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.data_encryption import bind_key, encrypt_file_bytes
from app.core.database import get_db
from app.core.security import user_from_bearer
from app.models.uploaded_document import UploadedDocument
from app.schemas.document import DocumentAnalysisResponse, DocumentAnalyzeRequest
from app.services.document_intelligence import PdfPasswordRequired, analyze_document, analyze_saved_file, dumps

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}


@router.post("/analyze", response_model=DocumentAnalysisResponse)
def analyze(payload: DocumentAnalyzeRequest) -> dict:
    return analyze_document(payload)


@router.post("/upload", response_model=DocumentAnalysisResponse)
async def upload_document(
    file: UploadFile = File(...),
    # Which document the user says this is (salary_slip, bank_statement,
    # credit_card, loan_statement, portfolio). Restricts which profile fields
    # the extraction may fill, so a salary slip can't overwrite expenses.
    doc_type: str | None = Form(default=None),
    # Banks send statement PDFs encrypted; the user supplies the password
    # (used in memory for this one analysis, never stored).
    pdf_password: str | None = Form(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower().lstrip(".")
    inferred_type = ALLOWED_TYPES.get(file.content_type or "", suffix)
    if inferred_type not in {"pdf", "csv", "xlsx", "xls"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a PDF, CSV, or XLSX file. Image OCR is coming soon.",
        )

    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File must be under {settings.max_upload_mb} MB.")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4().hex}.{inferred_type}"
    path = upload_dir / safe_name
    path.write_bytes(content)

    user = user_from_bearer(authorization, db)
    record = UploadedDocument(
        user_id=user.id if user else None,
        file_type=inferred_type,
        extraction_status="processing",
        parsed_data="{}",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        analysis = analyze_saved_file(
            path, file.filename or safe_name, inferred_type, record.id, doc_type=doc_type, pdf_password=pdf_password
        )
        record.extraction_status = analysis["status"]
        record.parsed_data = dumps(analysis)
        db.commit()
        return analysis
    except PdfPasswordRequired:
        # Machine-readable: the client shows a password prompt and retries.
        record.extraction_status = "password_required"
        record.parsed_data = json.dumps({"error": "pdf_password_required"})
        db.commit()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="pdf_password_required")
    except Exception as exc:
        record.extraction_status = "failed"
        record.parsed_data = json.dumps({"error": str(exc)})
        db.commit()
        raise HTTPException(status_code=500, detail="Document parsing failed. Please check the file and try again.") from exc
    finally:
        # The statement/portfolio file itself is financial data: once analysis
        # is done, what stays on disk is ciphered under the session's key.
        key = bind_key()
        if key is not None:
            try:
                path.write_bytes(encrypt_file_bytes(content, key))
            except OSError:
                path.unlink(missing_ok=True)
