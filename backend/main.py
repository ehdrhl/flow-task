import re
import threading
from datetime import date, datetime, timezone
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)

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


# T06: 메모리에만 보관한다. API를 재시작하면 데이터가 사라진다.
_tasks: list[Task] = []
_next_id = 1
_lock = threading.Lock()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: Status | None = None,
    priority: Priority | None = None,
) -> list[Task]:
    # 제목 검색, 상태, 우선순위는 지정한 조건을 모두 만족하는(AND) 항목만 돌려준다.
    keyword = (q or "").strip().lower()
    with _lock:
        return [
            task
            for task in _tasks
            if (keyword == "" or keyword in task.title.lower())
            and (status is None or task.status == status)
            and (priority is None or task.priority == priority)
        ]


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


def _find_index(task_id: int) -> int:
    for index, task in enumerate(_tasks):
        if task.id == task_id:
            return index
    raise HTTPException(status_code=404, detail="Task not found")


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    changes = payload.model_dump(exclude_unset=True)
    with _lock:
        index = _find_index(task_id)
        task = _tasks[index].model_copy(update=changes)
        _tasks[index] = task
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int) -> Response:
    with _lock:
        del _tasks[_find_index(task_id)]
    return Response(status_code=204)
