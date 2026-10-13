# Task Flow API 명세

PRD.md의 요구사항을 기준으로 하며, 각 엔드포인트는 PLAN.md의 해당 작업에서 구현하면서 확정한다.
기본 주소는 `http://127.0.0.1:8000`이고, 자동 문서는 `/docs`에서 확인한다.

## 공통
- 요청과 응답 본문은 JSON(UTF-8)이다.
- 입력 검증은 서버에서도 한다. 규칙을 어기면 `422`를 돌려준다.
- 로그인과 인증은 없다.

## 구현 상태
| 엔드포인트 | 작업 | 상태 |
|---|---|---|
| `GET /api/health` | T05 | 구현 |
| `GET /api/tasks`, `POST /api/tasks` | T06 | 예정 |
| `PATCH /api/tasks/{id}`, `DELETE /api/tasks/{id}` | T07 | 예정 |

## GET /api/health
서버 상태를 확인한다.

- 응답 `200`: `{"status": "ok"}`

## Task 데이터 (T06 이후)
| 필드 | 타입 | 규칙 |
|---|---|---|
| id | 정수 | 서버가 부여한다. 수정·삭제는 이 값으로 처리한다. |
| title | 문자열 | 앞뒤 공백 제거 후 1~100자 |
| description | 문자열 | 최대 2000자, 기본값 `""` |
| status | 문자열 | `TODO`, `DOING`, `DONE`, 기본값 `TODO` |
| priority | 문자열 | `HIGH`, `NORMAL`, `LOW`, 기본값 `NORMAL` |
| due_date | 문자열 또는 null | `YYYY-MM-DD`, 미지정은 `null` |
| created_at | 문자열 | 서버가 부여한 생성 시각 |

## GET /api/tasks (T06, T07)
- 응답 `200`: Task 배열
- 쿼리(T07): `q`(제목 검색), `status`, `priority`. 모두 지정하면 AND 조건이다.

## POST /api/tasks (T06)
- 요청: `title` 필수. 나머지 필드는 선택이며 생략하면 기본값을 쓴다.
- 응답 `201`: 생성된 Task
- 규칙 위반: `422`

## PATCH /api/tasks/{id} (T07)
- 요청: 바꿀 필드만 전달한다. 전달하지 않은 필드는 유지한다.
- 응답 `200`: 수정된 Task
- 없는 id: `404`, 규칙 위반: `422`

## DELETE /api/tasks/{id} (T07)
- 응답 `204`(본문 없음)
- 없는 id: `404`

## 참고
- 프런트엔드(`:5500`)와 API(`:8000`)는 출처가 달라, T08에서 연동할 때 CORS 허용이 필요하다.
- 메모리 단계(T06~T10)는 API를 재시작하면 데이터가 사라진다.
