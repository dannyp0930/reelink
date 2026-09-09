# Reelink 작업 현황

PC를 옮겨 작업할 때 이 문서부터 확인한다. 큰 작업을 마치거나 다른 PC로 이동하기 전에는 현재 상태와 다음 작업을 갱신한다.

## 현재 상태

- 기준일: 2026-09-09
- 브랜치: `main`
- 단계: 영화 검색·관람 작성 초기 UI 연결. 검색 포스터·내부 스크롤 검증 완료, 전체 관람 폼 검증은 미완료
- Frontend: Next.js `16.3.4`, React `19.2.8`
- Backend: NestJS `12.0.1`, TypeScript `6.0.3`
- Database: 로컬 PostgreSQL 17 (검증 버전 `17.11`), Prisma `7.10.0`, 도메인·인증 migration 2개 적용 완료
- Auth: Google OIDC, DB 세션, 전역 인증·권한 검사 구현. 이 PC의 키 설정과 로컬 실제 로그인 사용자 확인 완료
- 제품 UI: 로그인·로그아웃, 영화 검색·선택·관람 작성·최근 기록 목록 연결. 상세·수정·삭제 화면은 미구현
- 관람 API: 본인 CRUD 구현. 평점 필터는 다음 작업
- 영화 API: TMDB 검색·선택 구현. 계약과 설정은 `docs/movies-api.md`에 기록
- 모델 운영: 전 단계 Astra `high`. 구현 → 테스트 → 검토 → 현황 기록 순서

## 완료

- 2026-09-09: `backend/.env.example`에 저장 위치·재시작·3002 OAuth callback·TMDB 토큰 종류·테스트 DB 설명을 보완했다. 선택 설정인 `BACKEND_URL`은 `frontend/.env.example`에 정리했다. 실제 `.env`는 Git에서 제외한다.
- Codex 하네스 구성
- pnpm workspace와 단일 lockfile 구성
- Node.js `24.20.0`, pnpm `11.25.0` 고정
- Next.js 16과 React 19.2 업그레이드
- NestJS 12 업그레이드
- TypeScript 6 설정과 Jest ESM 실행 방식 정리
- PC 간 줄바꿈 정규화를 위한 `.gitattributes` 추가
- CGV 굿즈 source 사전 검증 완료. 자동 수집은 사용 권한 확인 전까지 보류
- 롯데시네마 굿즈 source 사전 검증 완료. 지점별 availability와 사용 권한을 확보하기 전까지 자동 수집 보류
- 메가박스 굿즈 source 사전 검증 완료. 지점별 상태는 확인되지만 `robots.txt`와 사용 권한 때문에 자동 수집 보류
- 씨네Q 굿즈 source 사전 검증 완료. 이벤트 안내는 확인되지만 지점별 availability가 없어 자동 수집 보류
- Instagram source 사전 검증 완료. 공개 게시물은 발견 링크로만 사용하고 자동 수집·콘텐츠 재배포는 보류
- 독립영화관 대표 표본(인디스페이스·아트나인) 검증 완료. 이벤트 발견은 가능하지만 실시간 재고와 공통 feed가 없어 수동 운영 우선
- 전체 source 비교표 작성 완료. 개인 프로젝트는 수동 링크·사용자 제보 기반으로 진행
- 수동 MVP 필드와 Luna Prisma 초안 검토 완료. 캠페인·품목 복합 FK, 제보 내용 보존, 출처별 URL 조건을 반영했다.
- 만료·상충 관측의 `UNKNOWN` 판정 기준 작성 완료. 조회 API는 아직 미구현이다.
- `compose.yaml`에 로컬 DB와 named volume을 추가했다. 포트는 `127.0.0.1:5432`에만 노출한다.
- Prisma CLI·Client·adapter를 `7.10.0`으로 고정하고 pnpm에서 `prisma`, `@prisma/engines` 빌드 스크립트만 추가 허용했다.
- `.env` 로딩, Prisma Client 생성, Nest 연결·종료 처리를 구현했다. 개발 실행과 빌드 시 Client를 생성하며 생성 파일은 Git에서 제외한다.
- `MovieExternalId`와 회차별 `MovieViewing`을 추가했다. 평점은 `0~10` 반점 단위 정수, 미평가는 `null`이다.
- `ratingToHalfStars`와 테스트를 추가했다. Prisma의 소수 잘림을 확인해 DB에 넘기기 전에 `0~5점`, `0.5점` 간격을 검사한다. 작성·수정 API에도 연결했다.
- 첫 migration `20260907041114_initial_domain`에 굿즈 CHECK와 평점 범위를 통합했다. 별도 CHECK 초안 파일의 내용은 migration에 보존했다.
- 로컬 `reelink`와 빈 `reelink_test` DB에 첫 migration을 적용했다. 도메인 테스트는 매번 트랜잭션을 롤백하며 입력 데이터를 남기지 않는다.
- `googleSubject`, `Session`, `OAuthLogin`을 추가하고 `20260907093000_google_auth_sessions` migration을 개발·테스트 DB에 적용했다.
- 로그인 요청은 브라우저 쿠키와 연결하고 `state`·`nonce`·S256 PKCE를 검사한다. Google 서명·issuer·audience·만료 검증은 `google-auth-library` `11.0.2`를 사용한다.
- 로그인 요청은 10분, 세션은 7일 뒤 만료된다. DB에는 세션 해시만 저장한다. 재로그인 시 해당 브라우저의 기존 세션을 교체하고 로그아웃 시 폐기한다.
- API는 기본적으로 로그인이 필요하다. `Origin` 검사, 현재 DB 역할 검사, 본인 관람 기록 조회 조건을 적용했다. 관리자가 다른 사용자의 개인 기록을 조회하는 것도 차단한다.
- Next의 `/api` 프록시와 로그인 화면을 연결했다. 키가 없으면 로그인 버튼을 비활성화한다. 설정 방법은 `docs/auth-setup.md`에 기록했다.
- Google 토큰 검증은 로컬 서명 키로, 로그인·권한 통합 흐름은 Google 응답 대체와 실제 테스트 DB로 검증했다. Auth 테스트는 실행별 생성 데이터만 삭제한다. 기존 도메인 테스트는 트랜잭션을 롤백한다.

