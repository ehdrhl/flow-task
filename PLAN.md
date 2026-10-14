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
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  결과: 변경 파일 backend/database.py(.env 읽기, SQLAlchemy 엔진·세션), backend/models.py(Task 모델), backend/init_db.py, backend/requirements.txt. 새 패키지 sqlalchemy==2.1.4(테이블·쿼리), pymysql==1.2.3(MariaDB 드라이버), python-dotenv==1.2.4(.env 읽기)를 기록했다.
  tasks 테이블: id(PK, AUTO_INCREMENT), title VARCHAR(100), description VARCHAR(2000) 기본 '', status 기본 TODO, priority 기본 NORMAL, due_date DATE NULL, created_at DATETIME 기본 UTC_TIMESTAMP(). CHECK 제약으로 status·priority 허용값과 공백뿐인 제목을 막는다.
  실행: .venv/bin/python -m backend.init_db → "tasks: 새로 생성"과 컬럼 목록, exit 0. SQL로 SHOW TABLES에 tasks, SHOW CREATE TABLE 확인.
  확인: 재실행하면 "이미 있어 건드리지 않음"이며 먼저 넣은 확인용 행이 그대로 남음(확인용 행은 직접 지움). created_at 기본값은 UTC(서버 로컬 시각과 9시간 차). 잘못된 status·priority, 공백 제목, 101자 제목, 없는 날짜, NULL 제목은 DB가 거부(4025·1406·1292·1048). 한글 100자 제목·2000자 설명은 저장됨. 틀린 비밀번호는 exit 1과 오류 메시지만 출력하고 비밀번호는 노출하지 않음. 환경변수가 없으면 누락된 이름을 알려 줌. 현재 tasks 테이블은 비어 있음. API는 T11 전까지 메모리를 계속 사용하며 /api/health 200 확인.
  남은 사항: 정렬은 DB 기본값 utf8mb4_uca1400_ai_ci로 대소문자·악센트를 구분하지 않는다(제목 검색 방식은 T11에서 확인). due_date는 DB에서 DATE, API에서는 YYYY-MM-DD 문자열이라 T11에서 변환한다.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  결과: 변경 파일 backend/main.py, API-SPEC.md. 메모리 목록·락을 제거하고 요청마다 SQLAlchemy 세션으로 tasks 테이블을 읽고 쓴다. API 계약(경로·응답 형식·검증·상태 코드)은 그대로이고 새 패키지는 없다. 필터(q·status·priority, AND)는 SQL로 처리하며 q의 %·_·\는 글자로 검색한다. DB 접속 오류는 503(비밀번호 등 내용 없음).
  실행: 먼저 python -m backend.init_db(T10), 이후 .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload. 메모리 단계의 데이터(자동 이전 안 함)는 서버를 바꾸면서 사라졌다.
  확인: API로 등록한 두 행을 mariadb SQL(SELECT)로 조회하고 값이 같음(due_date DATE, created_at UTC). API 서버를 종료했다가 다시 시작해도 같은 행과 수정한 상태(DOING)가 유지됨. T06·T07 계약 검증 46건 통과(등록·기본값·422 위반 14건, PATCH 부분 수정·null·{}·위반 10건, 404, DELETE 204, 필터 AND, %·_·\ 검색, id 재사용 없음). 프런트엔드 통합 테스트 34건(실제 API) 통과. 포트 8001에 틀린 비밀번호로 띄운 임시 서버는 /api/health 200, /api/tasks와 POST 503이고 응답·로그에 비밀번호가 없음(임시 서버는 종료).
  테스트로 만든 행은 모두 직접 삭제했고 tasks는 비어 있다. 중간에 테스트 스크립트 오류로 생긴 행 14건은 내용(제목·생성 시각)을 확인한 뒤 해당 id만 삭제했다.
  남은 사항: q 검색이 악센트도 구분하지 않는다(cafe로 café 검색). 대소문자 무시는 이전과 같고 악센트 차이만 있어 API-SPEC에 적었다. 프런트엔드는 받아온 목록에 화면에서 필터를 적용하므로 영향이 없다. 사용자가 브라우저에서 http://localhost:8000 화면, 등록 후 새로고침 유지, /docs를 확인했다.
## 5장: 서버 분리
- [x] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
  결과: 사용자 결정에 따라 App과 DB가 같은 WSL 한 대에 있는 구성으로 완료 처리했다. 네트워크가 분리된 별도 서버는 아니며 App은 127.0.0.1:3306으로 접속한다. 이 구성에서 App 환경(.venv, .env)으로 SELECT 1 → 1, 접속 계정 task_flow_app@localhost, DATABASE()=task_flow 확인. 계정 권한은 task_flow.*로 제한(T09 확인). DB 설정·계정·.env는 변경하지 않았다.
  남은 사항: 서버를 실제로 나눌 때는 bind-address, 접속 허용 호스트(task_flow_app@<App IP>), 방화벽(3306은 App에서만), 긴 무작위 비밀번호로 다시 구성하고 App 서버에서 SELECT 1을 재확인해야 한다(T09의 비밀번호 길이 남은 사항 포함).
- [x] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
  진행(설치 전): 변경 파일 deploy/task-flow-api.service(User=donkey, WorkingDirectory, EnvironmentFile=.env, uvicorn 127.0.0.1:8000, Restart=on-failure, NoNewPrivileges·PrivateTmp). 비밀번호는 유닛에 쓰지 않고 .env(Git 제외)에서만 읽는다. 가상환경(.venv)·requirements.txt는 기존 것을 그대로 쓴다. 새 패키지 없음.
  확인: systemd-analyze verify 통과. 같은 실행 명령과 EnvironmentFile 방식을 사용자 수준 임시 유닛(포트 8001)으로 실행해 /api/health 200, /api/tasks 200, / 200, 로그에 비밀번호 없음, 종료 후 포트 해제 확인(8000 서버는 건드리지 않음).
  결과: 사용자가 sudo로 /etc/systemd/system/task-flow.service를 설치하고 enable --now 했다(이후 사용자 요청으로 유닛 이름을 task-flow-api.service로 변경, 아래 이름 변경 참고). 확인(이 환경에서 조회): is-enabled=enabled, is-active=active, NRestarts=0, uvicorn이 127.0.0.1:8000만 대기(0.0.0.0 아님), /api/health 200 {"status":"ok"}, /api/tasks 200, / 200, journal 로그에 비밀번호 없음, .env 권한 600. 사용자가 재시작 후에도 동작함을 확인했다고 알렸다(재시작 자체는 sudo가 필요해 이 환경에서 직접 실행하지 못함).
  이름 변경: 유닛 파일을 deploy/task-flow-api.service로 바꿨다(systemd-analyze verify 통과). 기존 task-flow.service와 같은 8000 포트를 쓰므로 기존 서비스를 중지·비활성화·삭제한 뒤 새 이름으로 설치해야 한다. 사용자가 기존 서비스를 제거하고 새 이름으로 설치해 enable·start했고, 이 환경에서 enabled·active·NRestarts=0, 설치본과 저장소 파일 동일, /api/health 200을 확인했다. 사용자가 sudo systemctl stop·start 후 정상 동작을 확인했다고 알렸다(stop·start는 sudo가 필요해 이 환경에서 직접 실행하지 못함).
  남은 사항: T14에서 Nginx가 같은 WSL이면 127.0.0.1:8000 프록시를 그대로 쓴다. 다른 서버에 두면 --host를 App 사설 IP로 바꾸고 8000을 Web 서버에서만 접근하게 제한해야 한다. 코드·.env 변경 후에는 sudo systemctl restart task-flow가 필요하다.
