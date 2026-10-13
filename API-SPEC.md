# Task Flow API 명세

PRD.md의 요구사항을 기준으로 하며, 각 엔드포인트는 PLAN.md의 해당 작업에서 구현하면서 확정한다.
기본 주소는 `http://127.0.0.1:8000`이고, 자동 문서는 `/docs`에서 확인한다.

## 공통
- 요청과 응답 본문은 JSON(UTF-8)이다.
- 입력 검증은 서버에서도 한다. 규칙을 어기면 `422`를 돌려주며, 본문은 FastAPI 기본 형식(`{"detail": [...]}`)이다.
- 로그인과 인증은 없다.

## 구현 상태
| 엔드포인트 | 작업 | 상태 |
|---|---|---|
| `GET /api/health` | T05 | 구현 |
| `GET /api/tasks`, `POST /api/tasks` | T06 | 구현 |
| `PATCH /api/tasks/{id}`, `DELETE /api/tasks/{id}` | T07 | 구현 |
| `GET /api/tasks`의 `q`, `status`, `priority` 필터 | T07 | 구현 |

## GET /api/health
서버 상태를 확인한다.

- 응답 `200`: `{"status": "ok"}`

## Task 데이터
| 필드 | 타입 | 규칙 |
|---|---|---|
| id | 정수 | 서버가 부여한다. 수정·삭제는 이 값으로 처리한다. |
| title | 문자열 | 앞뒤 공백 제거 후 1~100자 |
| description | 문자열 | 최대 2000자, 기본값 `""` |
| status | 문자열 | `TODO`, `DOING`, `DONE`, 기본값 `TODO` |
| priority | 문자열 | `HIGH`, `NORMAL`, `LOW`, 기본값 `NORMAL` |
| due_date | 문자열 또는 null | `YYYY-MM-DD`, 미지정은 `null` |
| created_at | 문자열 | 서버가 부여한 생성 시각(UTC, ISO 8601, 예: `2026-10-13T06:35:12+00:00`) |

## GET /api/tasks (T06, T07)
- 응답 `200`: Task 배열(등록 순서, 없으면 `[]`)
- 쿼리(T07): 모두 선택이며, 지정한 조건을 모두 만족하는 항목만 돌려준다(AND).
  - `q`: 제목에 포함된 글자 검색(대소문자 무시, 앞뒤 공백 제거, 최대 100자). 비어 있으면 조건 없음.
  - `status`: `TODO`, `DOING`, `DONE` 중 하나
  - `priority`: `HIGH`, `NORMAL`, `LOW` 중 하나
- 허용값이 아닌 `status`, `priority`나 100자를 넘는 `q`는 `422`이다. 일치하는 항목이 없으면 `200`과 `[]`이다.

## POST /api/tasks (T06)
- 요청: `title` 필수. `description`, `status`, `priority`, `due_date`는 선택이며 생략하면 기본값을 쓴다.
  `id`, `created_at`은 서버가 정하므로 보낼 수 없다. 정의되지 않은 필드를 보내도 `422`이다.
- 응답 `201`: 생성된 Task
- 규칙 위반: `422`. 제목이 비었거나 공백뿐, 길이 초과, 형식이 다른 값(`status`, `priority` 오타, 존재하지 않는 날짜, `YYYY-MM-DD`가 아닌 날짜), 잘못된 JSON, 본문 없음을 포함한다. 위반한 요청은 저장하지 않는다.
- `title`과 `description`은 앞뒤 공백을 제거해 저장한다. 값은 글자 그대로 저장하며 HTML로 해석하지 않는다.

## PATCH /api/tasks/{id} (T07)
- 요청: 바꿀 수 있는 필드는 `title`, `description`, `status`, `priority`, `due_date`이다. 바꿀 필드만 전달하고, 전달하지 않은 필드는 유지한다. 값 규칙은 POST와 같다.
  - `due_date`에 `null`을 보내면 마감일을 지운다. 나머지 필드는 `null`로 바꿀 수 없다(`422`).
  - 빈 본문 `{}`은 아무것도 바꾸지 않고 `200`으로 현재 Task를 돌려준다.
  - `id`, `created_at`은 바꿀 수 없다(`422`).
- 응답 `200`: 수정된 Task
- 없는 id: `404`, 규칙 위반이나 숫자가 아닌 id: `422`. 규칙을 어긴 요청은 Task를 바꾸지 않는다.
- 본문이 규칙을 어기면 id 존재 여부와 관계없이 `422`가 먼저이다.

## DELETE /api/tasks/{id} (T07)
- 응답 `204`(본문 없음)
- 없는 id(이미 삭제한 id 포함): `404`, 숫자가 아닌 id: `422`
- 삭제한 id는 다시 쓰지 않는다. 이후 등록한 Task는 새 id를 받는다.

## 참고
- 프런트엔드(`:5500`)와 API(`:8000`)는 출처가 달라, T08에서 연동할 때 CORS 허용이 필요하다.
- 메모리 단계(T06~T10)는 API를 재시작하면 데이터가 사라진다.
