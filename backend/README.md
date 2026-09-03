# Reelink Backend

Reelink의 API와 도메인 규칙을 담당하는 NestJS 앱이다. 목표 구조는 PostgreSQL과 Prisma를 사용하는 modular monolith다.

## 현재 상태

- NestJS `12.0.1`
- TypeScript `6.0.3`
- Jest 30
- `GET /` Hello World API만 구현됨
- DB, Prisma, Auth, MovieViewing, Cinema, Goods domain 미구현
- 기본 port `3001`

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

1. PostgreSQL + Prisma와 첫 migration
2. Google OAuth와 `USER`/`ADMIN` 권한
3. Movie, MovieExternalId, MovieViewing
4. Cinema, CinemaSource와 `/admin` API
5. GoodsCampaign, GoodsItem, GoodsAvailability, AvailabilityObservation
6. GoodsCandidate 승인과 CollectorRun 운영 API

전체 방향과 구현 순서는 [루트 README](../README.md)를 따른다.