- 2026-09-08: 사용자가 로컬 3002 포트에서 실제 Google 로그인 성공을 확인했다. 로그아웃·새로고침 후 유지의 실제 계정 검증은 별도로 확인해야 한다.
- `POST /viewings`, `PATCH /viewings/:id`, `DELETE /viewings/:id`를 추가했다. 소유자는 세션에서 결정하며 수정·삭제 쿼리에도 사용자 조건을 포함한다.
- 평점, 실제 날짜, UUID, 상영관 100자·메모 5,000자 제한을 검사한다. 선택 항목은 생략 시 유지하고 `null`로 비운다. 허용하지 않은 필드와 NUL 문자는 거부한다.
- 기존 DB 스키마·의존성을 재사용했다. 영화·극장이 없으면 `400`, 타인 기록이나 없는 관람 기록은 `404`다. 관람 삭제는 영화·극장과 다른 회차에 영향을 주지 않는다.
- 관람 쓰기 통합 테스트 49개를 추가했다. 인증 가드·실제 PostgreSQL로 검증하며 테스트 전용 사용자·세션·영화·극장은 실행 후 삭제한다. 개인 개발 DB에는 테스트 기록을 만들지 않았다.

- TMDB 검색과 내부 영화 선택 API를 추가했다. Node 기본 `fetch`를 사용하며 외부 응답 검증, 10초 제한, 오류 비식별화, 중복 생성 방지를 적용했다. 새로운 의존성·migration은 없다.
- 2026-09-08 실제 토큰으로 `기생충` 검색·상세 서비스 조회에 성공했다. 당시 검증 프로세스에서만 루트 `.env`의 토큰을 읽었으며 개발 DB에는 저장하지 않았다. 2026-09-09에는 사용자가 `backend/.env`를 수정한 뒤 Backend를 재시작해 앱 설정 반영을 확인했다.

## 다음 작업

1. 관람 작성 전체 검증을 마무리한다. `scripts/check-viewing-ui.cjs`는 극장 선택 locator와 화면 이탈 경고 처리에서 중단돼 아직 통과하지 않았다. 이번에 통과한 검색·포스터 테스트와 구분한다.
2. 기록 목록 → 새 기록 작성 → 상세 route를 분리하고 수정·삭제 화면을 연결한다. 모바일 뒤로가기 때 검색·입력을 보존하는 방식을 정한다. 검색 debounce는 구현했으며 infinite scroll은 route·상태 복원 정리 후 검토한다. 실제 계정의 저장·새로고침·로그아웃 흐름과 TMDB 공식 로고 적용을 확인한다.
3. 평점별 모아보기, 높은순·낮은순 정렬, 미평가 필터를 구현한다. 영화별 대표 평점은 최근 평가한 회차를 쓰는 안이며 화면 구현 전에 확정한다.
4. 캘린더 → 수동 굿즈 등록·제보·승인 → 개인 배포 순서로 진행한다. 자동 수집·알림은 수요 확인 후 선택한다.

