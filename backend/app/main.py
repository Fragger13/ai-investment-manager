import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.data_encryption import EncryptionContextMiddleware
from app.core.database import Base, SessionLocal, engine
from app.services.app_health import app_health_snapshot
from app.services.llm.background_enhancement_service import shutdown_background_enhancements
from app.services.llm_usage import is_dev_environment, llm_usage_snapshot
from app import models  # noqa: F401

Base.metadata.create_all(bind=engine)


def _ensure_sqlite_columns() -> None:
    """Additive column migration for SQLite (this project has no Alembic).
    ``create_all`` makes new tables but never alters existing ones, so columns
    added after a table's first creation are applied here, idempotently."""
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    additions = {
        "asset_research": [("return_factors_json", "TEXT DEFAULT '{}'")],
        "users": [
            ("dek_wrapped", "TEXT DEFAULT ''"),
            ("dek_salt", "TEXT DEFAULT ''"),
            ("dek_wrapped_recovery", "TEXT DEFAULT ''"),
        ],
        "pending_registrations": [
            ("dek_wrapped_password", "TEXT DEFAULT ''"),
            ("dek_salt", "TEXT DEFAULT ''"),
            ("dek_wrapped_server", "TEXT DEFAULT ''"),
        ],
    }
    inspector = inspect(engine)
    for table, columns in additions.items():
        try:
            existing = {col["name"] for col in inspector.get_columns(table)}
        except Exception:  # noqa: BLE001 — table may not exist yet; create_all handles it
            continue
        for name, ddl in columns:
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


_ensure_sqlite_columns()


def _encrypt_legacy_data_at_rest() -> None:
    """Cipher any plaintext financial data left from before at-rest
    encryption — table rows and uploaded files — under the guest key."""
    from app.services.data_key_migration import sweep_plaintext_to_guest_key, sweep_plaintext_upload_files

    sweep_plaintext_to_guest_key(engine)
    sweep_plaintext_upload_files()


_encrypt_legacy_data_at_rest()

app = FastAPI(title="AI Investment Manager API", version="0.1.0")
logger = logging.getLogger("uvicorn.error")

# Innermost middleware: pins each request's data-encryption scope from the
# bearer token so the ORM encrypts/decrypts user rows with the right key.
app.add_middleware(EncryptionContextMiddleware)

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
