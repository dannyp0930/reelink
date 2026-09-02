# Reelink 2.0

Reelink는 영화, 개인의 관람 경험, 극장, 영화 굿즈를 연결하는 서비스다.

현재 저장소는 제품 기능을 만들기 전 기반을 정리하는 단계다. 화면은 아직 `create-next-app` 기본 상태이며, 실제 DB·인증·관람 기록·굿즈 수집 기능은 구현되지 않았다.

## 제품 범위

### 핵심 기능

1. 개인 영화 관람 기록
   - 같은 영화를 여러 번 관람한 기록을 회차별로 남긴다.
   - 관람일, 극장, 상영관, 평점, 메모를 기록한다.
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

2026-09-02 기준 실제 저장소 상태다.

| 영역 | 현재 상태 |
| --- | --- |
| Repository | pnpm workspace와 루트 단일 lockfile 구성 완료 |
| Runtime | Node.js `24.20.0`, pnpm `11.25.0` 고정 |
| Frontend | Next.js `16.3.4`, React `19.2.8`, Tailwind CSS 4 |
| Frontend UI | `create-next-app` 기본 화면. 제품 UI 미구현 |
| Backend | NestJS 11 Hello World API. NestJS 12 업그레이드 예정 |
| Database | 미구현. PostgreSQL + Prisma 도입 예정 |
| Auth | 미구현. Google OAuth 단일 provider부터 검토 |
| Worker | 미구현. 첫 굿즈 source 검증 후 추가 |
| Infra | Docker, CI/CD, 배포 환경 미구현 |

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

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

실행 주소:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

Backend 환경 변수 예시는 [`backend/.env.example`](backend/.env.example)에 있다. 로컬 비밀 값은 `.env`에 두고 Git에 올리지 않는다.

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

## 도메인 원칙

- `MovieViewing`은 영화별 평점 한 건이 아니라 실제 관람 회차마다 한 행을 저장한다.
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
- 다음: NestJS 12 compatibility 검증과 업그레이드

### Phase 2 — Auth + Movie + MovieViewing

- PostgreSQL + Prisma 기반 스키마를 만든다.
- Google OAuth, `USER`/`ADMIN`, 영화 검색, 관람 기록 CRUD를 구현한다.

### Phase 3 — Calendar

- 월별 관람 이력과 날짜별 상세 기록을 제공한다.

### Phase 4 — Cinema + Admin

- 극장과 source를 DB에서 관리하고 `/admin` 화면을 만든다.

### Phase 5 — First Goods Source

- Phase 0에서 검증한 source 하나만 선택해 end-to-end 수집을 완성한다.

### Phase 6 — More Sources + Independent Cinemas

- 검증이 끝난 source만 추가하고 독립영화관은 공식 Website/RSS와 수동 제출을 우선한다.

### Phase 7 — Collector Operations

- manual run, timeout, retry, idempotency, lease/lock, 실행 이력을 운영 화면에 연결한다.

### Phase 8 — Watch + Notification

- 수집 안정성과 데이터 신뢰도가 확보된 뒤 관심 굿즈와 알림을 추가한다.

### Phase 9 — Production

- Docker, CI/CD, AWS RDS, 모니터링, 백업 정책을 확정한다.

## 문서

- [Frontend 안내](frontend/README.md)
- [Backend 안내](backend/README.md)
- [Codex 하네스](docs/codex-harness.md)
- [작업 규칙](AGENTS.md)
