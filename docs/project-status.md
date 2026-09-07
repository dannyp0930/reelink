# Reelink 작업 현황

PC를 옮겨 작업할 때 이 문서부터 확인한다. 큰 작업을 마치거나 다른 PC로 이동하기 전에는 현재 상태와 다음 작업을 갱신한다.

## 현재 상태

- 기준일: 2026-09-07
- 브랜치: `main`
- 단계: Phase 2 — DB·관람 데이터 기반 완료. 다음은 Google 로그인·세션·권한
- Frontend: Next.js `16.3.4`, React `19.2.8`
- Backend: NestJS `12.0.1`, TypeScript `6.0.3`
- Database: 로컬 PostgreSQL 17 (검증 버전 `17.11`), Prisma `7.10.0`, 첫 migration 적용 완료
- Auth, 관람 기록 API, 제품 UI: 미구현
- 모델 운영: 전 단계 Astra `high`. 구현 → 테스트 → 검토 → 현황 기록 순서

## 완료

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
- `ratingToHalfStars`와 테스트를 추가했다. Prisma의 소수 잘림을 확인해 DB에 넘기기 전에 `0~5점`, `0.5점` 간격을 검사한다. 실제 작성·수정 API 연결은 후속 작업이다.
- 첫 migration `20260907041114_initial_domain`에 굿즈 CHECK와 평점 범위를 통합했다. 별도 CHECK 초안 파일의 내용은 migration에 보존했다.
- 로컬 `reelink`와 빈 `reelink_test` DB에 migration을 적용했다. 테스트는 매번 트랜잭션을 롤백하며 입력 데이터를 남기지 않는다.

## 다음 작업

1. Google 로그인, opaque DB session, `USER`/`ADMIN`, 내 기록 접근 제한을 구현한다. OAuth client와 redirect URI 설정도 확인한다. 굿즈 제보가 있는 계정의 삭제·익명화 정책을 검토한다.
2. 영화 검색과 관람 기록 CRUD를 만든다. 날짜 입력 검증, `ratingToHalfStars` 연결, 평점·메모 입력을 포함한다.
3. 평점별 모아보기, 높은순·낮은순 정렬, 미평가 필터를 구현한다. 영화별 대표 평점은 최근 평가한 회차를 쓰는 안이며 화면 구현 전에 확정한다.
4. 캘린더 → 수동 굿즈 등록·제보·승인 → 개인 배포 순서로 진행한다. 자동 수집·알림은 수요 확인 후 선택한다.

## 남은 제약

- Google 인증과 API 권한은 아직 없다. DB 테스트 통과가 사용자 데이터 접근 통제를 보장하지 않는다.
- 굿즈의 사용자 제보가 연결된 계정은 삭제를 거부한다. 관람 기록만 있는 계정은 삭제 시 개인 기록도 함께 삭제한다.
- URL 형식·관리자 승인·만료 및 상충 판정 API는 후속 구현 대상이다.
- `security-diff-scan` 도구가 없어 자동 보안 스캔은 실행하지 못했다. 이번 작업에서 외부 서비스나 운영 DB는 변경하지 않았다.
- 다른 PC에서 Git과 migration으로 코드·스키마는 재현되지만 로컬 DB의 관람 데이터는 자동 동기화되지 않는다. 실제 데이터 이동은 별도 백업·복원 작업이다.

## 마지막 검증

2026-09-07에 다음 명령을 통과했다.

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
git diff --check
```

- 실행 확인: Frontend `200`, Backend `200`, DB container healthy
- 단위 테스트 15개, DB 테스트 30개, HTTP 연결 테스트 1개 통과. `reelink_test`에서도 DB 테스트 30개 통과.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: 차이 없음. 이 명령이 검사하지 않는 CHECK는 DB 테스트로 확인했다.
- 현재 제약: 자동 collector는 구현하지 않고, 개인 프로젝트 MVP는 공식 링크·수동 관측값으로 진행

## 재개 방법

먼저 작업 트리가 깨끗한지 확인한다. 미커밋 변경이 있으면 pull 전에 정리한다.

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

DB 테스트는 `.env`의 로컬 `reelink` 또는 `reelink_test`에서 실행한다. 별도 테스트 DB를 쓰려면 `docker compose exec -T db createdb -U reelink reelink_test`를 한 번만 실행하고 해당 셸의 `DATABASE_URL`을 테스트 DB로 지정한 뒤 `db:deploy`, `test:db`를 실행한다. 이 PC에는 테스트 DB가 이미 있다.

작업을 마칠 때는 검증 결과와 막힌 점이 있으면 이 문서에 함께 남긴다.
