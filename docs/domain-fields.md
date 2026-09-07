# Reelink 수동 MVP 도메인 필드

- 기준일: 2026-09-03
- 범위: 관리자 링크 등록과 사용자 제보를 이용한 굿즈 정보 확인
- 상태: Phase 2 스키마 작업에 넘길 필드 확정안

## 설계 원칙

- 영화·극장·캠페인·품목·관측을 분리한다.
- 현재 상태를 임의의 공식 재고로 저장하지 않는다. 가장 최근 관측값과 확인 시각을 함께 보여준다.
- 원문 URL은 필수다. 이미지·영상은 저장하지 않는다.
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
| `tmdbId` | string | 아니오 | TMDB 식별자, 유일값 |

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
| `sourceUrl` | URL | 예 | 확인한 원문 또는 제보 링크 |
| `observedAt` | timestamptz | 예 | 실제 확인 시각 |
| `expiresAt` | timestamptz | 아니오 | 사용자 제보 등 짧게 유효한 값의 만료 시각 |
| `note` | string | 아니오 | 현장 차이, 선착순, 소진 안내 등 |
| `reportedByUserId` | UUID | 아니오 | 사용자 제보일 때만 `User` 참조 |

`status`는 공식 재고 보장이 아니라 관측값이다. `SOLD_OUT`도 출처와 시각이 없으면 저장하지 않는다.

## GoodsCandidate

관리자 승인 전 입력. 자동 collector는 아직 없지만 사용자 제보를 공개 전 검토하는 경계로 사용한다.

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `campaignId` | UUID | 아니오 | 기존 캠페인에 연결할 때만 저장 |
| `itemId` | UUID | 아니오 | 기존 품목에 연결할 때만 저장 |
| `cinemaId` | UUID | 아니오 | 극장 식별 가능할 때 저장 |
| `title` | string | 예 | 후보 제목 또는 제보 요약 |
| `sourceUrl` | URL | 예 | 원문 링크 |
| `observedAt` | timestamptz | 예 | 제보자가 확인한 시각 |
| `reviewStatus` | enum | 예 | `PENDING`, `APPROVED`, `REJECTED` |
| `reviewNote` | string | 아니오 | 관리자 검토 사유 |
| `submittedByUserId` | UUID | 아니오 | 사용자 제보일 때만 저장 |
| `reviewedByUserId` | UUID | 아니오 | 검토 완료 시 저장 |

승인된 후보는 관리자가 필요한 필드를 보완한 뒤 `GoodsCampaign`, `GoodsItem`, `GoodsObservation`으로 반영한다. 원본 후보는 이력으로 남긴다.

## 이번 스키마에서 제외

- 재고 수량, 가격, 구매·예약 정보
- 이미지·영상 파일과 원문 본문 복제
- collector run, retry, lease/lock
- 관심 등록, 알림, 추천
- 다국어 제목과 복잡한 외부 ID 매핑

위 항목은 실제 수동 MVP 사용 데이터가 생긴 뒤 추가한다.