## 남은 제약

- 로컬 실제 Google 로그인은 사용자 확인 결과다. 운영 HTTPS 환경은 미검증이며 자동 테스트가 Google Cloud 설정의 정확성을 보장하지 않는다.
- 굿즈의 사용자 제보가 연결된 계정은 삭제를 거부한다. 관람 기록만 있는 계정은 삭제 시 개인 기록도 함께 삭제한다.
- URL 형식·관리자 승인·만료 및 상충 판정 API는 후속 구현 대상이다.
- `security-diff-scan` 도구가 없어 자동 보안 스캔은 실행하지 못했다. 이번 작업에서 외부 서비스나 운영 DB는 변경하지 않았다.
- 관리자 제품 화면, 계정 삭제·익명화 API, 배포 환경 요청 제한은 미구현이다. 첫 가입자를 자동 관리자로 승격하지 않는다.
- `GET /cinemas`는 로그인한 사용자에게 이름순 극장 목록을 반환한다. 과거 관람을 위해 폐업·휴업도 포함하고 `id`, `name`, `chain`, `status`만 제공한다. 극장 데이터 등록은 아직 별도 작업이다.
- 관람 평점 필터·페이지 이동, 다중 창 수정 충돌 감지는 미구현이다. 현재 관람 목록은 최근 50건이며 정상 수정은 마지막 쓰기가 반영된다.
- TMDB 메타데이터 자동 갱신·캐시·앱 자체 요청 제한은 미구현이다. 영화 선택·관람 작성은 별도 요청이다. TMDB 출처 문구·링크는 표시하지만 공식 로고 적용은 남아 있다.
- 다른 PC에서 Git과 migration으로 코드·스키마는 재현되지만 로컬 DB의 관람 데이터는 자동 동기화되지 않는다. 실제 데이터 이동은 별도 백업·복원 작업이다.

## 마지막 검증

2026-09-09 검색 UI 정리:

- 검색 버튼과 스크롤 안내 문구를 제거했다. 자동 검색·일반 Enter 즉시 검색, 검색 상태·오류 안내, 검색 결과 영역의 접근성 이름·키보드 포커스는 유지했다.
- `scripts/check-search-debounce.cjs`, `scripts/check-search-posters.cjs`: 1280×844·390×844 통과. 관람 폼 테스트의 검색 동작도 Enter로 갱신했지만 전체 관람 폼 검증은 아직 미완료다.
- `pnpm --dir frontend lint`, `pnpm --dir frontend build`, `git diff --check` 통과. Frontend·세션 API `200`을 확인했고 검증 브라우저는 종료했다.

2026-09-09 한글 검색 포커스 수정:

- 한글 마지막 글자의 조합이 끝날 때까지 검색을 막아 포커스를 옮겨야 검색되는 문제를 재현했다. 조합 상태와 관계없이 400ms 입력 정지 후 검색하도록 수정했다. 조합 확정용 Enter의 제출 방지와 동일 값 확정 시 중복 검색 방지는 유지했다. 자동 검색 안내 문구도 제거했다.
- `scripts/check-search-debounce.cjs`에 Chromium `Input.imeSetComposition` 재현을 추가했다. 수정 전 검색 결과 대기 실패, 수정 후 1280×844·390×844에서 포커스를 유지한 검색·조합 확정 중복 방지와 기존 debounce 검증을 통과했다. API 응답은 대체했으며 실제 OS 한글 입력기나 모바일 키보드를 직접 조작한 검증은 아니다. `pnpm --dir frontend lint`, `pnpm --dir frontend build` 통과.

2026-09-09 검색 debounce 최초 작업(한글 조합 정책은 위 수정으로 변경):

