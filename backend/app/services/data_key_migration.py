"""One-time re-encryption of a user's plaintext rows under their new DEK.

Accounts created before at-rest encryption have readable financial rows. The
first login after the feature ships generates their data key (the password is
in hand only then), and this pass rewrites every row attributable to them so
the ciphertext lands in the database. Rows without a user_id (old onboarding
saves stamped none) cannot be attributed and are left as they are.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session, attributes

from app.core.data_encryption import use_key
from app.models.behavioral_snapshot import BehavioralSnapshot
from app.models.drift_alert import DriftAlert
from app.models.financial_memory_event import FinancialMemoryEvent
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.goal_snapshot import GoalSnapshot
from app.models.portfolio import Portfolio
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.recommendation import RecommendationRecord
from app.models.recommendation_version import RecommendationVersion
from app.models.uploaded_document import UploadedDocument
from app.models.user import User
from app.models.user_action_event import UserActionEvent

logger = logging.getLogger("uvicorn.error")

_ENCRYPTED_COLUMNS: list[tuple[type, list[str]]] = [
    (FinancialProfile, ["payload_json"]),
    (Goal, ["name", "target_amount", "current_progress"]),
    (Portfolio, ["allocations", "performance"]),
    (FinancialMemoryEvent, ["title", "summary", "payload_json"]),
    (BehavioralSnapshot, ["snapshot_json"]),
    (UserActionEvent, ["entity_name", "payload_json"]),
    (GoalSnapshot, ["goals_json", "highest_priority_goal", "total_funding_gap"]),
    (PortfolioSnapshot, ["snapshot_json", "total_value"]),
    (DriftAlert, ["title", "summary", "recommendation", "current_value", "target_value", "payload_json"]),
    (RecommendationRecord, ["recommendation_data"]),
    (RecommendationVersion, ["recommendation_json"]),
    (UploadedDocument, ["parsed_data"]),
]

# Tables swept to the guest key at startup. Includes the per-user set (rows
# whose owners have not logged in since encryption shipped) plus tables with
# no user attribution at all.
_SWEEP_COLUMNS: list[tuple[str, list[str]]] = [
    (model.__tablename__, columns) for model, columns in _ENCRYPTED_COLUMNS
] + [
    ("activity_records", ["payload_json"]),
    ("llm_enhancement_records", ["payload_json"]),
]


def migrate_user_rows_to_encrypted(db: Session, user: User, dek: bytes) -> int:
    """Rewrites the user's rows through the encrypted column types. Loading
    inside the key context passes legacy plaintext through (and opens any
    guest-keyed rows); flag_modified then forces a rewrite, which the bind
    side encrypts under the user's key at commit."""
    rewritten = 0
    with use_key(dek):
        for model, columns in _ENCRYPTED_COLUMNS:
            rows = db.query(model).filter(model.user_id == user.id).all()
            for row in rows:
                for column in columns:
                    value = getattr(row, column)
                    if value is None:
                        continue
                    attributes.flag_modified(row, column)
                rewritten += 1
        db.commit()
    if rewritten:
        logger.info("[encryption] migrated %s rows to encrypted storage for user id=%s", rewritten, user.id)
    return rewritten


def sweep_plaintext_to_guest_key(engine) -> int:
    """Startup pass over the protected columns:
    * plaintext (rows from before encryption, or written by legacy sessions)
      is ciphered under the server guest key, so the database file itself
      holds no readable financial data;
    * ciphertext under a retired guest secret is rekeyed to the current one,
      so rotating data_encryption_secret never orphans rows.
    Rows under a user's personal key are untouched. Idempotent."""
    from sqlalchemy import text

    from app.core.data_encryption import decrypt_text, encrypt_text, guest_key, is_encrypted_text, legacy_guest_keys

    key = guest_key()
    old_keys = legacy_guest_keys()
    swept = rekeyed = 0
    with engine.begin() as conn:
        for table, columns in _SWEEP_COLUMNS:
            try:
                rows = conn.execute(text(f"SELECT id, {', '.join(columns)} FROM {table}")).all()
            except Exception:  # noqa: BLE001 — table may not exist yet
                continue
            for row in rows:
                updates = {}
                for index, column in enumerate(columns, start=1):
                    value = row[index]
                    if value is None:
                        continue
                    value = value if isinstance(value, str) else str(value)
                    if not value:
                        continue
                    if not is_encrypted_text(value):
                        updates[column] = encrypt_text(value, key)
                        swept += 1
                        continue
                    if decrypt_text(value, key) is not None:
                        continue  # already under the current guest key
                    for old_key in old_keys:
                        plain = decrypt_text(value, old_key)
                        if plain is not None:
                            updates[column] = encrypt_text(plain, key)
                            rekeyed += 1
                            break
                    # no key matched: a user-keyed row — leave it alone
                if updates:
                    assignments = ", ".join(f"{column} = :{column}" for column in updates)
                    conn.execute(text(f"UPDATE {table} SET {assignments} WHERE id = :row_id"), {**updates, "row_id": row[0]})
    if swept:
        logger.info("[encryption] swept %s legacy plaintext values under the guest key", swept)
    if rekeyed:
        logger.info("[encryption] rekeyed %s values from a retired guest secret", rekeyed)
    return swept + rekeyed


def sweep_plaintext_upload_files() -> int:
    """Encrypt plaintext files in the uploads folder; rekey files ciphered
    under a retired guest secret."""
    from pathlib import Path

    from app.core.config import settings
    from app.core.data_encryption import (
        FILE_MAGIC,
        decrypt_file_bytes,
        encrypt_file_bytes,
        guest_key,
        legacy_guest_keys,
    )

    upload_dir = Path(settings.upload_dir)
    if not upload_dir.is_dir():
        return 0
    rewritten = 0
    for path in upload_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".pdf", ".csv", ".xlsx", ".xls"}:
            continue
        try:
            data = path.read_bytes()
            if not data.startswith(FILE_MAGIC):
                path.write_bytes(encrypt_file_bytes(data, guest_key()))
                rewritten += 1
                continue
            if decrypt_file_bytes(data, guest_key()) is not None:
                continue
            for old_key in legacy_guest_keys():
                plain = decrypt_file_bytes(data, old_key)
                if plain is not None:
                    path.write_bytes(encrypt_file_bytes(plain, guest_key()))
                    rewritten += 1
                    break
        except OSError:
            continue
    if rewritten:
        logger.info("[encryption] encrypted or rekeyed %s uploaded files", rewritten)
    return rewritten
