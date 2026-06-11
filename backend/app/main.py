import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.services.app_health import app_health_snapshot
from app.services.llm.background_enhancement_service import shutdown_background_enhancements
from app.services.llm_usage import is_dev_environment, llm_usage_snapshot
from app import models  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Investment Manager API", version="0.1.0")
logger = logging.getLogger("uvicorn.error")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
def log_llm_usage() -> None:
    usage = llm_usage_snapshot()
    logger.info("LLM provider: %s", usage["provider"])
    logger.info("LLM model: %s", usage["model"])
    logger.info("AI mode: %s", usage["aiMode"])


@app.on_event("shutdown")
def stop_background_llm_work() -> None:
    shutdown_background_enhancements()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/debug/llm-usage")
def debug_llm_usage() -> dict:
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    return llm_usage_snapshot()


@app.get("/debug/app-health")
def debug_app_health() -> dict:
    if not is_dev_environment():
        raise HTTPException(status_code=404, detail="Not found")
    db = SessionLocal()
    try:
        return app_health_snapshot(db)
    finally:
        db.close()
