# Luna 스키마 초안 검토 기록

- 작성일: 2026-09-03
- 작성 모델: GPT-5.6 Luna
- 범위: 수동 굿즈 MVP용 PostgreSQL + Prisma 초기 스키마
- 상태: 초안 구현 완료, 상위 모델 검토 대기

## 이번 작업에서 한 것

- `backend/prisma/schema.prisma` 추가
- Prisma 의존성은 버전 호환성 검토 후 도입하도록 보류
- Movie, Cinema, GoodsCampaign, GoodsItem, GoodsObservation, GoodsCandidate와 enum 정의
- 현재 상태를 별도 snapshot이 아닌 최근 `GoodsObservation`으로 조회하도록 인덱스 구성
- `sourceUrl`, `observedAt`를 관측 필수 필드로 지정

## 다음 상위 모델 검토 항목

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

## 검증 상태

- 문서 및 schema 작성 완료
- 실제 DB 연결 없음
- migration 실행 전
- Prisma 7 config 형식에 맞춰 `backend/prisma.config.ts`를 추가했다. `prisma validate`와 `prisma generate` 실행 결과는 실제 의존성 버전을 고정한 뒤 확인