- 입력 후 400ms 자동 검색, 한글 조합 중 검색 보류, Enter·버튼 즉시 검색을 추가했다. 새 입력·빈 입력·선택·저장·화면 종료 시 대기 타이머와 진행 요청을 취소하며 늦게 도착한 응답은 무시한다. 자동 검색 오류는 입력 포커스를 옮기지 않는다.
- `pnpm dlx @playwright/cli -s=debounce --raw run-code --filename=scripts/check-search-debounce.cjs`: 1280×844·390×844에서 연속 입력 요청 축소, 400ms 대기, 한글 조합, 즉시 검색 중복 방지, 페이지 이동, 빈 입력, 이전 요청 취소·늦은 응답 무시, 오류 후 포커스 유지·복구를 확인했다. API 응답은 대체했으며 콘솔·런타임 오류는 없었다. 의도한 503 오류의 브라우저 로그는 제외했다.
- `scripts/check-search-posters.cjs` 회귀 테스트, `pnpm --dir frontend lint`, `pnpm --dir frontend build`, `git diff --check` 통과. Frontend·세션 API `200`을 확인했다. 이번에는 Backend 코드를 수정하거나 Backend 테스트를 재실행하지 않았다.
- Infinite scroll은 구현하지 않았다. 기존 페이지 버튼과 내부 스크롤을 유지한다. 관람 폼 전체 검증·route·뒤로가기 상태 복원은 여전히 다음 작업이다.

2026-09-09 검색 포스터·스크롤 작업:

- `backend/.env` 토큰 반영·Backend 재시작 후 실제 `기생충` 검색 4건, 3002 프록시의 세션 API `200`을 확인했다. 토큰 값은 출력하지 않았다.
- 포스터 URL 응답이 없어 실패하는 테스트와 스크롤 영역이 없어 실패하는 UI 테스트를 먼저 확인했다. 변경 후 `pnpm --dir backend test:e2e movies` 50개를 통과했다.
- `pnpm dlx @playwright/cli -s=posters run-code --filename=scripts/check-search-posters.cjs`: 1280×844·390×844에서 포스터 표시·없음·이미지 실패, 내부 스크롤·키보드 접근, 영화 선택을 확인했다. API·이미지 응답을 대체했으며 개인 DB에는 기록을 만들지 않았다. 테스트 중 콘솔·런타임 오류는 없었다.
- 화면은 한 페이지의 초기 UI다. 모바일 너비에 맞추되 route·검색 URL·뒤로가기 상태 복원은 아직 구현하지 않았다.
- `web-design-guidelines` 검토로 썸네일 크기 고정·대체 안내·스크롤 영역 이름·키보드 포커스를 확인했다. 검색 상태 URL 반영은 route 분리 단계에 남겼다.
- `pnpm --dir frontend lint`, `pnpm --dir frontend build`, `pnpm --dir backend lint`, `pnpm --dir backend test -- --runInBand`, `pnpm --dir backend test:e2e`, `pnpm --dir backend build`, `git diff --check` 통과. Backend 단위 30개·E2E 145개다.
- 실제 TMDB `기생충` 검색에서 받은 포스터 주소의 `200`, `image/jpeg` 응답을 확인했다. Backend 빌드 후 개발 서버를 다시 켰으며 검증용 `posters` 브라우저는 종료했다.

2026-09-08 API 작업에서 다음 명령을 통과했다.

```bash
pnpm --dir backend test:e2e viewings
pnpm --dir backend test:e2e movies
pnpm --dir backend lint
pnpm --dir backend test -- --runInBand
pnpm --dir backend test:e2e
pnpm --dir backend build
pnpm --dir backend exec tsc --noEmit --incremental false
git diff --check
```

- 관람 API 기본 테스트 46개 통과 후 경계 문자열·NUL 검증을 추가했다. 관람 단계 E2E는 94개였으며 TMDB 39개를 추가한 최종 E2E 133개, 단위 테스트 30개를 통과했다.
- TMDB 서비스의 실조회는 루트 토큰을 별도 프로세스에 주입해 확인했다. 앱의 Backend 환경 설정 완료나 실제 계정의 HTTP 선택·저장을 검증한 것은 아니다.
- Backend 개발 서버와 빌드가 `dist`를 함께 사용하면서 개발 서버가 중단됐다. 개발 서버를 재시작한 뒤 3002 프록시의 세션 API `200`, 비로그인 영화 검색·선택 API `401`을 확인했다.
- 새 API가 없어 `404`로 실패하는 테스트를 먼저 확인하고 구현했다. NUL 검사를 제거했을 때 `400` 대신 PostgreSQL 오류 `500`이 발생하는 것도 재현한 뒤 검사를 복구해 통과했다.
- Frontend 파일은 수정하지 않았다. 이번 작업에서 Frontend lint/build·화면 회귀 테스트는 재실행하지 않았다.

