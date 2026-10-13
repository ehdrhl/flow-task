# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  결과: 변경 파일 frontend/index.html, styles.css, app.js. python3 -m http.server 5500으로 세 파일 HTTP 200 확인.
  Node DOM 목 테스트로 두 항목 등록, 빈 제목·공백·101자 거절, 100자 허용, HTML 글자 표시 통과. 사용자가 브라우저(http://127.0.0.1:5500)에서 정상 동작을 확인했다.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  결과: 변경 파일 frontend/app.js. Node DOM·localStorage 목 테스트 15건 통과(저장·복원, 복원 후 id 중복 없음, 깨진 JSON·배열 아님·제목 누락·id 중복 저장값에서 경고 표시와 저장값 보존, 저장소 접근 오류). T01 회귀 9건 통과. 사용자가 브라우저에서 새로고침 후 유지와 손상 저장값 보존을 확인했다.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  결과: 변경 파일 frontend/app.js, styles.css. 상태(TODO/DOING/DONE) 선택, 제목 수정(인라인), 삭제 confirm 구현. 모든 변경은 id로 처리한다. T02에서 저장된 status 없는 항목은 TODO로 복원한다.
  Node DOM·localStorage 목 테스트 18건 통과(상태 변경 시 다른 항목 불변, 빈·101자 제목 수정 거절, 수정 취소, 삭제 취소 시 유지, 삭제 후 id 기준 수정, 잘못된 status 저장값 보존). T01 9건·T02 15건 회귀 통과. 사용자가 브라우저에서 상태 변경, 수정, 삭제 취소·확정, 새로고침 후 유지를 확인했다.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  결과: 변경 파일 frontend/index.html, styles.css, app.js. 설명(최대 2000자)·우선순위(HIGH/NORMAL/LOW, 기본 NORMAL)·마감일(YYYY-MM-DD, 미지정 null) 등록·수정, 제목 검색과 상태·우선순위 필터(AND), 로컬 날짜 기준 지연 표시(DONE 제외) 구현. T02·T03 저장 항목은 새 필드를 기본값으로 채워 복원한다.
  Node DOM·localStorage 목 테스트 37건 통과(어제 마감 TODO·DOING 지연, DONE·오늘·내일·무기한은 지연 아님, 필터 AND 조합, 필터 중 수정·삭제가 보이는 항목의 id에만 적용, 잘못된 날짜·길이·우선순위 거절, 잘못된 저장값 보존). T01 9건·T02 15건·T03 18건 회귀 통과(목은 새 화면 구조에 맞게 수정). 사용자가 브라우저에서 지연 표시, 검색·필터 AND, 필터 중 수정·삭제(삭제 취소 포함), 새로고침 후 유지를 확인했다. 삭제 확인창이 한 번 뜨지 않았으나 브라우저 대화상자 설정 문제였고 모두 정상 확인했다.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  결과: 변경 파일 API-SPEC.md, backend/__init__.py, backend/main.py, backend/requirements.txt(fastapi==0.143.0, uvicorn==0.54.0), .gitignore(.venv, __pycache__, .env). python3 -m venv .venv(시스템 Python에는 pip가 없어 가상환경에서 설치).
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000. curl -i http://127.0.0.1:8000/api/health → HTTP 200, {"status":"ok"}. /docs 200, 없는 경로 404 확인. 남은 오류 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  결과: 변경 파일 backend/main.py, API-SPEC.md. 메모리 목록에 보관하고 GET·POST /api/tasks 구현. 서버 검증: 제목 1~100자(공백 제거), 설명 최대 2000자, status·priority 허용값, due_date는 실제 존재하는 YYYY-MM-DD 또는 null, 모르는 필드 거절.
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload. curl로 정상 6건 201(기본값 TODO·NORMAL·null·"" 적용), 위반 16건(빈·공백·101자 제목, 제목 누락·null·숫자, 설명 2001자, 잘못된 status·priority, 없는 날짜·형식 오류·숫자·시간 포함 날짜, 모르는 필드, 깨진 JSON, 본문 없음) 모두 422, 조회 시 정상 6건만 있음, 재시작 후 [] 확인. 사용자가 /docs에서 등록(201)·빈 제목 422·조회를 확인했다. 응답 예시 표(id 0, "string", Validation Error)는 문서일 뿐 실제 결과는 Server response 영역에서 본다.
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  결과: 변경 파일 backend/main.py, API-SPEC.md. PATCH /api/tasks/{id}(전달한 필드만 변경, due_date null로 삭제), DELETE /api/tasks/{id}(204), GET /api/tasks의 q·status·priority 필터(AND) 구현.
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload 상태에서 curl 확인. title·status·due_date·description을 하나씩 수정해도 나머지 필드 유지, 빈 본문 {} 200 무변경. 없는 id PATCH·DELETE 404, DELETE 204(본문 0바이트), 같은 id 재삭제 404, 삭제 후 새 등록은 새 id(5)로 id 재사용 없음.
  422 확인: 숫자 아닌 id, 빈 제목, title·status null, 잘못된 status·priority·날짜, 101자 제목, 2001자 설명, id·created_at 변경 시도, 깨진 JSON, 잘못된 status·priority 필터, 101자 q. 위반 후 대상과 다른 항목 모두 불변.
  필터 확인: q 대소문자 무시·공백만이면 전체, status·priority 단독, q+priority, 세 조건 AND, 일치 없음 [].
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  결과: 변경 파일 frontend/app.js, backend/main.py(CORS), API-SPEC.md. localStorage 저장을 제거하고 fetch로 GET·POST·PATCH·DELETE /api/tasks를 호출한다. 검색·필터·지연 표시는 받아온 목록에 화면에서 적용한다. 기존 localStorage(task-flow-v1) 값은 삭제하지 않고 자동 이전하지도 않는다(PRD).
  동작: 시작 시 목록 불러오기(실패하면 오래된 목록 대신 오류와 빈 화면), 불러오지 못한 상태에서는 등록·수정·삭제를 막고 다시 불러오기를 시도, 서버에 없는 항목(404)은 오류 표시 후 목록 새로고침, 수정 중 실패해도 입력값 유지, 등록 응답 대기 중 중복 제출 방지.
  실행: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload, python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend. CORS는 curl로 확인(5500 두 주소의 preflight PATCH·DELETE 200과 허용 헤더, 다른 출처는 400·허용 헤더 없음).
  Node DOM 목 + 실제 API 서버 통합 테스트 34건 통과(화면 목록과 서버 목록 일치: 등록·수정·삭제·새로고침·curl 등록 후, 필터 중 수정·삭제 id 기준, 삭제 취소, 404·500·422·연결 끊김 처리). API 서버를 실제로 종료한 상태에서도 오류 메시지 "API 서버에 연결할 수 없습니다"와 빈 화면, 등록 실패와 입력값 유지 확인. 사용자가 브라우저에서 화면과 API 목록 일치, 새로고침 유지, curl 등록 항목 표시, API 중지 시 오류 표시, 재시작 후 복구를 확인했다. (API 루트 / 는 404가 정상이다: 주소는 /api/... 와 /docs.)
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  결과: MariaDB 11.8.6이 127.0.0.1:3306에서 실행 중. 관리자 권한이 필요한 DB·사용자 생성은 사용자가 sudo로 직접 실행했다(DB task_flow, 사용자 task_flow_app, 권한은 task_flow.*로 제한). 변경 파일 .env.example(변수 이름과 가짜 값), .env는 Git 제외 파일이며 권한을 600으로 맞췄다. 비밀번호는 문서·로그에 남기지 않았다.
  확인(mariadb 클라이언트, .env 값 사용): SELECT 1, CURRENT_USER()=task_flow_app@localhost, DATABASE()=task_flow. 비밀번호 없음·틀린 비밀번호는 1045로 거부. SHOW DATABASES에는 information_schema와 task_flow만 보임. mysql.user 조회는 1142로 거부. task_flow 안에서 임시 테이블 생성·삭제 가능, 기존 테이블 없음(생성한 임시 테이블은 삭제함).
  남은 사항: DB 문자셋은 utf8mb4, 정렬은 utf8mb4_uca1400_ai_ci(서버 기본값). DB 비밀번호가 4자로 짧다. 로컬 학습 환경에서는 허용하지만 서버 분리·배포(T12 이후)에서는 긴 무작위 값으로 바꾼다. 접속 허용 범위는 localhost·127.0.0.1이며 T12에서 다시 정한다.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.