from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.assets.asset_intelligence_service import (
    alpha_opportunities,
    asset_detail,
    asset_research,
    crypto_opportunities,
    fundamental_signals,
    refresh_asset_intelligence,
    technical_signals,
)
from app.services.llm.background_enhancement_service import hydrate_and_schedule_assets

router = APIRouter()


@router.post("/refresh-research")
def refresh_research(db: Session = Depends(get_db)) -> dict:
    return refresh_asset_intelligence(db)


@router.get("/research")
def research(db: Session = Depends(get_db)) -> list[dict]:
    return hydrate_and_schedule_assets(asset_research(db))


@router.get("/alpha-opportunities")
def alpha(db: Session = Depends(get_db)) -> list[dict]:
    return alpha_opportunities(db)


@router.get("/crypto-opportunities")
def crypto(db: Session = Depends(get_db)) -> list[dict]:
    return crypto_opportunities(db)


@router.get("/technical-signals")
def technical(db: Session = Depends(get_db)) -> list[dict]:
    return technical_signals(db)


@router.get("/fundamental-signals")
def fundamental(db: Session = Depends(get_db)) -> list[dict]:
    return fundamental_signals(db)


@router.post("/refresh-copy")
def refresh_all_copy(db: Session = Depends(get_db)) -> list[dict]:
    return hydrate_and_schedule_assets(asset_research(db), force=True)


@router.get("/{symbol}/research")
def detail(symbol: str, db: Session = Depends(get_db)) -> dict:
    row = asset_detail(db, symbol)
    if not row:
        raise HTTPException(status_code=404, detail="Asset research not found")
    return hydrate_and_schedule_assets([row])[0]


@router.post("/{symbol}/refresh-copy")
def refresh_copy(symbol: str, db: Session = Depends(get_db)) -> dict:
    row = asset_detail(db, symbol)
    if not row:
        raise HTTPException(status_code=404, detail="Asset research not found")
    return hydrate_and_schedule_assets([row], force=True)[0]
