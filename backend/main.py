import re
from collections.abc import Iterator
from datetime import date, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal

app = FastAPI(title="Task Flow API")

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


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, error: OperationalError) -> JSONResponse:
    # 접속 정보가 응답에 섞이지 않도록 내용 없이 상태만 알린다.
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


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


# 화면(frontend/)도 같은 포트에서 제공한다. 반드시 API 경로를 모두 등록한 뒤 마지막에 연결한다.
# (정적 서버 :5500을 따로 띄워도 계속 동작한다. 최종 배포(T14)에서는 Nginx가 이 역할을 맡는다.)
app.mount(
    "/",
    StaticFiles(directory=Path(__file__).resolve().parent.parent / "frontend", html=True),
    name="frontend",
)
