# Reelink 작업 현황

PC를 옮겨 작업할 때 이 문서부터 확인한다. 큰 작업을 마치거나 다른 PC로 이동하기 전에는 현재 상태와 다음 작업을 갱신한다.

## 현재 상태

- 기준일: 2026-09-03
- 브랜치: `main`
- 단계: Phase 1 — Runtime / Packages / Repository Foundation 완료
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

## 다음 작업

1. Phase 0에서 CGV를 첫 후보로 정하고 event discovery와 지점별 availability 접근 가능성을 각각 조사한다.
2. 공식 API, 실제 Network 요청, 인증, robots.txt, 약관, bot protection을 기록한다.
3. 사용 가능한 source가 확인되면 PostgreSQL + Prisma 스키마 작업으로 넘어간다.

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
- 막힌 점: 없음

## 재개 방법

```bash
git pull --ff-only
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

작업을 마칠 때는 검증 결과와 막힌 점이 있으면 이 문서에 함께 남긴다.