2026-09-07 이전 기반·인증 작업에서 확인한 명령은 아래와 같다. 이번 작업의 재실행 결과와 구분한다.

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm --dir backend db:generate
pnpm --dir backend db:validate
pnpm --dir backend db:deploy
pnpm --dir backend db:status
pnpm --dir backend test:db
pnpm --dir backend test:e2e
pnpm --dir backend lint
pnpm --dir backend test -- --runInBand
pnpm --dir backend build
pnpm --dir backend exec tsc --noEmit --incremental false
pnpm --dir frontend lint
pnpm --dir frontend build
git diff --check
```

- 실행 확인: Frontend `200`, Backend `200`, DB container healthy
- 단위 테스트 30개, E2E 45개(도메인 30, 인증·권한 14, HTTP 연결 1) 통과. E2E는 `TEST_DATABASE_URL`의 로컬 `reelink_test`에서 실행했다.
- 브라우저: `scripts/check-auth-ui.cjs`로 1280×800·390×844, 밝은·어두운 화면, 키보드 이동, 로그인 실패, 재시도, 로그아웃을 확인했다. 로그인 완료 화면은 응답을 대체했고 로그아웃은 실제 API로 검증했다. 예상하지 않은 콘솔 오류는 없었으며 검증 브라우저는 종료했다.
- `web-design-guidelines` 검토에서 본문 이동 링크와 한글 줄바꿈을 보완했다. 최종 변경 UI의 미해결 지적은 없다.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: 차이 없음. 이 명령이 검사하지 않는 CHECK는 DB 테스트로 확인했다.
- 현재 제약: 자동 collector는 구현하지 않고 개인 프로젝트 MVP는 공식 링크·수동 관측값으로 진행

## 재개 방법

현재 PC는 다른 작업이 3000을 사용하므로 Frontend를 3002로 실행한다. Backend는 3001이며 실행 환경의 `APP_ORIGIN=http://localhost:3002`를 사용한다. Google 승인된 콜백에도 3002 주소를 추가했다. 아래 `pnpm dev`는 기본 3000 실행이므로 현재 PC에서는 포트별 명령을 사용한다.

```powershell
# Frontend 터미널
pnpm --dir frontend dev --port 3002
# 별도 Backend 터미널
$env:APP_ORIGIN='http://localhost:3002'
$env:PORT='3001'
pnpm --dir backend dev
```

먼저 작업 트리가 깨끗한지 확인한다. 미커밋 변경이 있으면 pull 전에 정리한다.

Backend 빌드 전에는 실행 중인 Backend 개발 서버를 중단한다. `pnpm --dir backend build` 완료 후 위의 Backend 명령으로 다시 실행한다. 개발 서버와 빌드를 동시에 실행하면 공유 출력 폴더 `dist`가 지워지는 동안 서버가 중단될 수 있다.

```bash
git status --short
git pull --ff-only
corepack enable pnpm
pnpm install --frozen-lockfile
```

`backend/.env`가 없으면 `backend/.env.example`을 복사한다. 기존 파일은 덮어쓰지 않는다. Docker Desktop을 실행한 뒤 이어서 실행한다.

```bash
docker compose up -d --wait db
pnpm --dir backend db:deploy
pnpm dev
```

`db:deploy`는 저장소 migration 적용용이고 `db:migrate --name 이름`은 새 스키마 변경 작성용이다. CHECK가 빠지는 `prisma db push`로 대체하지 않는다. 중단은 `docker compose stop db`를 사용한다. 데이터 보존 중에는 `docker compose down -v`를 실행하지 않는다.

E2E에는 `.env`의 `TEST_DATABASE_URL`과 migration이 적용된 `reelink_test`가 필요하다. 준비 명령은 `docs/auth-setup.md`에 있다. 이 PC에는 테스트 DB와 환경 변수 설정을 마쳤다. Google 키를 입력한 `.env`는 Git으로 동기화되지 않으므로 다른 PC에서 별도로 설정한다.

작업을 마칠 때는 검증 결과와 막힌 점이 있으면 이 문서에 함께 남긴다.
