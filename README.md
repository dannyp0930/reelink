# Reelink 2.0

Reelink는 영화, 개인의 관람 경험, 극장, 영화 굿즈를 연결하는 서비스다.

현재 로컬 PostgreSQL 연결, TMDB 영화 검색·선택, 관람·평점 CRUD API, Google 로그인과 검색·관람 작성 초기 UI를 구현했다. 검색 포스터·debounce·별점 입력과 전체 관람 폼은 응답 대체 테스트를 통과했다. 실제 계정 통합 검증, 리스트·캘린더 화면 분리와 굿즈 운영 기능은 남아 있다. 최신 계획은 [내 기록 UI 구현 계획](docs/viewing-ui-plan.md), 완료 근거는 [작업 현황](docs/project-status.md)을 따른다.

## 제품 범위

### 핵심 기능

1. 개인 영화 관람 기록
   - 같은 영화를 여러 번 관람한 기록을 회차별로 남긴다.
   - 관람일, 극장, 상영관, 평점, 메모를 기록한다.
   - 평점은 5점 만점에 0.5점 단위다. 0점과 미평가를 구분한다.
   - 내 평점별 모아보기, 높은순·낮은순 정렬, 미평가 필터를 제공한다.
   - 캘린더에서 관람 이력을 확인한다.
2. 영화 굿즈 Radar
   - 영화별 굿즈 캠페인과 품목을 모아 본다.
   - 극장별 재고 상태와 관측 이력을 구분한다.
   - 출처, 신뢰도, 확인 시각, 정보 신선도를 함께 표시한다.
   - 자동 수집 결과는 관리자 검토 후 공개한다.

### 현재 범위에서 제외

- 팔로우와 커뮤니티
- 사용자 간 소셜 기능
- 추천 알고리즘
- Microservice, Kubernetes, Event Bus

## 현재 상태

2026-09-11 기준 저장소 상태다. 이전 테스트 결과와 이번 문서 갱신을 구분한다.

| 영역 | 현재 상태 |
| --- | --- |
| Repository | pnpm workspace와 루트 단일 lockfile 구성 완료 |
| Runtime | Node.js `24.20.0`, pnpm `11.25.0` 고정 |
| Frontend | Next.js `16.3.4`, React `19.2.8`, Tailwind CSS 4 |
| Frontend UI | 로그인·검색·관람 작성·최근 기록 초기 화면. 별점 포함 관람 폼 응답 대체 테스트 통과 |
| Backend | NestJS `12.0.1`, TypeScript `6.0.3`, 인증·본인 관람 CRUD API |
| Database | 로컬 PostgreSQL 17 + Prisma `7.10.0`, 도메인·세션 migration 적용 |
| Auth | Google OIDC·DB 세션·권한 구현. 로컬 실제 로그인 사용자 확인 |
| Movie search | TMDB 검색·선택 화면 연결, 포스터·400ms debounce 검증 |
| Worker | 미구현. 첫 굿즈 source 검증 후 추가 |
| Infra | 로컬 DB용 Docker Compose 추가. CI/CD와 배포 환경 미구현 |

## 기술 방향

- Frontend와 `/admin`은 하나의 Next.js App Router 앱에서 관리한다.
- 브라우저는 same-origin `/api`를 통해 Backend를 호출한다.
- Backend는 NestJS modular monolith로 유지한다.
- DB는 PostgreSQL, ORM은 Prisma를 우선 사용한다.
- 사용자 API와 외부 굿즈 collector process는 분리하되 DB는 공유한다.
- MVP scheduler는 PostgreSQL lease/lock으로 시작한다.
- Redis/BullMQ는 worker replica, retry, delay, priority가 실제로 필요할 때 도입한다.
- Admin 권한은 이메일 하드코딩이 아니라 DB의 `role`을 기준으로 판단한다.
- 영화 기본 정보는 TMDB를 우선 사용하고 KOBIS는 선택적으로 보강한다.

## 저장소 구조