- [x] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
  진행(설치 전): 변경 파일 deploy/nginx/task-flow.conf(80 포트, root /var/www/task-flow, /api/ → 127.0.0.1:8000 프록시, 숨김 파일 차단, server_tokens off, 본문 1MB 제한). /home/donkey가 750이라 Nginx(www-data)가 프로젝트 폴더를 읽을 수 없어 정적 파일은 /var/www/task-flow로 복사해 제공한다. frontend/app.js는 5500 외 주소에서 같은 출처 /api를 쓰므로 변경 없음, 새 패키지 없음.
  확인(sudo 없이 임시 Nginx 8081, 같은 설정에 포트·root만 바꿈, 종료·포트 해제함): nginx -t 통과, / · styles.css · app.js 200과 올바른 Content-Type, /api/health·/api/tasks 200, POST 201, PATCH 200, DB에서 SQL로 행 확인, 빈 제목 422, DELETE 204(테스트 행 id 41만 삭제, 행 수 3→3), /.env·/.git/config 403, 없는 경로 404, 로그에 비밀 없음.
  설치 확인(사용자가 sudo로 설치, 이 환경에서 조회): sites-enabled에 task-flow.conf만 있고 default는 제거됨, /var/www/task-flow 파일이 현재 frontend/와 동일(정렬·폼 배치 포함), 설치된 설정이 저장소 파일과 동일, nginx active. 80 포트: / 200, /api/health 200, POST 201(id 42)·DB에서 SQL 조회·DELETE 204(테스트 행만 삭제, 행 수 3 유지), /.env·/.git/config 403, /backend/main.py 404, Server 헤더에 버전 없음.
  8000 포트 변경(사용자 요청, 적용 전): 8000은 API 전용으로 두고 화면은 Nginx(80)에서만 제공한다. backend/main.py에서 frontend/ StaticFiles 마운트(단일 포트 통합 변경)와 미사용 import(Path, StaticFiles)를 제거했다. API 경로·계약·CORS는 그대로다. uvicorn은 127.0.0.1:8000, Nginx 프록시도 127.0.0.1:8000이다(중간에 시도한 Unix 소켓 방식은 요청에 따라 되돌림).
  확인(sudo 없이 새 코드를 임시 포트 8001과 임시 Nginx 8081로 실행, 종료함): 8001에서 / · /index.html · /app.js · /styles.css 404, /api/health·/api/tasks·/docs 200. 8081(Nginx)에서 / · /app.js 200, /api/health·/api/tasks 200, POST 201, DELETE 204(테스트 행만 삭제). 운영 8000은 아직 이전 코드라 / 200이므로 sudo systemctl restart task-flow-api 후 적용된다.
  영향: 8000에서는 화면이 열리지 않고(JSON 404) API와 /docs만 열린다. 화면은 http://localhost(80)에서 본다. 이전의 "8000 단일 포트" 편의 설정은 폐지한다.
  최종 확인: App 재시작(11:50, NRestarts=0) 후 8000에서 / · /app.js 404, /api/health·/api/tasks 200(API 전용), 80에서 / · /app.js 200, /api/health·/api/tasks 200, /.env 403. 80으로 POST 201(id 45)·SQL로 DB 행 확인·DELETE 204(테스트 행만 삭제, 행 수 3 유지). 재시작 이전부터 있던 행(id 37·38·40)이 재시작 후에도 그대로 있어 데이터 유지를 확인했다. /var/www/task-flow 정적 파일은 현재 frontend/와 동일, 서비스 파일은 저장소와 동일(Nginx 설정은 첫 줄 주석만 다름, 동작 무관).
  남은 사항: 8000의 /docs(Swagger)는 열려 있다. 브라우저 표시는 사용자 확인 필요 없이 위 curl 결과로 갈음했다. 프런트를 바꾸면 /var/www/task-flow로 다시 복사해야 한다.
