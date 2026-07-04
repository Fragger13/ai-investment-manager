from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class UserActionEvent(Base):
    __tablename__ = "user_action_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(80), default="")
    entity_id: Mapped[str] = mapped_column(String(180), default="")
    entity_name: Mapped[str] = mapped_column(EncryptedText(fallback=""), default="")
    payload_json: Mapped[str] = mapped_column(EncryptedText(fallback="{}"), default="{}")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
