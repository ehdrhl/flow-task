"""없는 테이블(tasks, users, sessions)만 만든다. 기존 테이블과 데이터는 삭제하거나 초기화하지 않는다.
계정 기능 도입 전에 만든 tasks에는 user_id 컬럼만 비파괴로 추가한다(NULL 허용, 기존 행은 그대로).

실행: python -m backend.init_db
"""
import sys

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from backend import models  # noqa: F401  (테이블 정의를 Base에 등록한다)
from backend.database import Base, engine


def add_tasks_user_id() -> bool:
    """기존 tasks에 user_id가 없으면 컬럼·인덱스·외래 키만 추가한다. 추가했으면 True."""
    columns = {column["name"] for column in inspect(engine).get_columns("tasks")}
    if "user_id" in columns:
        return False
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE tasks ADD COLUMN user_id INT NULL, "
                "ADD INDEX ix_tasks_user_id (user_id), "
                "ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users (id)"
            )
        )
    return True


def main() -> int:
    try:
        existed = set(inspect(engine).get_table_names())
        Base.metadata.create_all(engine)  # checkfirst: 이미 있는 테이블은 건드리지 않는다.
        added = "tasks" in existed and add_tasks_user_id()  # users가 먼저 만들어진 뒤에 실행한다.
        after = inspect(engine)
    except SQLAlchemyError as error:
        # 접속 정보(비밀번호)가 출력에 섞이지 않도록 원인 메시지만 보여 준다.
        reason = getattr(error, "orig", error)
        print(f"DB 초기화에 실패했습니다: {reason}", file=sys.stderr)
        return 1

    for table in Base.metadata.sorted_tables:
        state = "이미 있어 건드리지 않음" if table.name in existed else "새로 생성"
        if table.name == "tasks" and added:
            state += " (user_id 컬럼만 추가)"
        print(f"{table.name}: {state}")
        for column in after.get_columns(table.name):
            print(f"  - {column['name']} {column['type']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
