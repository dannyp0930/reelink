# Reelink 작업 현황

PC를 옮겨 작업할 때 이 문서부터 확인한다. 큰 작업을 마치거나 다른 PC로 이동하기 전에는 현재 상태와 다음 작업을 갱신한다.

## 현재 상태

- 기준일: 2026-09-03
- 브랜치: `main`
- 단계: Phase 0 — Data Feasibility 진행 중, Phase 1 기반 정리 완료
- Frontend: Next.js `16.3.4`, React `19.2.8`
- Backend: NestJS `12.0.1`, TypeScript `6.0.3`
- Database, Auth, 제품 UI: 미구현

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

## 다음 작업

1. 관리자 링크 등록·사용자 제보 기반 수동 MVP 범위를 확정한다.
2. 실제 수요가 확인될 때 전주디지털독립영화관·미림극장 등 독립영화관 후보를 같은 기준으로 추가 검증한다.
3. 수동 MVP 필드가 확정되면 PostgreSQL + Prisma 스키마 작업으로 넘어간다.

## 마지막 검증

2026-09-03에 다음 명령을 통과했다.

```bash
pnpm peers check
pnpm --dir backend test -- --runInBand
pnpm --dir backend test:e2e -- --runInBand
pnpm --dir backend lint
pnpm --dir backend build
```

- 실행 확인: Frontend `200`, Backend `200`
- 현재 제약: 자동 collector는 구현하지 않고, 개인 프로젝트 MVP는 공식 링크·수동 관측값으로 진행

## 재개 방법

```bash
git pull --ff-only
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

작업을 마칠 때는 검증 결과와 막힌 점이 있으면 이 문서에 함께 남긴다.
