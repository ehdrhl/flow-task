import re
import threading
from datetime import date, datetime, timezone
from typing import Annotated, Literal

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

app = FastAPI(title="Task Flow API")

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


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: str


# T06: 메모리에만 보관한다. API를 재시작하면 데이터가 사라진다.
_tasks: list[Task] = []
_next_id = 1
_lock = threading.Lock()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks() -> list[Task]:
    with _lock:
        return list(_tasks)


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate) -> Task:
    global _next_id
    with _lock:
        task = Task(
            id=_next_id,
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **payload.model_dump(),
        )
        _next_id += 1
        _tasks.append(task)
    return task
