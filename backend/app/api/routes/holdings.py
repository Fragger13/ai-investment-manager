from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.financial import Holding
from app.services.holdings.import_service import parse_holdings_file
from app.services.holdings.pricing_service import quote_unit_price, refresh_prices

router = APIRouter()

ALLOWED_TYPES = {
    "text/csv": "csv",
    "application/vnd.ms-excel": "xlsx",  # some browsers report xlsx as ms-excel
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
}


class ImportHoldingsResponse(BaseModel):
    holdings: list[Holding]
    unmappedRows: int = 0
    warnings: list[str] = []


class RefreshPricesRequest(BaseModel):
    holdings: list[Holding]


class RefreshPricesResponse(BaseModel):
    holdings: list[Holding]
    refreshedAt: str


@router.post("/import", response_model=ImportHoldingsResponse)
async def import_holdings(file: UploadFile = File(...)) -> ImportHoldingsResponse:
    suffix = Path(file.filename or "").suffix.lower().lstrip(".")
    inferred = ALLOWED_TYPES.get(file.content_type or "", suffix)
    if inferred not in {"csv", "xlsx"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload an XLSX or CSV portfolio statement.",
        )

    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File must be under {settings.max_upload_mb} MB.",
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = upload_dir / f"holdings-{uuid4().hex}.{inferred}"
    tmp_path.write_bytes(content)

    try:
        result = parse_holdings_file(tmp_path, inferred)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass

    return ImportHoldingsResponse(
        holdings=result.holdings,
        unmappedRows=result.unmapped_rows,
        warnings=result.warnings,
    )


@router.post("/refresh-prices", response_model=RefreshPricesResponse)
def refresh_holding_prices(payload: RefreshPricesRequest) -> RefreshPricesResponse:
    from app.services.intelligence import now_iso

    updated = refresh_prices(payload.holdings)
    return RefreshPricesResponse(holdings=updated, refreshedAt=now_iso())


class QuoteResponse(BaseModel):
    symbol: str
    assetClass: str
    price: float | None = None
    asOf: str = ""


@router.get("/quote", response_model=QuoteResponse)
def quote(symbol: str = "", assetClass: str = "") -> QuoteResponse:
    """Live per-unit price for one instrument — backs the Take Action popup's
    default purchase price. Returns price=null (not an error) when unavailable."""
    from app.services.intelligence import now_iso

    price = quote_unit_price(symbol, assetClass)
    return QuoteResponse(symbol=symbol, assetClass=assetClass, price=price, asOf=now_iso() if price else "")
