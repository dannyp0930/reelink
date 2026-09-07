# Luna 스키마 초안 검토 기록

- 작성일: 2026-09-03
- 작성 모델: GPT-5.6 Luna
- 범위: 수동 굿즈 MVP용 PostgreSQL + Prisma 초기 스키마
- 상태: 2026-09-07 Astra 후속 구현에서 의존성 고정, 첫 migration, 실제 DB 검증 완료

## Luna 초안 작성 당시 작업

- `backend/prisma/schema.prisma` 추가
- Prisma 의존성은 버전 호환성 검토 후 도입하도록 보류
- Movie, Cinema, GoodsCampaign, GoodsItem, GoodsObservation, GoodsCandidate와 enum 정의
- 현재 상태를 별도 snapshot이 아닌 최근 `GoodsObservation`으로 조회하도록 인덱스 구성
- `sourceUrl`, `observedAt`를 관측 필수 필드로 지정

## 초안에서 요청했던 검토 항목

1. Prisma 버전과 `prisma-client-js` generator 설정의 호환성
2. `GoodsObservation`의 `itemId` nullable 정책과 최신 관측값 조회 방식
3. `GoodsCandidate` 승인 후 본 데이터로 반영할 때 중복·트랜잭션 처리
4. foreign key 삭제 정책과 폐관 극장 데이터 보존
5. `sourceType`, `AvailabilityStatus`, `CampaignStatus` enum이 MVP에 충분한지
6. `MovieViewing`, OAuth session, `CinemaSource` 추가 시 relation/index 충돌
7. 실제 PostgreSQL에서 migration·generate·seed 검증

## 검토 전 변경 제한

- 자동 collector, retry, lease/lock 모델 추가 금지
- Redis/BullMQ 의존성 추가 금지
- 재고 수량·가격·알림 필드 추가 금지
- 검토 항목을 해결하기 전 migration을 운영 DB에 적용하지 않음

## 후속 검증 결과

- 2026-09-07: 복합 FK, 후보의 `reportedStatus`·`note`·`sourceType`, 선택적 URL을 반영했다.
- 조건부 필수값 CHECK를 `backend/prisma/migrations/20260907041114_initial_domain/migration.sql`에 통합하고 로컬 PostgreSQL에 적용했다.
- Prisma CLI·Client·PostgreSQL adapter를 `7.10.0`으로 고정했다. `prisma-client`와 `moduleFormat = "cjs"`로 Nest 연결·빌드를 검증했다.
- 만료·상충 관측의 `UNKNOWN` 처리 기준을 `docs/domain-fields.md`에 추가했다. API와 승인 트랜잭션은 후속 구현 대상이다.

- `MovieExternalId`, `MovieViewing`, 평점 반점 단위를 추가했다. 기존 `Movie.tmdbId`는 외부 ID 모델로 옮겼다. 이전 초안은 DB에 적용되지 않아 데이터 이관은 없었다.
- 빈 `reelink_test` DB에 migration을 재적용하고 DB 테스트를 실행했다. 테스트 데이터는 각 트랜잭션 종료 시 롤백한다.
- 승인 중복·트랜잭션, 만료·상충 조회 API는 아직 미구현이다. 이번 검증은 해당 기능의 완성을 뜻하지 않는다.
- 2026-09-07 후속 인증 작업에서 `Session`, `OAuthLogin`, `User.googleSubject`를 추가하고 두 번째 migration을 적용했다. 기존 relation/index와 함께 검증했다. 실제 Google 로그인은 자격 증명 설정 후 확인해야 한다. 설정 방법은 `docs/auth-setup.md`에 있다.
