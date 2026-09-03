# CGV 굿즈 source 사전 검증

- 조사일: 2026-09-03
- 대상: CGV 공식 Web의 경품 이벤트 목록과 극장별 재고 상태
- 결론: 기술적으로 조회 가능하지만 제품용 자동 수집은 보류

## 판단

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| Event discovery | 가능 | 공식 [경품 현황](https://cgv.co.kr/evt/giveawayState)에서 진행 중인 이벤트 목록 제공 |
| 지점별 availability | 제한적 가능 | 이벤트 상세에서 극장별 상태를 제공하지만 실제 보유 재고와 차이가 날 수 있다고 안내 |
| 로그인 | 불필요 | 비회원 브라우저에서 목록과 상세 확인 가능 |
| 비브라우저 접근 | 차단 | 같은 페이지와 조회 endpoint를 일반 HTTP client로 호출하면 `403 Forbidden` |
| API 안정성 | 낮음 | 브라우저 내부 endpoint이며 공개 API 문서와 변경 보장 없음 |
| 제품 사용 권한 | 확인 필요 | 이용약관과 법적고지가 영업 목적 사용, 정보 재배포, 정보 자산 이용을 제한 |

현재 상태에서는 CGV collector를 구현하지 않는다. CGV의 서면 허가나 정식 data feed를 확보한 뒤 다시 판단한다.

## 화면에서 확인한 정보

2026-09-03 기준 경품 현황 화면은 진행 중인 이벤트 33개를 표시했다. 각 항목에서 제목, 시작일, 종료일, 소진 시까지 진행 여부를 확인할 수 있었다.

상세 화면은 이벤트 설명, 대상 지역과 극장, 극장별 상태를 제공했다. 화면에서 쓰는 상태는 다음 네 단계다.

| 내부 상태 | 화면 문구 | Reelink에서 사용할 의미 |
| --- | --- | --- |
| `green` | 재고 보유 가능성이 있습니다. | `LIKELY_AVAILABLE` |
| `yellow` | 재고 소진 중입니다. | `LOW_OR_DEPLETING` |
| `red` | 재고 소진 임박입니다. | `VERY_LOW` |
| `gray` | 마감되었습니다. | `ENDED_OR_SOLD_OUT` |

CGV도 실시간 소진 때문에 화면 상태와 실물 재고가 다를 수 있다고 밝힌다. Reelink가 이 정보를 사용하게 되더라도 공식 재고로 표시하면 안 된다. 관측 시각과 출처를 붙인 추정 상태로만 다뤄야 한다.

## Network 관찰

브라우저에서 다음 read endpoint가 호출되는 것을 확인했다.

```text
/api/v1/content/event/saprm/saprm/searchSaprmEvtListForPage
/api/v1/content/event/saprm/saprm/searchSaprmEvtProdList
/api/v1/content/event/saprm/saprm/searchSaprmEvtTgtsiteList
```

역할은 각각 이벤트 목록, 이벤트 품목, 대상 극장과 상태 조회다. 배포된 page chunk에서는 `event.cgv.co.kr/evt/saprm/saprm/*` origin도 확인된다. 이는 공개 문서가 없는 내부 구현이므로 collector 계약으로 간주하지 않는다.

일반 HTTP client에서 목록, 품목, 대상 극장 endpoint를 한 번씩 호출했으며 모두 `403 Forbidden`이었다. Cloudflare 보호를 우회하거나 브라우저 세션과 cookie를 복제하는 방식은 사용하지 않는다.

## robots.txt와 정책

[robots.txt](https://cgv.co.kr/robots.txt)는 일반 user-agent에 `Allow: /`를 두고 `search=yes`, `ai-train=no`, `use=reference`를 표시한다. 검색과 참고 신호일 뿐, Reelink가 데이터를 상업적으로 재배포해도 된다는 허가는 아니다.

CGV 서비스 이용약관 v2.4는 2025-07-15에 개정됐다. 확인한 제한은 다음과 같다.

- 제2조는 단순하고 반복적인 작업을 자동화하는 프로그램 등을 매크로 프로그램으로 정의한다.
- 제11조는 회원의 사전 승낙 없는 영업활동과 서비스에서 얻은 정보의 복제, 유통, 출판, 방송, 제3자 제공을 제한한다.
- 법적고지는 사이트 정보를 개인적 용도로 사용하거나 저장할 수 있다고 밝히며, 사이트의 서비스와 자료를 CGV의 정보 자산으로 설명한다.

이 문서는 법률 자문이 아니다. 실제 서비스에 CGV 데이터를 넣기 전에는 CGV의 서면 허가와 필요하면 별도 법률 검토가 필요하다.

## 권장안

1. CGV에 이벤트와 지점별 상태의 사용 범위, 갱신 주기, 표시 문구, 출처 표기 조건을 문의한다.
2. 허가를 받으면 문서화된 read-only API나 정식 data feed, rate limit, cache 정책을 요청한다.
3. 허가 전에는 CGV collector를 만들지 않는다. 공식 페이지 링크와 사용자가 직접 입력한 관측값을 분리해 다루는 방안만 검토한다.
4. 다음 후보인 롯데시네마도 같은 기준으로 조사한다.

## 재검증 조건

- CGV가 공식 API나 제휴 feed를 제공할 때
- 이용약관이나 법적고지가 바뀔 때
- 경품 현황 화면과 endpoint 구조가 바뀔 때
- CGV로부터 데이터 사용 범위에 대한 답변을 받을 때
