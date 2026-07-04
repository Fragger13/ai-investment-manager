from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_type: Mapped[str] = mapped_column(String(80))
    extraction_status: Mapped[str] = mapped_column(String(80), default="queued")
    parsed_data: Mapped[str] = mapped_column(EncryptedText(fallback="{}"), default="{}")
