from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import User  # noqa: F401

DEV_EMAIL = "tanishq13@gmail.com"
DEV_PASSWORD = "Test@12345"
DEV_NAME = "Tanishq Dev"


def main() -> None:
    environment = settings.environment.lower()
    if environment not in {"development", "dev", "local", "test"}:
        raise SystemExit(f"Refusing to seed dev user in environment={settings.environment!r}")
    if not settings.database_url.startswith("sqlite"):
        raise SystemExit("Refusing to seed dev user outside the local SQLite database")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEV_EMAIL).first()
        if user:
            user.name = user.name or DEV_NAME
            user.password_hash = hash_password(DEV_PASSWORD)
            message = "updated"
        else:
            db.add(User(name=DEV_NAME, email=DEV_EMAIL, password_hash=hash_password(DEV_PASSWORD)))
            message = "created"
        db.commit()
        print(f"Local dev user {message}: {DEV_EMAIL} / {DEV_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
