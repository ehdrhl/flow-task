from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, text
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
    # 만든 사용자. 계정 기능(T18) 이전에 만든 행은 NULL이며 삭제하지 않는다.
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", name="fk_tasks_user_id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utc_now,
        server_default=text("(UTC_TIMESTAMP())"),
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("CHAR_LENGTH(username) >= 3", name="ck_users_username_length"),
        {"mysql_charset": "utf8mb4"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 앱이 소문자로 바꿔 저장한다. DB 정렬 규칙(ai_ci)도 대소문자만 다른 아이디를 같게 본다.
    username: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    # 솔트가 포함된 단방향 해시 문자열만 저장한다. 비밀번호 원문은 저장하지 않는다.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utc_now,
        server_default=text("(UTC_TIMESTAMP())"),
    )


class UserSession(Base):
    __tablename__ = "sessions"
    __table_args__ = {"mysql_charset": "utf8mb4"}

    # 세션 토큰 원문은 쿠키에만 있고, DB에는 SHA-256 해시(16진수 64자)만 저장한다.
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", name="fk_sessions_user_id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=_utc_now,
        server_default=text("(UTC_TIMESTAMP())"),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)


class LoginAttempt(Base):
    """로그인 실패 횟수(F18). 아이디 원문 대신 소문자 아이디의 SHA-256 해시로 구분한다."""

    __tablename__ = "login_attempts"
    __table_args__ = {"mysql_charset": "utf8mb4"}

    username_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_failed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