## 6장: 추가 기능
- [x] T15: 목록 정렬(F10). 등록순·마감일 임박순·우선순위순.
  확인: 정렬 중 수정·삭제가 정확한 id에 적용, 필터와 함께 동작, 새로고침 후 등록순으로 시작.
  결과(브라우저 확인 전): 변경 파일 frontend/index.html(정렬 select), app.js(sortedTasks), styles.css(.filters 줄바꿈 허용), PRD.md(F10). 받아온 목록 사본을 정렬해 표시하며 tasks 원본·API·DB는 변경 없음.
  Node로 정렬 로직 4건 통과(등록순, 마감일순에서 같은 날은 id순·마감 없음 마지막, 우선순위순에서 같은 우선순위는 id순, 알 수 없는 값은 등록순, 원본 불변). node --check 통과, 8000에서 index.html에 정렬 select 포함 확인.
  통합 확인(운영 구성 80 포트): /에 정렬 select, app.js에 정렬 코드가 제공됨. 80의 API로 테스트 행 4건(id 46~49: 낮음·먼 마감 / 높음·마감 없음 / 보통·가까운 마감 / 높음·가까운 마감)을 등록하고 실제 응답에 화면과 같은 정렬 코드를 적용: 등록순 ABCD, 마감일순 CDAB(같은 날은 id순, 마감 없음 마지막), 우선순위순 BDCA(같은 우선순위는 id순) 통과. 테스트 행 4건만 삭제, 기존 행(37·38·40) 유지. .env 비밀번호 문제는 해결됨.
  사용자가 브라우저(http://localhost)에서 정렬 동작을 확인했다.
- [x] T16: 등록 폼 접기·펼치기, 왼쪽 등록 폼과 오른쪽 목록 배치(F11).
  확인: 폼 접기·펼치기, 접었다 펴도 입력값 유지, 좁은 화면에서 위아래 배치, 기존 등록·정렬·필터·수정·삭제 정상.
  결과(브라우저 확인 전): 변경 파일 frontend/index.html(.layout, 등록 폼 aside + 토글 버튼, 목록 section), styles.css(2열 배치, 720px 이하 1열, 컨테이너 1000px), app.js(토글, aria-expanded), PRD.md(F11). API·DB·기존 id는 변경 없음.
  Node DOM 목으로 토글 확인(접힘: form hidden·collapsed·aria-expanded=false·라벨 변경, 펼침: 복원과 제목 입력 포커스, 입력값 유지). app.js의 getElementById 대상이 모두 index.html에 존재, 태그 구조 이상 없음, 8000에서 세 파일 200과 /api/tasks 200 확인.
  수정(사용자 요청): 등록 폼을 목록 칸 높이에 맞춰 늘리고(폭 380px, 설명 칸 높이 확대) 접기 버튼을 −/+ 기호만 표시(제목 "새 할 일", aria-label로 접근성 유지). 접으면 폼 높이는 헤더만 남는다.
  수정(사용자 요청): 접을 때 폭(380px)은 고정하고 높이만 블라인드처럼 줄인다(grid-template-rows 1fr→0fr, 0.25초, prefers-reduced-motion이면 전환 없음). 접힌 폼은 visibility:hidden이라 키보드 포커스에서 빠지고, form.hidden 대신 패널의 collapsed 클래스로만 제어한다. 변경 파일 index.html(.form-body 래퍼), styles.css, app.js. 이후 통합 확인 항목은 이 수정 전 기록이며, 수정본은 /var/www/task-flow에 다시 복사해야 80에서 보인다. 토글 DOM 목 테스트는 수정본으로 다시 통과(접힘 + / 펼침 − 와 포커스, 태그 구조 이상 없음).
  수정2(사용자 요청): 오른쪽 "할 일 목록" 패널도 같은 방식으로 접을 수 있게 했다(헤더 "할 일 목록"과 −/+ 버튼, 검색·필터·정렬·목록·빈 메시지를 접음). 두 패널은 서로 독립이며 공통 .panel 클래스와 setupCollapsible()로 처리한다. 접었다 펼칠 때 느껴지는 지연을 줄이려고 전환을 0.25초 ease에서 0.18초 ease-out으로 바꿨다(체감 지연의 원인은 브라우저가 없어 직접 보지 못했고 전환 시작이 느린 곡선과 길이로 추정). 변경 파일 index.html, styles.css(.form-* → .panel-*), app.js. Node DOM 목 4건 통과(폼 접기, 목록 접기 독립, 폼 펼침과 포커스, 목록 펼침), 태그·id·aria-controls 대상 이상 없음. 수정본은 /var/www/task-flow에 다시 복사해야 80에서 보인다.
  수정3(사용자 요청): 오른쪽 패널을 접어도 카드가 왼쪽 높이까지 늘어난 채 목록만 사라지고 왼쪽이 같이 변하던 문제를 고쳤다. 원인은 .layout의 align-items: stretch와 .list-panel.collapsed의 align-self: stretch였다. 두 패널을 align-items: flex-start로 독립시켜 각자 내용 높이만큼만 차지한다(좁은 화면은 column에서 stretch로 폭 유지). 왼쪽을 펼칠 때 패널 높이가 먼저 커지고 내용이 서서히 열려 지연처럼 보이던 현상도 같은 원인이다. 접은 상태에서 헤더 아래 12px 여백이 남던 것은 접히는 영역 안쪽 첫 요소로 padding을 옮겨 해결했다. 이전 요청의 "폼과 목록 높이 맞춤"은 서로 영향을 주지 않는 독립 높이로 대체됐다. 변경 파일 styles.css. 수정본은 /var/www/task-flow에 다시 복사해야 80에서 보인다.
  통합 확인(운영 구성 80 포트): 제공 중인 HTML에 .layout·#form-panel·#form-toggle(aria-label "등록 폼 접기")·.form-header, styles.css에 배치·720px 이하 규칙, app.js에 토글 코드가 있음. /var/www/task-flow가 frontend/와 동일. 토글 DOM 목 테스트 통과(접힘 +, 펼침 −와 포커스). 회귀: 80 경유 등록·PATCH 200·DELETE 204(테스트 행만 삭제, 기존 행 37·38·40 유지).
  사용자가 브라우저(http://localhost)에서 배치, 두 패널 접기·펼치기, 접을 때 독립 동작을 확인했다(수정3 반영본을 /var/www/task-flow에 복사한 상태).
## 7장: 여러 사용자(회원가입·로그인·로그아웃)
PRD F12~F18 기반. 작업 순서는 문서 → DB → 가입 → 로그인 → 보호·분리 → 화면 → 배포 확인이다.
승인된 결정: 로그인 아이디 방식(이메일 아님), 서버 세션+HttpOnly 쿠키(JWT 아님), 로그인 실패 제한(F18) 포함, 기존 tasks 3건은 삭제·이전하지 않고 소유자 없는 행으로 남김, 인증 도입으로 /api/tasks의 계약이 바뀜(401), 해시 라이브러리 추가, 현재 HTTP라 쿠키 Secure는 끔.
각 작업 확인 항목은 두 사용자 계정(예: 테스트 전용 계정)으로 본다. 확인용 계정·행은 직접 만든 것만 삭제한다.
- [x] T17: API-SPEC.md에 인증 API 계약 작성(코드 변경 없음).
  내용: POST /api/auth/signup(201, 중복 409, 형식 위반 422), POST /api/auth/login(200+쿠키, 실패 401 동일 메시지, 제한 429), POST /api/auth/logout(204), GET /api/auth/me(200 아이디, 미로그인 401). /api/tasks* 는 미인증 401, 남의 id 404. 쿠키 이름·속성(HttpOnly, SameSite=Lax, 경로 /, 7일), 요청·응답 예시, 오류 형식.
  확인: PRD F12~F18의 각 항목이 API-SPEC 어디에 대응하는지 대조표로 확인. 문서 충돌 항목 없음.
  결과: 변경 파일 API-SPEC.md만(코드 변경 없음). "인증 API (T17 계약)" 섹션과 PRD 대조표(F12~F18과 보안 요구 전부가 문서 위치·구현 작업에 대응)를 추가하고 구현 상태 표에 T19~T22를 "계약만 확정"으로 올렸다. 공통의 "인증은 없다"는 문장은 T22부터 인증 필수로 바꿨다.
  계약에서 새로 정한 세부 사항(PRD에 없던 것): 가입 요청에 password_confirm을 서버에서도 검사, 가입 후 쿠키 미발급, 가입 중복 409(형식 위반 422가 먼저), 로그인 실패 401은 없는 아이디·비밀번호 불일치·형식 불일치를 같은 본문으로, 429에 Retry-After 헤더, 로그인 시 기존 세션 무효화, 로그아웃은 세션이 없어도 204(멱등), 세션 만료는 로그인 후 7일 고정(연장 없음), 인증 확인이 422·404보다 먼저(401 우선), 출처 검사 위반은 403(Origin이 Host와 다르거나 Sec-Fetch-Site가 cross-site·same-site, 둘 다 없으면 허용), 응답·요청에 user_id 비노출.
  구현 때 주의(T22·T24): Nginx 설정이 Host를 $host로 넘기면 포트가 빠져 80이 아닌 포트에서 Origin 비교가 어긋난다. 80 포트에서는 문제없지만 포트를 바꾸면 $http_host로 바꿔야 한다. 5500 개발 서버는 T22부터 로그인 후 API를 쓸 수 없다(CORS 자격 증명 비허용, PRD). 비밀번호 길이는 글자 수 기준이며 사용자 결정으로 8~72에서 8~20자로 바꿨다(T19 시작 시 PRD·API-SPEC 반영). 로그인 실패 횟수의 저장 방식은 T21에서 확정한다.
- [x] T18: users·sessions 테이블과 tasks.user_id 추가(DB만, API 변경 없음).
  내용: backend/models.py에 User(id, username 고유, password_hash, created_at)·Session(token_hash, user_id, created_at, expires_at), Task.user_id(NULL 허용, users.id 참조). init_db는 새 테이블만 만들고 기존 tasks에는 user_id 컬럼만 비파괴로 추가한다(기존 행·데이터 삭제 없음). 실행 전 mariadb-dump 백업을 안내한다.
  확인: python -m backend.init_db 후 SHOW CREATE TABLE, 기존 tasks 행 수 불변(3건)과 user_id NULL, 재실행해도 변경 없음, 현재 API(/api/tasks)가 여전히 동작.
  결과: 변경 파일 backend/models.py(User, UserSession, Task.user_id), backend/init_db.py(없는 테이블만 생성, 기존 tasks에는 user_id 컬럼·인덱스·외래 키만 비파괴로 추가). 새 패키지 없음.
  백업: 실행 전 mariadb-dump로 /home/donkey/backups/task_flow-20261014-133740-before-T18.sql(권한 600, 저장소 밖)을 만들었다. 비밀번호는 임시 옵션 파일(600)로만 전달하고 삭제했으며 덤프에 비밀번호 문자열 없음.
  실행: .venv/bin/python -m backend.init_db → users·sessions 새로 생성, tasks "user_id 컬럼만 추가". 재실행하면 세 테이블 모두 "이미 있어 건드리지 않음"이고 변경 없음.
  확인: SHOW CREATE TABLE로 users(username 고유, 길이 3 이상 CHECK), sessions(token_hash 기본 키, user_id 외래 키 ON DELETE CASCADE, expires_at·user_id 인덱스), tasks(user_id INT NULL, 인덱스, fk_tasks_user_id) 확인. tasks 4건(id 37·38·40·51)이 백업과 id·내용 모두 같고 user_id는 모두 NULL(실행 전 3건이 아니라 사용자가 등록한 id 51이 추가되어 4건이었다). 제약은 트랜잭션 안에서 시험하고 모두 롤백: 없는 user_id 거부(1452), 2자 아이디 거부(4025), 대소문자만 다른 아이디 중복 거부(1062), 사용자 삭제 시 세션 CASCADE, 할 일이 있는 사용자 삭제는 거부(1451, 데이터 보호). 롤백 후 users·sessions 0건, tasks 4건.
  API: 새 모델 코드를 임시 8001로 실행해 /api/health 200, GET 응답에 user_id 없음, POST 201(user_id NULL), PATCH 200, user_id를 보내면 422, DELETE 204(테스트 행만 삭제). 운영(80)은 기존 프로세스로 계속 /api/tasks 200.
  실수 기록: 실행 전 스냅샷 스크립트가 모듈 경로 오류로 실패했는데 init_db가 이어서 실행됐다. 변경이 컬럼 추가뿐이고 백업이 있어 실행 후 백업 파일과 대조해 데이터 동일을 확인했다.
  남은 사항: 운영 uvicorn은 아직 이전 모델을 메모리에 가지고 있다(동작에는 문제 없음). T19에서 코드가 바뀌면 sudo systemctl restart task-flow-api로 반영한다. users.id가 시험 중 소비되어 AUTO_INCREMENT가 건너뛸 수 있다.
- [x] T19: 비밀번호 해시와 회원가입 API.
  내용: 해시 라이브러리(argon2-cffi 또는 bcrypt 중 목적을 설명하고 하나) requirements.txt에 기록. 서버 검증(아이디 소문자 3~20자 영문·숫자·_, 비밀번호 8~20자, 모르는 필드 422), 아이디 소문자 저장·중복 409, 응답과 로그에 비밀번호 없음.
  확인: 정상 가입 201, 대문자 아이디 중복 409, 위반 422(짧은·긴 비밀번호, 잘못된 아이디, 빈 값, 모르는 필드), DB의 password_hash가 원문과 다르고 형식 문자열(솔트 포함)임, 응답·로그에 비밀번호 없음.
  결정 변경(사용자 요청): 비밀번호 길이를 8~72자에서 8~20자로 바꾸고 PRD F12, API-SPEC, PLAN에 반영했다. 해시 라이브러리는 argon2-cffi(argon2id)로 정했다. 목적은 비밀번호를 솔트가 포함된 느린 단방향 해시로 저장하는 것이며 backend/requirements.txt에 argon2-cffi==25.1.0을 기록했다(.venv에 설치, 의존 패키지 argon2-cffi-bindings 26.1.0·cffi 2.1.1·pycparser 3.11은 자동 설치).
  결과: 변경 파일 backend/security.py(hash_password, verify_password), backend/main.py(POST /api/auth/signup, SignupRequest, 인증 API 422 응답에서 input·ctx 제거), backend/requirements.txt, API-SPEC.md, PRD.md, PLAN.md. 응답은 201 {id, username}이며 쿠키는 발급하지 않는다.
  확인(임시 서버 8001, 가짜 비밀번호, 계정은 직접 삭제): 정상 가입 201, 응답 필드 id·username만, 쿠키 없음, 응답에 비밀번호 없음, 같은 아이디와 대문자만 다른 아이디 409, 대문자 입력은 소문자로 저장, 422 19건(비밀번호 7자·21자·빈 값·null·숫자, 아이디 2자·21자·공백·한글·특수문자·빈 값·null·숫자, 확인 불일치·누락, 필드 누락, 모르는 필드, id 지정, 깨진 JSON, 본문 없음), 경계값 8자·20자·앞뒤 공백 포함 비밀번호는 201. 422 응답 본문에 입력한 비밀번호 없음. 위반 요청은 저장되지 않아 DB에 정상 가입 5명만 있었다.
  DB 확인: password_hash가 모두 $argon2id$ 형식(길이 97), 원문이 포함되지 않음, 같은 비밀번호여도 해시가 달라 솔트 적용됨, 올바른 비밀번호 검증 성공·틀린 비밀번호와 깨진 해시는 안전하게 실패. 서버 로그(journal)에 비밀번호 문자열 0건, POST는 201·409·422로만 기록. 기존 API(/api/health, GET /api/tasks 4건, /api/tasks 422 기본 형식)는 그대로. 시험 계정 5개는 직접 삭제해 users 0건, tasks 4건 유지.
  남은 사항: 운영 uvicorn은 아직 이전 코드라 80에서는 /api/auth/signup이 없다. 반영하려면 sudo systemctl restart task-flow-api가 필요하다. 같은 출처 검사(CSRF)는 T22에서 가입·로그인·로그아웃 포함 전체에 적용한다. 시험으로 users의 AUTO_INCREMENT가 올라 첫 실제 사용자 id가 1이 아닐 수 있다.
- [x] T20: 로그인·로그아웃·me API와 세션.
  내용: 로그인 성공 시 무작위 세션 토큰 발급(DB에는 해시만), HttpOnly·SameSite=Lax 쿠키, 7일 만료. 로그아웃은 세션 삭제와 쿠키 제거. 아이디 없음과 비밀번호 틀림은 같은 401 메시지.
  확인: 로그인 200+Set-Cookie 속성, me 200, 로그아웃 204 후 같은 쿠키로 me 401, 만료된 세션 401, API 재시작 후에도 로그인 유지, 두 오류 케이스의 응답이 동일.
  결과: 변경 파일 backend/main.py(POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, get_current_user·CurrentUser 의존성), backend/security.py(세션 토큰 생성·SHA-256 해시, 시간 맞춤용 DUMMY_HASH), .env.example(COOKIE_SECURE=false, 가짜 값 아님·설정 이름만), API-SPEC.md, PLAN.md. 새 패키지 없음. 세션은 32바이트 무작위 토큰(43자)을 쿠키로만 주고 DB에는 SHA-256 해시만 저장하며 만료는 로그인 후 7일 고정이다. 아직 /api/tasks*에는 인증을 적용하지 않았다(T22).
  확인(임시 서버 8001, 가짜 비밀번호, 시험 계정은 직접 삭제): 로그인 200, 쿠키 속성 HttpOnly·SameSite=lax·Path=/·Max-Age=604800·Secure 없음, 응답에 토큰 없음, Cache-Control no-store, 대문자 아이디 로그인 200. me 200, 쿠키 없음·엉터리·5000자 쿠키는 401(본문 {"detail":"Not authenticated"}). DB에는 토큰 원문이 없고 SHA-256 해시만 있으며 만료는 약 7일(167~168시간). 비밀번호 틀림·없는 아이디·50자 값·형식 불일치(한글·특수문자)는 모두 401과 같은 본문이고 쿠키 없음. 응답 시간 중앙값은 0.056·0.056·0.093초(2배 이내, 긴 값만 약간 느림). 422 6건(필드 누락·null·숫자·모르는 필드·깨진 JSON·본문 없음)이며 본문에 비밀번호 없음. 쿠키를 가진 채 재로그인하면 이전 세션 401·새 세션 200, 만료된 세션은 401이고 다음 로그인 때 만료 세션이 정리됨. 두 사용자 세션은 서로 독립. 로그아웃 204(본문 없음, 쿠키 Max-Age=0), 로그아웃 후 같은 쿠키 me 401, 반복·쿠키 없는 로그아웃도 204. 서버를 껐다 켜도 같은 쿠키로 me 200(세션이 DB에 있어 재시작 후 로그인 유지). 서버 로그에 토큰·비밀번호 0건, 오류 0건. 시험 계정 2개 삭제로 users·sessions 0건, tasks 4건 유지. GET /api/tasks는 변경 없음.
  남은 사항: 운영 uvicorn은 이전 코드라 80에는 아직 /api/auth/login 등이 없다(sudo systemctl restart task-flow-api로 반영). 로그인 실패 제한은 T21, /api/tasks* 인증·소유자 분리·출처 검사(CSRF)는 T22에서 한다. 로그인에 쓰이는 요청은 현재 출처 검사를 하지 않는다.
- [x] T21: 로그인 실패 제한(F18).
  내용: 같은 아이디로 연속 5회 실패 시 5분 동안 429(성공 시 초기화). 존재하지 않는 아이디도 같은 방식으로 제한해 아이디 존재 여부를 드러내지 않는다.
  확인: 5회 실패 후 6번째는 올바른 비밀번호여도 429, 5분 뒤(또는 테스트용 짧은 시간으로 확인) 복구, 다른 아이디에는 영향 없음, 성공 로그인은 카운트 초기화.
  결정(사용자 승인): 실패 횟수는 DB 테이블에 저장한다(재시작해도 유지). PRD 데이터 목록에 login_attempts를 추가하고 API-SPEC 429 항목을 구현에 맞게 구체화했다: 5회 연속 실패 시 5번째 실패로부터 5분 거절, 제한 중 시도는 횟수·제한 시간을 늘리지 않음, 마지막 실패로부터 5분이 지나면 횟수 0, 성공해도 0.
  결과: 변경 파일 backend/models.py(LoginAttempt: username_key=아이디(소문자) SHA-256 해시 64자 기본 키, failed_count, last_failed_at), backend/security.py(hash_username), backend/main.py(제한 확인·실패 기록·성공 시 초기화, 429 Retry-After, DB 오류 번호 로그), PRD.md, API-SPEC.md, PLAN.md. 새 패키지 없음. python -m backend.init_db로 login_attempts만 새로 생성했고 기존 테이블·tasks 내용 해시(edc24c26…)는 그대로다. 아이디 원문은 저장하지 않으므로 긴 값을 넣어도 행 크기가 일정하다.
  확인(임시 서버 8001, 가짜 비밀번호): 5회 실패는 모두 401, 6번째는 올바른 비밀번호여도 429(본문 {"detail":"Too many failed attempts"}, Retry-After 1~300, 쿠키 없음), 제한 중 시도는 횟수(5)와 제한 시간을 늘리지 않음, 대문자만 다른 아이디도 같은 제한, 다른 아이디는 영향 없음, 없는 아이디·60자 값도 5회 후 429(존재 여부 비노출), DB에 아이디 원문 없음, 4회 실패 후 성공하면 기록 삭제·이후 4회 실패해도 제한 안 됨, 마지막 실패로부터 5분 뒤 올바른 비밀번호 200·틀려도 401로 횟수 1부터 다시, 오래된 기록은 실패 시 정리, 422 요청은 횟수에 더하지 않음, 동시 4회 실패 후 횟수 정확히 4, 정상·실패·없는 아이디 9개 요청을 5라운드(45건) 동시에 보내도 503 없이 200·401만. T20 시험 스크립트 재실행 전부 통과(스크립트가 t20_alice에 실패를 반복해 제한에 걸리던 것은 시험 쪽에서 제한을 비우도록 수정). 서버 로그에 비밀번호 0건, 오류 0건. 시험 계정과 시험 login_attempts는 직접 삭제해 users·sessions·login_attempts 0건, tasks 4건 유지.
  발견·수정한 문제: 동시 요청에서 503이 났다. 로그에 원인이 안 남아 DB 오류 번호만 남기도록(메시지·접속 정보 제외) 핸들러를 고친 뒤 오류 1020(MariaDB가 읽은 뒤 다른 요청이 바꾼 행을 갱신하면 거부)임을 확인했다. 로그인 시작에서 읽기로 연 스냅샷을 느린 해시 검증 동안 들고 있어서 생긴 것이라 읽기 직후 db.commit()으로 트랜잭션을 끝내고(연결도 반환), 업서트는 1020·1213·1205에서 새 트랜잭션으로 최대 3회 재시도하며, 오래된 기록 삭제는 별도 READ COMMITTED 트랜잭션에서 실패해도 무시하도록 분리했다(범위 삭제와 INSERT의 잠금 충돌 방지). 정상 사용자의 로그인도 같은 방식으로 실패 요청과 겹치면 503이 될 수 있었던 문제였다.
  남은 사항: 운영 uvicorn은 이전 코드라 80에는 아직 반영되지 않았다(sudo systemctl restart task-flow-api). 같은 아이디를 5번 틀리면 그 아이디의 정상 사용자도 5분간 로그인할 수 없다(계정 잠금 방식의 알려진 부작용, PRD 요구). 서로 다른 아이디를 무수히 시도하면 login_attempts에 행이 늘 수 있으나 5분이 지난 기록은 실패 때마다 정리한다. IP별 제한은 범위 밖이다.
- [x] T22: 할 일 API 인증 필수와 소유자 분리, CSRF 방지.
  내용: /api/tasks* 에 로그인 의존성 적용(미인증 401), 모든 조회·수정·삭제·등록·필터에 user_id 조건, 남의 id는 404. POST·PATCH·DELETE는 Origin/Sec-Fetch-Site 검사로 같은 출처가 아닌 요청 거절. 기존 user_id NULL 행은 어떤 사용자에게도 보이지 않는다. 기존 T06·T07 검증 항목은 로그인 상태로 재확인한다.
  확인: 미인증 전 경로 401, 사용자 A·B 목록이 서로 다름, B가 A의 id를 PATCH·DELETE하면 404이고 데이터 불변, user_id NULL 3건은 둘 다에게 안 보임, 다른 출처 Origin의 POST 거절, 기존 계약 검증(등록·기본값·422·필터 AND·id 재사용 없음)이 로그인 상태로 통과.
  결과: 변경 파일 backend/main.py, deploy/nginx/task-flow.conf(Host를 $http_host로 전달), API-SPEC.md, PLAN.md. 새 패키지 없음. /api/tasks* 전부 get_current_user를 요구하고 목록·등록·수정·삭제·필터에 user_id 조건을 적용한다(다른 사용자의 id와 소유자 없는 기존 행은 없는 id와 똑같이 404, 목록에서는 안 보임). 등록한 행의 user_id는 로그인한 사용자다. /api/ 아래 POST·PUT·PATCH·DELETE는 미들웨어가 가장 먼저 같은 출처를 검사한다(Origin의 스킴·호스트·포트가 요청과 같아야 하며 X-Forwarded-Proto 반영, Origin이 없으면 Sec-Fetch-Site가 cross-site·same-site일 때만 거절, 둘 다 없는 curl은 허용, 거절은 403 {"detail":"Cross-origin request rejected"}).
  확인(임시 서버 8001, 가짜 비밀번호, 138건 모두 통과): 쿠키 없음·엉터리·만료·로그아웃 후는 모든 /api/tasks* 요청이 401(잘못된 본문·깨진 JSON·본문 없음·숫자 아닌 id·잘못된 쿼리여도 401이 먼저), /api/health·/docs는 인증 없이 200. T06·T07 계약을 로그인 상태로 재확인: 등록 201과 기본값, 응답에 user_id 없음, 제목 100자·설명 2000자 허용, 422 17종(빈·공백·101자·누락·null·숫자 제목, 설명 2001자, status·priority 오타, 없는 날짜·형식·숫자·시간 포함 날짜, 모르는 필드, user_id·id·created_at 지정, 깨진 JSON, 본문 없음)과 위반 후 저장 안 됨, PATCH 부분 수정·{}·due_date null·null·위반 8종·없는 id 404·숫자 아닌 id 422·본문 위반 시 422 우선·위반 후 불변, 필터(q 대소문자 무시, status, priority, AND 조합, 일치 없음, %·_·\ 글자 검색, 공백만 q, 101자 q·오타 422), DELETE 204·재삭제 404·id 재사용 없음. 소유자 분리: 두 사용자가 자기 할 일만 보고, 다른 사용자의 id로 PATCH·DELETE하면 404이고 본문이 없는 id와 같으며 데이터 불변, 소유자 없는 기존 4건(id 37·38·40·51)은 두 사용자 모두에게 안 보이고 PATCH·DELETE 404이며 시험 전후 내용 해시 동일. 같은 출처 검사: 다른 도메인·null·스킴 다름·포트 다름·Origin 없는 cross-site·same-site에서 할 일 POST·PATCH·DELETE와 가입·로그인·로그아웃이 모두 403이고 아무것도 바뀌지 않음(개수·내용·계정 생성·세션 유지), 로그인하지 않았거나 깨진 JSON이어도 403이 먼저, 같은 Origin·호스트 대소문자 무시·HTTPS 프록시(X-Forwarded-Proto)·Sec-Fetch-Site same-origin·헤더 없는 curl은 통과, GET은 다른 Origin이어도 허용. 서버 로그에 비밀번호·오류·DB 오류 0건. 시험 할 일 14건·계정 2개·세션은 직접 삭제해 users·sessions·login_attempts 0건, 기존 tasks 4건 유지(해시 동일).
  발견·수정: 깨진 JSON 본문은 FastAPI가 의존성보다 먼저 422로 거절해 로그인하지 않은 요청이 401 대신 422를 받는 문제가 있어, 할 일 경로의 검증 오류 직전에 로그인 여부를 다시 확인해 401을 우선하도록 했다. get_current_user가 읽기 직후 트랜잭션을 끝내 뒤따르는 쓰기가 낡은 스냅샷으로 거부되는 오류 1020 가능성을 줄였다.
  영향: 운영 uvicorn은 아직 이전 코드(인증 없음)라 80의 기존 화면이 계속 동작한다. 재시작하면 /api/tasks가 401이 되어 T23(로그인 화면) 전까지 화면이 목록을 불러오지 못하므로 운영 재시작은 T23 이후 T24에서 한다. 5500 개발 서버는 이제 API를 쓸 수 없다(출처 검사, 의도된 변경). Nginx 설정을 바꿨으므로 T24에서 sudo cp와 nginx reload가 필요하다.
- [x] T23: 프런트엔드 로그인·회원가입 화면(탭 전환)과 로그아웃, 그린·블루·아이보리 테마(F17·F19).
  내용: 한 카드에서 로그인/회원가입 탭 전환(role=tablist, 방향키), 로그인한 아이디 표시와 로그아웃 버튼, 시작·뒤로 가기(pageshow) 때 /api/auth/me로 로그인 확인, 할 일 API가 401이면 세션 만료 안내와 함께 로그인 화면으로, 오류(형식·아이디 중복 409·로그인 실패 401·제한 429와 남은 시간·출처 거절 403·서버 오류)를 글자로 표시, 로그아웃·만료 시 목록과 입력 초안과 필터를 비움. 비밀번호는 어디에도 저장하지 않고(localStorage 포함) 제출 뒤 입력칸을 비움. 5500 개발 서버 분기를 제거해 API는 항상 같은 출처 /api를 쓴다. 디자인은 CSS 변수 팔레트(아이보리 바탕, 그린 주요 버튼, 블루 보조·포커스·진행 중 표시, 오류·지연은 붉은색 유지). 기존 등록·정렬·필터·폼 접기는 그대로.
  확인: Node DOM 목+실제 API로 가입→로그인→등록→로그아웃→뒤로 가기 후 목록 미노출, 새로고침 시 로그인 유지, 다른 계정 로그인 시 목록이 다름, 사용자 입력이 HTML로 실행되지 않음, 명도 대비 AA 계산, 사용자가 브라우저에서 확인.
  결정(사용자 요청): 로그인·회원가입은 탭 전환으로, 색상은 그린·블루·아이보리 테마로 디자인한다. PRD에 F19를 추가했다. 색 구성은 아이보리(바탕·카드), 그린(헤더선·주요 버튼·완료·낮음 배지), 블루(목록 패널 상단·포커스·진행 중·높음·마감 배지), 붉은색(오류·지연, 의미 유지).
  결과: 변경 파일 frontend/index.html(헤더의 사용자 영역, 로그인/회원가입 탭 카드, 앱 영역 래퍼), frontend/app.js(checkSession·showAuth·showApp, 로그인·가입·로그아웃, 탭 전환과 방향키, 세션 만료·pageshow 재확인, 입력·목록 초기화, 5500 분기 제거), frontend/styles.css(CSS 변수 팔레트로 전면 재작성, 기존 레이아웃 규칙 유지, [hidden] 전역 규칙, 모바일 검색칸 한 줄), PRD.md, PLAN.md. 새 패키지 없음(시험 도구만 프로젝트 밖 임시 폴더에 설치).
  동작: 시작·뒤로 가기 복원 때 /api/auth/me로 로그인 확인(401이면 로그인 화면, 서버 오류면 오류 안내). 가입은 클라이언트에서 아이디(영문·숫자·_ 3~20)·비밀번호(8~20)·확인 일치를 먼저 검사하고 서버 409는 "이미 사용 중인 아이디입니다."로 표시, 성공하면 로그인 탭에 아이디(소문자)를 채우고 안내(자동 로그인 없음). 로그인 실패는 아이디·비밀번호를 구분하지 않는 한 문구, 429는 Retry-After를 올림한 분으로 표시. 로그아웃·세션 만료 시 목록·등록 폼·검색·필터·정렬 입력을 비운다. 비밀번호는 요청 직후 입력칸을 비우고 어디에도 저장하지 않으며 사용자 아이디·할 일은 textContent로만 표시한다.
  확인(실제 Chromium 브라우저 + 임시 Nginx 8081 + 임시 API 8001, 가짜 비밀번호, 72건 모두 통과): 로그인 카드·탭 클릭·방향키·Home·End, 가입 검증 6종과 maxlength 20, 가입 성공 안내·자동 로그인 안 됨·소문자 저장, 중복 409 안내, 로그인 실패·없는 아이디 동일 문구, 빈 입력 안내, 5회 실패 후 429 안내(5분)와 제한 중 올바른 비밀번호도 거부, 로그인 후 사용자 표시·새 계정의 빈 목록(소유자 없는 기존 데이터 비노출)·등록·상태 변경·지연 표시·정렬·패널 접기 회귀·새로고침 후 로그인 유지, 로그아웃 후 목록 비움·서버 세션 삭제·뒤로 가기에서 목록 미노출·API 401, 두 번째 계정은 앞 계정의 할 일이 안 보임, 서버에서 세션을 지운 뒤 동작하면 만료 안내와 함께 로그인 화면, pageshow(persisted) 재확인, HTML 입력(img onerror·script)은 실행되지 않고 글자로 표시, localStorage·sessionStorage 비어 있음, 세션 쿠키는 HttpOnly로 JS에서 안 보임, 화면 HTML에 비밀번호 없음, 모바일(390px) 가로 스크롤 없음, 자바스크립트·콘솔 오류 없음(브라우저가 기대한 401·409·429에 남기는 로그만 있음). 오류 문구 시험(모의 응답): 429(90초→2분·300초→5분·10초→1분 올림·헤더 없음), 403, 503, 500, JSON 아닌 502, 서버 중단 시 연결 오류 안내와 새로고침, 복구 뒤 정상. 명도 대비 계산: 본문·보조·버튼·배지·오류·알림 글자 쌍 모두 AA 4.5:1 이상(최소 4.67:1), 입력칸 테두리와 포커스 링·상태 띠는 3:1 이상으로 모두 통과. 서버 로그에 비밀번호·오류 0건. 시험 계정 2개·할 일 6건은 직접 삭제해 users·sessions 0건, 기존 tasks 4건 유지(해시 동일).
  발견·수정: 모바일에서 검색 입력칸이 필터 3개와 한 줄에 놓여 아주 좁게 눌리던 이전부터의 문제를 고쳤다(검색칸을 한 줄 전체로). 입력칸의 maxlength=20은 비밀번호를 21자로 붙여 넣어도 20자로 잘라 가입이 진행될 수 있다(서버 검증과 같은 규칙이라 허용 범위 안이지만 사용자가 모르고 가입할 수 있는 점은 알아 둘 것).
  남은 사항: 이 환경의 시험용 브라우저에는 한글 글꼴이 없어 스크린샷의 글자가 네모로 보이므로 글꼴·글자 배치는 실제 브라우저에서 사용자 확인이 필요하다(색·배치·접기·반응형은 렌더링으로 확인함). 운영(80)에는 아직 반영되지 않았다: 프런트 복사, Nginx 설정 교체와 reload, App 재시작은 T24에서 한꺼번에 한다(그때까지 운영 화면은 이전 모습). 화면을 80에서 사용자가 육안으로 확인하는 것은 T24 확인 항목에 포함한다.
  수정(사용자 요청, 테마·정렬 변경): 테마를 그린·블루·아이보리에서 파랑·회색으로 바꿨다. 우선순위 색은 이전(T04) 방식으로 되돌렸다: 높음 빨강, 보통 회색, 낮음 하늘색(배지와 줄 왼쪽 띠, 띠는 우선순위 기준으로 바꾸고 상태는 새 상태 배지로 표시). 지연은 이전처럼 붉은 배지와 붉은 테두리. PRD F19를 이에 맞게 고쳤다. 변경 파일 frontend/index.html(.panel-content 래퍼), app.js(상태 배지, li data-priority), styles.css(전면 재작성: 격자 배치, 컨트롤 높이 통일, 컨테이너 쿼리), PRD.md, PLAN.md.
  잘림·정렬 점검(실제 Chromium + 한글 글꼴, 폭 13종 1280~320px, 로그인·가입·가입 완료·목록·수정 중·포커스 6개 화면): 수정 전 폭 1280·900·390·320에서 87건. 모든 폭에서 입력칸·버튼의 포커스 링이 접힘 영역의 overflow:hidden에 가려 잘렸고 320px에서는 등록 버튼이 폼 밖으로 밀려 잘렸다. 수정 후 721~860px에서는 목록 칼럼이 좁아 동작 버튼 줄이 칼럼을 벗어나는 문제가 추가로 나와 한 칼럼 전환을 860px로 올리고 목록 내부 배치는 목록 패널 폭 기준(컨테이너 쿼리)으로 바꿨다. 최종 13개 폭 모두 문제 0건(가로 스크롤, 잘림, 글자 넘침, 부모 이탈, 포커스 링 잘림, 목록 줄의 제목·동작·상태 선택 열 위치, 같은 줄 컨트롤 높이 점검). 점검 도구는 프로젝트 밖 임시 폴더에 있다.
  명도 대비 재계산: 모든 글자 쌍 6.0:1 이상(최소 5.03:1 플레이스홀더, 오류 5.30:1), 입력칸 테두리 3.4~3.7:1, 포커스 링 6.0:1, 높음·낮음·보통 띠는 3:1 이상(낮음·보통 띠는 진하게 조정).
  회귀(실제 브라우저): T23 시험 60건과 오류 문구·서버 중단 시험 12건 모두 통과.
  사고 기록(시험이 실제 사용자에게 준 영향): 이 작업 중 사용자가 운영(80)에 배포하고 실제 계정 donkey(id 46, 할 일 2건)를 만들어 같은 DB를 쓰고 있었다. 제 브라우저 시험의 일부 단계가 세션을 만료시키려고 모든 세션을 삭제(DELETE FROM sessions)했고 로그인 실패 기록도 전체 삭제해서 약 14:22에 donkey의 로그인 세션이 함께 삭제되었다. donkey 계정과 할 일은 변하지 않았고(해시 동일) 다시 로그인하면 된다. 시험 코드를 시험 계정(pw_·ui_ 접두사)의 세션·실패 기록만 지우도록 고쳐 재실행했고 실제 계정 상태가 시험 전후 같음을 확인했다. 앞으로 시험은 실제 계정이 있는 DB에서 전역 삭제를 하지 않는다.

- [x] T24: 배포 반영과 통합 확인(Nginx 80).
  내용: 서비스 재시작, /var/www/task-flow로 정적 파일 복사, Nginx 경유로 쿠키 설정·유지 확인. 8000은 API 전용 유지.
  확인: 80에서 두 사용자가 각자 가입·로그인·등록, 서로의 할 일이 안 보임, App 재시작 후 로그인과 데이터 유지, 로그아웃 후 /api/tasks 401, DB에서 비밀번호 원문 없음, 8000에서 화면 404 유지.
  결과: 사용자가 sudo로 App 재시작(task-flow-api, 14:06 시작, NRestarts=0), 화면 파일을 /var/www/task-flow에 복사, Nginx 설정 교체·reload를 직접 실행했다. 이 환경에서 확인한 배포 상태: 화면 파일·Nginx 설정(Host를 $http_host로 전달)·서비스 파일이 모두 저장소와 동일하고 task-flow-api·nginx·mariadb가 active. 이후 사용자의 요청으로 바꾼 파랑·회색 테마 화면도 반영됨(화면 파일이 현재 저장소와 동일).
  확인(운영 80 포트): 80에서 / · /app.js 200, /api/health 200, 로그인 없이 /api/tasks·/api/auth/me 401, /.env 403, /backend/main.py·/docs 404, Server 헤더에 버전 없음. 8000(API 전용)은 / · /index.html · /app.js 404, /api/health 200, /api/tasks 401, /docs 200이고 WSL IP:8000은 접속 불가. 다른 출처 요청은 403, 같은 출처는 정상 처리. 실제 Chromium으로 80에서 T23 시험 60건 모두 통과(가입·로그인·등록·정렬·접기, 로그아웃 후 목록 미노출, 두 번째 계정의 분리, 세션 만료, pageshow 재확인, XSS 입력 비실행, 저장소 비밀번호 없음). Nginx 경유 API: 쿠키 속성 HttpOnly·SameSite=lax·Path=/·Max-Age=604800(Secure 없음, HTTP 환경), 두 계정의 목록 분리, 다른 계정의 할 일 삭제 시도 404, 로그아웃 204 뒤 같은 쿠키 401. 소유자 없는 기존 tasks 4건(id 37·38·40·51)은 그대로 보존되며 어떤 계정에서도 보이지 않는다.
  실제 계정 보호: 운영 DB에 실제 계정 donkey(id 46, 할 일 2건)가 있어 시험은 시험 계정(pw_·ui_ 접두사)만 만들고 지웠고, 시험 전후 donkey의 계정·할 일 내용 해시가 같음을 확인했다. 시험 계정 5개(시험 중 남은 ui_audit 포함)와 할 일 11건은 직접 삭제했다.
  재시작 뒤 유지: 사용자가 운영에서 App 재시작 후 로그인과 데이터가 유지됨을 확인했다고 알렸다(이 환경에서는 sudo가 없어 운영 재시작을 직접 실행하지 못했다). 같은 동작은 T20에서 임시 서버를 껐다 켜 같은 쿠키로 me 200으로 확인했다.
  남은 사항: 쿠키 Secure·HTTPS는 적용하지 않았다(HTTP 학습 환경, PRD). 소유자 없는 기존 할 일 4건을 특정 계정으로 옮기는 작업은 필요하면 별도 작업으로 한다. WSL IP는 재부팅하면 바뀌므로 http://localhost로 접속한다.

## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
T11 이후 편의 설정(T14에서 폐지): 한때 uvicorn이 frontend/도 함께 제공했다. T14부터 8000은 API 전용이고 화면은 Nginx(http://localhost)가 제공한다. 개발 중 화면만 따로 볼 때는 python3 -m http.server 5500 --directory frontend를 쓴다(CORS 허용, API는 8000).
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.
## 추가 변경: 단일 포트(8000) — T14에서 폐지(8000은 API 전용, 아래는 당시 기록)
요청에 따라 FastAPI가 frontend/를 같은 포트에서 제공하도록 backend/main.py 끝에 StaticFiles를 연결했다(PLAN의 작업 번호 밖의 변경).
확인(curl·Node): /, index.html, styles.css, app.js 200과 올바른 Content-Type. /api/health·/api/tasks·/docs 기존대로 200. 없는 경로는 JSON 404, DELETE /api/tasks는 405, POST /는 405. ../.env, %2e%2e, ../backend/main.py, ../.git/config 등 경로 탈출 시도는 모두 404이며 본문에 비밀 없음. 5500 출처 CORS 유지. 8000에서 열린 화면 JS는 같은 출처 /api로 등록·상태 변경·삭제가 동작하고 화면과 서버 목록이 일치(사용자 데이터 불변, 확인용 행은 직접 삭제). 사용자가 브라우저에서 http://localhost:8000 화면, 등록 후 새로고침 유지, /docs를 확인했다.
