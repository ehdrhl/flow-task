import logging
import math
import os
import re
from collections.abc import Iterator
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)
from sqlalchemy import case, delete, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, engine
from backend.security import (
    DUMMY_HASH,
    hash_password,
    hash_token,
    hash_username,
    new_session_token,
    verify_password,
)

app = FastAPI(title="Task Flow API")

SESSION_COOKIE = "task_flow_session"
SESSION_LIFETIME = timedelta(days=7)
# 로그인 실패 제한(F18): 5회 연속 실패하면 마지막 실패로부터 5분 동안 거절하고, 5분이 지나면 횟수를 잊는다.
MAX_FAILED_LOGINS = 5
LOGIN_LOCK = timedelta(minutes=5)
# HTTPS로 배포할 때만 true로 둔다. 현재 HTTP 학습 환경에서는 기본값 false이다(.env.example 참고).
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").strip().lower() == "true"

# 개발 단계에서는 프런트엔드(:5500)와 API(:8000)의 출처가 달라 브라우저가 CORS 허용을 요구한다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Status = Literal["TODO", "DOING", "DONE"]
Priority = Literal["HIGH", "NORMAL", "LOW"]


def _is_valid_date(value: str) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description = ""
    status: Status = "TODO"
    priority: Priority = "NORMAL"
    due_date: str | None = None

    @field_validator("due_date")
    @classmethod
    def check_due_date(cls, value: str | None) -> str | None:
        if value is not None and not _is_valid_date(value):
            raise ValueError("due_date는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.")
        return value


