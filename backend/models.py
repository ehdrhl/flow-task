from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _utc_now() -> datetime:
    # created_at은 UTC로 저장한다. (시간대 정보 없이 저장하고 API에서 +00:00으로 표시한다.)
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('TODO', 'DOING', 'DONE')", name="ck_tasks_status"),
        CheckConstraint("priority IN ('HIGH', 'NORMAL', 'LOW')", name="ck_tasks_priority"),
        CheckConstraint("CHAR_LENGTH(TRIM(title)) >= 1", name="ck_tasks_title_not_blank"),
        {"mysql_charset": "utf8mb4"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="TODO", server_default="TODO")
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="NORMAL", server_default="NORMAL")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utc_now,
        server_default=text("(UTC_TIMESTAMP())"),
    )
