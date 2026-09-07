# Reelink 관람 기록·수동 굿즈 MVP 도메인 필드

- 기준일: 2026-09-07
- 범위: 개인 관람·평점 기록, 관리자 링크 등록과 사용자 제보를 이용한 굿즈 정보 확인
- 상태: 초기 migration과 실제 DB 검증 완료. API와 제품 UI는 미구현

## 설계 원칙

- 영화·극장·캠페인·품목·관측을 분리한다.
- 현재 상태를 임의의 공식 재고로 저장하지 않는다. 가장 최근 관측값과 확인 시각을 함께 보여준다.
- 공식 페이지·SNS 관측은 원문 URL이 필수다. 현장 사용자 제보는 제보자와 확인 시각이 필수다. 이미지·영상은 저장하지 않는다.
- 수량 숫자는 받지 않는다. 현장 안내를 그대로 적는 `note`만 둔다.
- 자동 수집, 알림, 예약, 결제 필드는 이번 MVP에서 만들지 않는다.

## 공통 필드

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `id` | UUID | 예 | 서버 생성 |
| `createdAt` | timestamptz | 예 | 서버 생성 |
| `updatedAt` | timestamptz | 예 | 서버 갱신 |

## Movie

영화 기본 정보. 굿즈 데이터가 외부 영화 식별자에 종속되지 않도록 내부 ID를 사용한다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `title` | string | 예 | 표시용 제목 |
| `originalTitle` | string | 아니오 | 원제, 없으면 비움 |
| `releaseDate` | date | 아니오 | 확인 가능한 경우만 저장 |

## MovieExternalId

외부 식별자는 영화에서 분리한다. `movieId`, `source` (`TMDB`, `KOBIS`), `externalId`를 저장한다. `(source, externalId)`와 `(movieId, source)`는 각각 유일하다. 같은 숫자라도 출처가 다르면 별개 식별자다.

## MovieViewing

같은 영화와 날짜라도 관람 회차마다 한 행을 저장한다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `userId` | UUID | 예 | 관람 기록 소유자. 이후 API에서 세션으로 결정 |
| `movieId` | UUID | 예 | `Movie` 참조 |
| `watchedOn` | date | 예 | 사용자가 선택한 관람 날짜. API는 날짜 문자열을 검증하고 UTC 자정으로 변환할 예정 |
| `cinemaId` | UUID | 아니오 | `Cinema` 참조 |
| `auditorium` | string | 아니오 | 상영관 이름 |
| `ratingHalfStars` | smallint | 아니오 | `0~10` 정수, 표시 평점은 `/ 2`. `null`은 미평가 |
| `note` | string | 아니오 | 개인 관람 메모 |

- 입력 평점은 `0~5점`, `0.5점` 단위다. `ratingToHalfStars`가 숫자·범위·간격을 검사하며 문자열 변환이나 반올림은 하지 않는다. 이후 작성·수정 API에서 반드시 이 함수를 사용한다.
- Prisma `7.10.0`의 정수 입력이 소수를 잘라 저장하는 동작을 DB 테스트에서 확인했다. SMALLINT와 범위 CHECK만으로 원래 입력의 간격을 검증할 수 없다.
- 평점·날짜별 조회를 위해 `(userId, ratingHalfStars)`, `(userId, watchedOn)` 인덱스를 둔다. 조회 시 사용자 조건은 이후 API에서 강제한다.
- 관람 목록은 회차별 평점을 표시한다. 영화별 모아보기의 대표값은 최근 평가한 회차를 사용하는 안이며 조회 UI 구현 전에 확정한다.
- 관람이 있는 영화·극장의 삭제는 거부한다. 관람 기록만 삭제해도 영화는 남는다. 사용자 삭제 시 개인 관람 기록은 함께 삭제한다.
- 굿즈 제보·관측이 연결된 사용자는 삭제를 거부해 근거를 보존한다. 계정 삭제·익명화 절차는 인증 단계의 별도 과제다.

## Cinema

관측 대상 극장. 폐관 데이터를 삭제하지 않는다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `name` | string | 예 | 공식 표기명 |
| `chain` | enum | 예 | `CGV`, `LOTTE`, `MEGABOX`, `CINE_Q`, `INDEPENDENT`, `OTHER` |
| `status` | enum | 예 | `ACTIVE`, `TEMPORARILY_CLOSED`, `CLOSED` |
| `address` | string | 아니오 | 지점 구분에 필요할 때만 저장 |

## GoodsCampaign

영화별 굿즈 증정 캠페인. `sourceUrl`은 이벤트 원문 링크다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `movieId` | UUID | 예 | `Movie` 참조 |
| `title` | string | 예 | 이벤트 제목 |
| `startsAt` | timestamptz | 아니오 | 시간까지 확인될 때만 저장 |
| `endsAt` | timestamptz | 아니오 | 종료 시각, 불명확하면 비움 |
| `sourceType` | enum | 예 | `OFFICIAL_PAGE`, `OFFICIAL_SOCIAL`, `USER_REPORT` |
| `sourceUrl` | URL | 예 | 원문 링크 |
| `status` | enum | 예 | `DRAFT`, `PUBLISHED`, `ENDED` |

## GoodsItem

캠페인에 포함된 개별 품목.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `campaignId` | UUID | 예 | `GoodsCampaign` 참조 |
| `name` | string | 예 | 예: `A3 포스터`, `오리지널 티켓` |
| `kind` | enum | 예 | `POSTER`, `TICKET`, `CARD`, `STICKER`, `OTHER` |
| `note` | string | 아니오 | 증정 조건·수량 제한 문구 |
| `sortOrder` | integer | 예 | 캠페인 내 표시 순서, 기본 `0` |