```text
reelink/
├── frontend/              Next.js App Router
├── backend/               NestJS API
├── docs/                  설계와 운영 문서
├── scripts/               개발 도구 설치 스크립트
├── worker/                굿즈 collector, 추후 추가
├── infra/                 Docker와 배포 설정, 추후 추가
├── AGENTS.md              저장소 공통 작업 규칙
├── pnpm-workspace.yaml
├── package.json
└── pnpm-lock.yaml
```

`worker/`와 `infra/`는 아직 없다. 필요한 단계가 오기 전에는 빈 구조를 미리 만들지 않는다.

## 로컬 실행

### 요구 사항

- Node.js `24.20.0`
- pnpm `11.25.0`
- Corepack
- Docker Desktop 실행 상태

첫 실행 전 `backend/.env.example`을 `backend/.env`로 복사한다. 기존 `.env`가 있으면 덮어쓰지 말고 `DATABASE_URL`을 확인한다.

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm --dir backend db:deploy
pnpm dev
```

실행 주소:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

Backend 환경 변수 예시는 [`backend/.env.example`](backend/.env.example)에 있다. 로컬 비밀 값은 `.env`에 두고 Git에 올리지 않는다.

Google OAuth 설정과 별도 테스트 DB 준비는 [로그인 설정 가이드](docs/auth-setup.md)를 따른다. 자격 증명이 없으면 앱은 실행되지만 로그인 버튼은 비활성화된다.

Compose의 계정은 로컬 개발 전용이며 DB 포트는 `127.0.0.1:5432`에만 노출한다. 운영 환경에는 이 계정을 사용하지 않는다. DB는 named volume에 남는다. 다른 PC에서는 코드를 받은 뒤 migration을 적용하며, 개인 관람 데이터는 Git으로 동기화되지 않는다.

## 주요 명령

저장소 루트에서 실행한다.

| 명령 | 용도 |
| --- | --- |
| `pnpm dev` | Frontend와 Backend 동시 실행 |
| `pnpm lint` | workspace lint 실행 |
| `pnpm test` | workspace test 실행 |
| `pnpm build` | workspace production build |
| `pnpm --dir frontend lint` | Frontend lint |
| `pnpm --dir frontend build` | Frontend build |
| `pnpm --dir backend test` | Backend test |
| `pnpm --dir backend db:generate` | Prisma Client 생성 |
| `pnpm --dir backend db:deploy` | 저장소의 migration 적용 |
| `pnpm --dir backend db:status` | DB migration 상태 확인 |
| `pnpm --dir backend test:db` | 실제 로컬 DB의 도메인 제약 테스트 |
| `pnpm --dir backend test:e2e` | DB 테스트와 Nest HTTP 연결 테스트 |

## 도메인 원칙

- `MovieViewing`은 영화별 평점 한 건이 아니라 실제 관람 회차마다 한 행을 저장한다.
- `ratingHalfStars`는 `0~10` 정수이고 표시 평점은 값의 절반이다. 미평가는 `null`이다. 입력은 `ratingToHalfStars`로 검사하며 임의로 반올림하지 않는다.
- `Movie`와 TMDB·KOBIS 같은 외부 식별자는 분리한다.
- 극장은 `ACTIVE`, `TEMPORARILY_CLOSED`, `CLOSED` 상태로 관리하고 폐관 데이터를 함부로 삭제하지 않는다.
- 굿즈 캠페인, 품목, 극장별 현재 상태, 관측 이력을 각각 분리한다.
- 공식 재고와 추정 상태를 같은 의미로 표시하지 않는다.
- 자동 수집 데이터는 `GoodsCandidate`에서 관리자 승인 후 공개한다.
- Collector 실행 결과와 실패는 별도 run 기록으로 남긴다.

## 구현 순서

### Phase 0 — Data Feasibility

- CGV, 롯데시네마, 메가박스, 씨네Q, Instagram, 독립영화관 source를 조사한다.
- Event discovery와 지점별 availability를 따로 평가한다.
- 공식 API, 실제 Network 요청, 인증, robots.txt, 약관, bot protection을 확인한다.
- Captcha 우회, private API, 로그인 scraping은 사용하지 않는다.

### Phase 1 — Runtime / Packages / Repository Foundation

- 완료: pnpm workspace, 단일 lockfile, Node/pnpm 고정
- 완료: Next.js 16 + React 19.2 업그레이드
- 완료: NestJS 12 compatibility 검증과 업그레이드

### Phase 2 — Auth + Movie + MovieViewing

- 완료: PostgreSQL + Prisma 연결, 첫 migration, 영화·외부 ID·관람 회차·평점 모델과 DB 검증.
- 완료: Google OIDC·DB 세션·`USER`/`ADMIN` 권한 검사와 내 기록 조회 제한. 2026-09-08 사용자가 로컬 실제 로그인 성공을 확인했다.
- 완료: 영화 검색·선택과 관람 CRUD API, 5점 만점·0.5점 단위 별점 입력 및 관람 폼 응답 대체 테스트. 다음은 Repov 참고 설계와 화면 분리다.
- 관람 목록에서 평점별 모아보기, 높은순·낮은순 정렬, 미평가 필터를 구현한다.

2026-09-11 계획은 기존 작성 검증 완료 → 관람 시각·극장/OTT/기타 데이터 계약 → TMDB 개봉연도·러닝타임·포스터와 극장 검색 → 조회 보강 → 기록 route → 캘린더·평점 필터 → 통합 검증 → 수동 굿즈 MVP → 개인 배포다. Repov 참고 시각 설계는 기록 route 구현 전에 마친다. 신규 시각·유형 기능은 아직 구현하지 않았다. 리스트와 캘린더는 같은 기록의 보기 전환이며 기본 모델은 전 단계 Astra `high`다. 상세 완료 기준은 `docs/viewing-ui-plan.md`를 따른다. 아래 자동 수집·알림 단계는 선택 작업이다.

### Phase 3 — Calendar

- 월별 관람 이력과 날짜별 상세 기록을 제공한다.

### Phase 4 — Cinema + Admin

- 극장과 source를 DB에서 관리하고 `/admin` 화면을 만든다.

### Phase 5 — First Goods Source

- 현재 MVP는 공식 링크와 수동 등록·제보·승인을 우선한다. 자동 수집은 허용 범위와 필요가 확인되면 source 하나부터 검증한다.

### Phase 6 — More Sources + Independent Cinemas

- 검증이 끝난 source만 추가하고 독립영화관은 공식 Website/RSS와 수동 제출을 우선한다.

### Phase 7 — Collector Operations

- manual run, timeout, retry, idempotency, lease/lock, 실행 이력을 운영 화면에 연결한다.

### Phase 8 — Watch + Notification

- 수집 안정성과 데이터 신뢰도가 확보된 뒤 관심 굿즈와 알림을 추가한다.

### Phase 9 — Production

- Docker, CI/CD, AWS RDS, 모니터링, 백업 정책을 확정한다.

## 문서

- [내 기록 UI 구현 계획](docs/viewing-ui-plan.md)
- [현재 작업 현황과 다음 작업](docs/project-status.md)
- [TMDB 영화 검색·선택 API](docs/movies-api.md)
- [CGV 굿즈 source 사전 검증](docs/source-feasibility/cgv.md)
- [롯데시네마 굿즈 source 사전 검증](docs/source-feasibility/lotte-cinema.md)
- [메가박스 굿즈 source 사전 검증](docs/source-feasibility/megabox.md)
- [씨네Q 굿즈 source 사전 검증](docs/source-feasibility/cineq.md)
- [Instagram 굿즈 source 사전 검증](docs/source-feasibility/instagram.md)
- [독립영화관 굿즈 source 사전 검증](docs/source-feasibility/independent-cinemas.md)
- [굿즈 source 비교와 Phase 0 판단](docs/source-feasibility/comparison.md)
- [수동 MVP 도메인 필드](docs/domain-fields.md)
- [Luna 스키마 초안 검토 기록](docs/luna-schema-handoff.md)
- [Frontend 안내](frontend/README.md)
- [Backend 안내](backend/README.md)
- [Codex 하네스](docs/codex-harness.md)
- [작업 규칙](AGENTS.md)
