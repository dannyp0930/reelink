# Reelink Frontend

Reelink의 사용자 화면과 관리자 화면을 담당하는 Next.js App Router 앱이다.

## 현재 상태

- Next.js `16.3.4`
- React `19.2.8`
- TypeScript 5
- Tailwind CSS 4
- 제품 UI 미구현. 현재 `/`는 `create-next-app` 기본 화면

사용자 화면과 `/admin`은 이 앱 안에서 함께 관리한다. Backend 호출은 same-origin `/api`를 사용하고, session과 role의 최종 판단은 Backend가 맡는다.

## 실행

저장소 루트에서 실행한다.

```bash
pnpm install --frozen-lockfile
pnpm --dir frontend dev
```

브라우저에서 `http://localhost:3000`을 연다.

## 확인

```bash
pnpm --dir frontend lint
pnpm --dir frontend build
```

사용자 화면을 바꾼 경우 데스크톱과 모바일 viewport, console error, 주요 network 흐름까지 확인한다.

## 예정된 화면

- 개인 관람 기록과 캘린더
- 영화 검색과 관람 회차 입력
- 영화 굿즈 Radar
- `/admin` 극장·source·collector 관리

전체 방향과 구현 순서는 [루트 README](../README.md)를 따른다.