## GoodsObservation

극장·품목별 관측 이력. 현재 화면은 같은 대상의 가장 최근 레코드를 조회해 표시한다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `campaignId` | UUID | 예 | `GoodsCampaign` 참조 |
| `itemId` | UUID | 아니오 | 품목을 특정할 수 없으면 비움 |
| `cinemaId` | UUID | 예 | `Cinema` 참조 |
| `status` | enum | 예 | `UNKNOWN`, `LIKELY_AVAILABLE`, `LOW_OR_DEPLETING`, `SOLD_OUT`, `ENDED` |
| `sourceType` | enum | 예 | `OFFICIAL_PAGE`, `OFFICIAL_SOCIAL`, `USER_REPORT`, `ADMIN_NOTE` |
| `sourceUrl` | URL | 조건부 | 공식 페이지·SNS는 필수, 현장 제보는 선택 |
| `observedAt` | timestamptz | 예 | 실제 확인 시각 |
| `expiresAt` | timestamptz | 아니오 | 사용자 제보 등 짧게 유효한 값의 만료 시각 |
| `note` | string | 아니오 | 현장 차이, 선착순, 소진 안내 등 |
| `reportedByUserId` | UUID | 조건부 | `USER_REPORT`이면 필수, 인증된 사용자 ID 사용 |

`status`는 공식 재고 보장이 아니라 관측값이다. `SOLD_OUT`도 출처와 시각이 없으면 저장하지 않는다.

## GoodsCandidate

관리자 승인 전 입력. 자동 collector는 아직 없지만 사용자 제보를 공개 전 검토하는 경계로 사용한다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `campaignId` | UUID | 아니오 | 기존 캠페인에 연결할 때만 저장 |
| `itemId` | UUID | 아니오 | 기존 품목에 연결할 때만 저장 |
| `cinemaId` | UUID | 아니오 | 극장 식별 가능할 때 저장 |
| `title` | string | 예 | 후보 제목 또는 제보 요약 |
| `sourceType` | enum | 예 | `OFFICIAL_PAGE`, `OFFICIAL_SOCIAL`, `USER_REPORT`, `ADMIN_NOTE` |
| `sourceUrl` | URL | 조건부 | 공식 페이지·SNS는 필수, 현장 제보는 선택 |
| `reportedStatus` | enum | 아니오 | 제보한 `AvailabilityStatus`, 이벤트 소개만 있으면 비움 |
| `note` | string | 아니오 | 제보 원문 설명, 관리자 검토 사유와 분리 |
| `observedAt` | timestamptz | 예 | 제보자가 확인한 시각 |
| `reviewStatus` | enum | 예 | `PENDING`, `APPROVED`, `REJECTED` |
| `reviewNote` | string | 아니오 | 관리자 검토 사유 |
| `submittedByUserId` | UUID | 조건부 | `USER_REPORT`이면 필수, 인증된 사용자 ID 사용 |
| `reviewedByUserId` | UUID | 아니오 | 검토 완료 시 저장 |

승인된 후보는 관리자가 필요한 필드를 보완한 뒤 `GoodsCampaign`, `GoodsItem`, `GoodsObservation`으로 반영한다. 원본 후보는 이력으로 남긴다.

## 관계와 입력 검증

- `itemId`가 있으면 같은 품목의 `campaignId`를 사용한다. 복합 FK로 다른 캠페인의 품목 연결을 막는다.
- 후보에 `itemId`만 있고 `campaignId`가 없는 입력은 SQL CHECK로 거부한다.
- `ADMIN_NOTE`는 설명이 필수다. 관리자 권한은 이후 API에서 확인한다.
- URL이 있으면 API에서 HTTP(S) 형식을 검사한다. URL 자동 요청은 하지 않는다.
- 사용자 ID는 요청 본문이 아니라 인증 정보에서 가져온다. 실제 API는 아직 미구현이다.
- CHECK는 `backend/prisma/migrations/20260907041114_initial_domain/migration.sql`에 통합했다. 별도 `constraints.sql`은 남기지 않는다. `db:deploy`로 적용하며 `prisma db push`로 대체하지 않는다.

## 현재 상태 판정 기준

- 캠페인·품목·극장이 정확히 같은 승인된 관측만 비교한다. 품목 미지정 관측을 모든 품목에 적용하지 않는다.
- 출처와 제보자별 최신 관측을 고른다. 같은 시각에 서로 다른 상태가 있으면 `UNKNOWN`이다.
- `expiresAt`이 없거나 현재 시각 이하인 관측은 현재 상태의 근거로 쓰지 않는다. 과거 관측으로 되돌아가지 않는다.
- 유효한 근거가 없거나 출처별 최신 상태가 서로 다르면 `UNKNOWN`이다. 공식 출처라는 이유만으로 상충하는 값을 덮어쓰지 않는다.
- 승인 시 관리자가 유효기간을 지정한다. 만료 이후에도 원문 상태와 확인 시각은 이력으로 남긴다.
- 위 판정은 API 구현 시 테스트할 계약이다. 이번 변경에는 조회 로직이 포함되지 않는다.

## 이번 스키마에서 제외

- 재고 수량, 가격, 구매·예약 정보
- 이미지·영상 파일과 원문 본문 복제
- collector run, retry, lease/lock
- 관심 등록, 알림, 추천
- 다국어 제목과 외부 ID 병합·중복 영화 조정

위 항목은 실제 수동 MVP 사용 데이터가 생긴 뒤 추가한다.
