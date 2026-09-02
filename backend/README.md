# Reelink Backend

Reelink의 API와 도메인 규칙을 담당하는 NestJS 앱이다. 목표 구조는 PostgreSQL과 Prisma를 사용하는 modular monolith다.

## 현재 상태

- NestJS 11
- TypeScript 5
- Jest 30
- `GET /` Hello World API만 구현됨
- DB, Prisma, Auth, MovieViewing, Cinema, Goods domain 미구현
- 기본 port `3001`

NestJS 12 업그레이드는 도메인 구현과 섞지 않고 별도 작업으로 진행한다.

## 환경 변수

[`backend/.env.example`](.env.example)을 `backend/.env`로 복사해 사용한다.

```dotenv
PORT=3001
```

## 실행

저장소 루트에서 실행한다.

```bash
pnpm install --frozen-lockfile
pnpm --dir backend dev
```

API는 기본적으로 `http://localhost:3001`에서 열린다.

## 확인

```bash
pnpm --dir backend lint
pnpm --dir backend test
pnpm --dir backend build
```

## 구현 순서

1. NestJS 12 compatibility 검증과 업그레이드
2. PostgreSQL + Prisma와 첫 migration
3. Google OAuth와 `USER`/`ADMIN` 권한
4. Movie, MovieExternalId, MovieViewing
5. Cinema, CinemaSource와 `/admin` API
6. GoodsCampaign, GoodsItem, GoodsAvailability, AvailabilityObservation
7. GoodsCandidate 승인과 CollectorRun 운영 API

전체 방향과 구현 순서는 [루트 README](../README.md)를 따른다.