class TaskUpdate(BaseModel):
    """바꿀 필드만 전달한다. 전달하지 않은 필드는 그대로 둔다."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: Description | None = None
    status: Status | None = None
    priority: Priority | None = None
    due_date: str | None = None  # null을 보내면 마감일을 지운다.

    @field_validator("due_date")
    @classmethod
    def check_due_date(cls, value: str | None) -> str | None:
        if value is not None and not _is_valid_date(value):
            raise ValueError("due_date는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.")
        return value

    @model_validator(mode="after")
    def reject_null_for_required_fields(self) -> "TaskUpdate":
        for name in ("title", "description", "status", "priority"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name}은(는) null로 바꿀 수 없습니다.")
        return self


# 아이디: 영문 대소문자·숫자·밑줄 3~20자. 저장할 때 소문자로 바꾼다.
Username = Annotated[
    str, StringConstraints(min_length=3, max_length=20, pattern=r"^[A-Za-z0-9_]+$")
]
# 비밀번호: 8~20자. 앞뒤 공백을 제거하지 않는다.
Password = Annotated[str, StringConstraints(min_length=8, max_length=20)]


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username
    password: Password
    password_confirm: str

    @model_validator(mode="after")
    def check_password_confirm(self) -> "SignupRequest":
        if self.password != self.password_confirm:
            raise ValueError("password와 password_confirm이 다릅니다.")
        return self


class LoginRequest(BaseModel):
    # 형식 검사는 하지 않는다. 형식이 맞지 않는 값도 "아이디 또는 비밀번호 오류"와 같게 응답한다.
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: str


def to_api(row: models.Task) -> Task:
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        due_date=row.due_date.isoformat() if row.due_date is not None else None,
        # DB에는 UTC로 저장하므로 API에서는 +00:00을 붙여 돌려준다.
        created_at=row.created_at.replace(tzinfo=timezone.utc).isoformat(timespec="seconds"),
    )


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def _utc_now() -> datetime:
    # DB에는 시간대 없는 UTC로 저장한다.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> models.User:
    """쿠키의 세션 토큰으로 로그인한 사용자를 찾는다. 없거나 만료되면 401이다."""
    token = request.cookies.get(SESSION_COOKIE)
    user = None
    if token:
        user = db.scalar(
            select(models.User)
            .join(models.UserSession, models.UserSession.user_id == models.User.id)
            .where(
                models.UserSession.token_hash == hash_token(token),
                models.UserSession.expires_at > _utc_now(),
            )
        )
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


CurrentUser = Annotated[models.User, Depends(get_current_user)]


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, error: OperationalError) -> JSONResponse:
    # 원인 파악을 위해 MariaDB 오류 번호만 로그에 남긴다(메시지에는 접속 정보가 있을 수 있어 남기지 않는다).
    code = getattr(error.orig, "args", ("?",))[0]
    logging.getLogger("uvicorn.error").warning("DB 오류 %s %s code=%s", request.method, request.url.path, code)
    # 접속 정보가 응답에 섞이지 않도록 내용 없이 상태만 알린다.
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    # 인증 API의 422에는 입력값(비밀번호)이 응답에 되돌아가지 않도록 input·ctx를 뺀다.
    # 그 밖의 경로는 FastAPI 기본 형식 그대로이다.
    if request.url.path.startswith("/api/auth/"):
        detail = [
            {key: value for key, value in item.items() if key not in ("input", "ctx")}
            for item in error.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": detail})
    return await request_validation_exception_handler(request, error)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Status | None = None,
    priority: Priority | None = None,
) -> list[Task]:
    # 제목 검색, 상태, 우선순위는 지정한 조건을 모두 만족하는(AND) 항목만 돌려준다.
    statement = select(models.Task).order_by(models.Task.id)
    keyword = (q or "").strip()
    if keyword:
        # 대소문자 구분 없이 부분 일치(DB 정렬 규칙을 따른다). %, _는 글자로 취급한다.
        statement = statement.where(models.Task.title.contains(keyword, autoescape=True))
    if status is not None:
        statement = statement.where(models.Task.status == status)
    if priority is not None:
        statement = statement.where(models.Task.priority == priority)
    return [to_api(row) for row in db.scalars(statement)]


def _db_values(values: dict) -> dict:
    # API의 due_date(YYYY-MM-DD 문자열)를 DB의 DATE 값으로 바꾼다.
    if values.get("due_date") is not None:
        values = {**values, "due_date": date.fromisoformat(values["due_date"])}
    return values


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate, db: Annotated[Session, Depends(get_db)]) -> Task:
    row = models.Task(**_db_values(payload.model_dump()))
    db.add(row)
    db.commit()
    return to_api(row)


def _get_or_404(db: Session, task_id: int) -> models.Task:
    row = db.get(models.Task, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return row


@app.patch("/api/tasks/{task_id}")
def update_task(
    task_id: int, payload: TaskUpdate, db: Annotated[Session, Depends(get_db)]
) -> Task:
    row = _get_or_404(db, task_id)
    for name, value in _db_values(payload.model_dump(exclude_unset=True)).items():
        setattr(row, name, value)
    db.commit()
    return to_api(row)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    db.delete(_get_or_404(db, task_id))
    db.commit()
    return Response(status_code=204)


@app.post("/api/auth/signup", status_code=201)
def signup(payload: SignupRequest, db: Annotated[Session, Depends(get_db)]) -> UserInfo:
    username = payload.username.lower()
    taken = HTTPException(status_code=409, detail="Username already taken")
    if db.scalar(select(models.User.id).where(models.User.username == username)) is not None:
        raise taken
    row = models.User(username=username, password_hash=hash_password(payload.password))
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # 동시에 같은 아이디로 가입한 경우(고유 제약)도 중복으로 응답한다.
        db.rollback()
        raise taken
    return UserInfo(id=row.id, username=row.username)


def _record_failed_login(db: Session, key: str, now: datetime) -> None:
    """실패 횟수를 1 늘린다. 마지막 실패로부터 5분이 지났으면 1부터 다시 센다."""
    cutoff = now - LOGIN_LOCK
    statement = mysql_insert(models.LoginAttempt).values(
        username_key=key, failed_count=1, last_failed_at=now
    )
    # 한 문장으로 처리해 동시에 실패해도 횟수가 어긋나지 않는다. 순서가 중요하다:
    # failed_count를 먼저 계산해야 아직 바뀌지 않은 last_failed_at을 볼 수 있다.
    statement = statement.on_duplicate_key_update(
        failed_count=case(
            (models.LoginAttempt.last_failed_at <= cutoff, 1),
            else_=models.LoginAttempt.failed_count + 1,
        ),
        last_failed_at=now,
    )
    # 같은 키를 동시에 처음 넣으면 잠금 충돌(1213·1205)이나 스냅샷 충돌(1020)이 날 수 있어 새 트랜잭션으로 짧게 재시도한다.
    for attempt in range(3):
        try:
            db.execute(statement)
            db.commit()
            break
        except OperationalError as error:
            db.rollback()
            if getattr(error.orig, "args", (0,))[0] not in (1213, 1205, 1020) or attempt == 2:
                raise
    _purge_old_attempts(cutoff)


def _purge_old_attempts(cutoff: datetime) -> None:
    """오래된 기록을 지워 표가 계속 커지지 않게 한다. 실패해도 로그인 처리에는 영향이 없다.

    범위 삭제가 다른 요청의 INSERT와 잠금 충돌하지 않도록 별도 트랜잭션에서
    READ COMMITTED로 실행한다.
    """
    try:
        with engine.execution_options(isolation_level="READ COMMITTED").begin() as connection:
            connection.execute(
                delete(models.LoginAttempt).where(models.LoginAttempt.last_failed_at <= cutoff)
            )
    except SQLAlchemyError:
        pass


@app.post("/api/auth/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> UserInfo:
    now = _utc_now()
    key = hash_username(payload.username)
    attempt = db.get(models.LoginAttempt, key)
    if (
        attempt is not None
        and attempt.failed_count >= MAX_FAILED_LOGINS
        and attempt.last_failed_at > now - LOGIN_LOCK
    ):
        # 제한 중에는 비밀번호를 검사하지 않고(올바른 비밀번호도 거절), 횟수와 제한 시간은 늘리지 않는다.
        remaining = (attempt.last_failed_at + LOGIN_LOCK - now).total_seconds()
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts",
            headers={"Retry-After": str(max(1, math.ceil(remaining)))},
        )

    user = None
    if len(payload.username) <= 20 and len(payload.password) <= 20:
        user = db.scalar(
            select(models.User).where(models.User.username == payload.username.lower())
        )
    # 읽기 트랜잭션을 여기서 끝낸다. MariaDB는 읽은 뒤 다른 요청이 바꾼 행을 갱신하면 오류(1020)를
    # 내므로, 느린 해시 검증 동안 낡은 스냅샷을 들고 있지 않게 하고 연결도 돌려준다.
    db.commit()
    # 없는 아이디·형식 불일치도 해시 검증을 한 번 해서 처리 시간을 비슷하게 맞춘다.
    matched = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if user is None or not matched:
        _record_failed_login(db, key, now)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # 성공하면 실패 횟수를 0으로 되돌린다.
    db.execute(delete(models.LoginAttempt).where(models.LoginAttempt.username_key == key))
    # 요청에 실린 기존 세션과 만료된 세션을 정리한 뒤 새 세션을 만든다.
    old_token = request.cookies.get(SESSION_COOKIE)
    if old_token:
        db.execute(
            delete(models.UserSession).where(models.UserSession.token_hash == hash_token(old_token))
        )
    db.execute(delete(models.UserSession).where(models.UserSession.expires_at <= now))
    token = new_session_token()
    db.add(
        models.UserSession(
            token_hash=hash_token(token), user_id=user.id, expires_at=now + SESSION_LIFETIME
        )
    )
    db.commit()

    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    response.headers["Cache-Control"] = "no-store"
    return UserInfo(id=user.id, username=user.username)


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, db: Annotated[Session, Depends(get_db)]) -> Response:
    # 유효한 세션이 없어도 204이다(여러 번 호출해도 같다).
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(
            delete(models.UserSession).where(models.UserSession.token_hash == hash_token(token))
        )
        db.commit()
    response = Response(status_code=204)
    response.delete_cookie(
        SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=COOKIE_SECURE
    )
    return response


@app.get("/api/auth/me")
def me(user: CurrentUser, response: Response) -> UserInfo:
    response.headers["Cache-Control"] = "no-store"
    return UserInfo(id=user.id, username=user.username)
