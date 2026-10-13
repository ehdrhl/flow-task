"""tasks 테이블이 없을 때만 만든다. 기존 테이블과 데이터는 변경하거나 삭제하지 않는다.

실행: python -m backend.init_db
"""
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from backend import models  # noqa: F401  (테이블 정의를 Base에 등록한다)
from backend.database import Base, engine


def main() -> int:
    try:
        existed = set(inspect(engine).get_table_names())
        Base.metadata.create_all(engine)  # checkfirst: 이미 있는 테이블은 건드리지 않는다.
        after = inspect(engine)
    except SQLAlchemyError as error:
        # 접속 정보(비밀번호)가 출력에 섞이지 않도록 원인 메시지만 보여 준다.
        reason = getattr(error, "orig", error)
        print(f"DB 초기화에 실패했습니다: {reason}", file=sys.stderr)
        return 1

    for table in Base.metadata.sorted_tables:
        state = "이미 있어 건드리지 않음" if table.name in existed else "새로 생성"
        print(f"{table.name}: {state}")
        for column in after.get_columns(table.name):
            print(f"  - {column['name']} {column['type']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
