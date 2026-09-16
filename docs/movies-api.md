# 영화 검색·선택 API

## 설정

`backend/.env`에 `TMDB_READ_ACCESS_TOKEN`을 넣고 Backend를 재시작한다. 루트 `.env`는 Backend가 읽지 않는다. `Bearer ` 없이 토큰 값만 저장하며 프론트 환경 변수나 Git에 넣지 않는다.

```dotenv
TMDB_READ_ACCESS_TOKEN=
```

두 API 모두 로그인이 필요하다. 브라우저는 Next의 `/api` 프록시를 사용하며 Backend 직접 경로에는 `/api`가 없다.

## 검색

`GET /api/movies/search?q=기생충&page=1`

- `q`: 앞뒤 공백을 제거한 1~200자 문자열. 제어 문자는 거부한다.
- 화면은 입력을 멈춘 뒤 400ms 후 검색한다. 마지막 한글이 조합 중이어도 현재 입력값으로 검색하며 포커스를 옮기지 않는다. 조합 확정용 Enter는 제출하지 않고 일반 Enter는 즉시 검색한다. 별도 검색 버튼은 없다. 새 입력 시 진행 중인 브라우저 요청을 취소하고 오래된 응답을 무시한다. 빈 입력은 결과를 비운다. Infinite scroll 대신 페이지 버튼을 유지한다.
- `page`: 생략하면 1. 1~500 정수이며 배열·소수·지수 표기는 거부한다.
- TMDB의 `ko-KR`, `include_adult=false` 검색을 사용한다. 검색만으로 DB에 영화를 저장하지 않는다.
- 응답: `page`, `totalPages`, `results`. 결과는 `tmdbId`, `title`, `originalTitle`, `releaseDate`, `posterUrl`을 포함한다.
- `releaseDate`는 `YYYY-MM-DD` 또는 `null`이다. 원제·개봉일이 비어 있으면 `null`로 반환한다. 줄거리·TMDB 평점은 이번 범위에 포함하지 않는다.
- `posterUrl`은 검증한 `poster_path`로 만든 `https://image.tmdb.org/t/p/w154/...` 주소 또는 `null`이다. 이미지 경로가 없거나 허용 형식이 아니면 검색을 중단하지 않고 `null`을 반환한다. 검색만으로는 포스터를 DB에 저장하지 않는다.
- 화면은 60×90px 썸네일을 지연 로딩하며 이미지 실패 시 같은 크기의 안내를 표시한다. 브라우저가 TMDB 이미지 CDN에서 직접 읽고 API 토큰은 보내지 않는다. 검색 결과 영역은 최대 28rem 또는 화면 높이의 55% 안에서 스크롤된다.

## 영화 선택

`POST /api/movies/tmdb/:tmdbId`

- TMDB ID는 1~2147483647 정수다. 요청 본문은 생략하거나 빈 객체를 사용한다. 제목·개봉일 등 브라우저가 보낸 메타데이터는 받지 않는다.
- 변경 요청이므로 `Origin`이 Backend의 `APP_ORIGIN`과 일치해야 한다. 현재 임시 실행 주소는 `http://localhost:3002`다.
- 처음 선택한 TMDB ID이면 서버가 상세를 조회해 제목·원제·개봉일과 `runtimeMinutes`, `posterPath`를 저장한다. 러닝타임은 양의 32비트 정수만 허용하며 누락·0·잘못된 값은 `null`이다. 포스터도 검증한 상대 경로만 저장하고 누락·잘못된 경로는 `null`로 처리한다.
- 기존 영화는 개봉일·러닝타임·포스터 중 빈 값이 있을 때 선택 요청당 한 번 보강한다. 이미 있는 값은 바꾸지 않으며 동시 요청이 먼저 채운 값도 보존한다. 보강 중 TMDB 오류·시간 초과·키 미설정이 발생하면 기존 영화로 기록을 계속할 수 있다. 최초 선택은 기존 오류 계약을 따른다.
- `MovieExternalId`의 `(source, externalId)` 유일성과 중첩 생성을 사용한다. 동시 선택으로 유일성 충돌이 나면 생성 전체를 롤백하고 먼저 저장된 영화를 반환한다. 제목이 같다는 이유로 다른 영화를 합치지 않는다.
- 생성·재사용 모두 `200`과 `id`, `title`, `originalTitle`, `releaseDate`, `runtimeMinutes`, `posterUrl`을 반환한다. `releaseDate`는 UTC 자정 ISO 문자열 또는 `null`이다. 반환된 `id`를 `POST /api/viewings`의 `movieId`에 넣는다. TMDB 숫자 ID를 관람 API에 직접 보내지 않는다.
- 관람 생성·수정·목록·상세 응답의 `movie`도 같은 필드를 사용한다. 화면은 선택한 영화와 최근 기록에 포스터·개봉연도·러닝타임을 표시하며 없는 값은 미상으로 표시한다. 관람 조회에서는 TMDB를 호출하지 않는다.
- 전체 영화 자동 갱신·삭제·외부 ID 병합은 아직 없다. 보강 후에도 값이 없으면 다음 재선택 때 다시 조회하며 자동 반복이나 일괄 작업은 실행하지 않는다. 선택과 관람 저장은 별도 요청이므로 기록 작성을 취소해도 선택한 영화는 DB에 남을 수 있다.

## 오류와 보안

- `400`: 잘못된 검색어·페이지·TMDB ID·요청 본문.
- `401`: 로그인 필요. `403`: 변경 요청의 Origin 불일치.
- `404`: TMDB 상세에 해당 영화가 없음.
- `503`: 서버 토큰 미설정 또는 TMDB 인증·요청 제한 문제.
- `504`: 응답 본문 읽기를 포함해 10초 제한 초과. `502`: 그 밖의 통신 실패·잘못된 응답.
- 요청 대상은 서버가 정한 TMDB HTTPS 주소다. 사용자 URL을 요청하지 않고 리디렉션을 따라가지 않는다. 토큰은 Authorization 헤더로만 전송한다.
- 응답 오류에는 TMDB 원문·토큰·네트워크 예외 내용을 담지 않는다. DB에는 검증한 필드만 저장한다.
- 자동 재시도·캐시·앱 자체 요청 제한은 추가하지 않았다. 화면 연결 시 중복 요청 억제와 TMDB 출처 표기 지침을 확인하고 배포 전 요청 제한을 적용한다.

## 검증 범위

2026-09-14 C2에서 메타데이터 저장·재선택 보강·누락값·보강 실패·동시 값 보존을 검증했다. `movie-metadata-migration` 테스트는 임시 스키마와 롤백으로 기존 영화 보존·DB 제약을 확인한다. 실제 TMDB 상세 서비스 조회에서 `496243`의 개봉일 `2019-05-30`, 러닝타임 `131`, 포스터 경로를 확인했다. 실조회는 읽기만 수행했고 개발 DB에 영화를 만들거나 보강하지 않았다.

`pnpm --dir backend test:e2e movies`는 외부 HTTP 응답만 대체하고 실제 로그인 가드·로컬 `reelink_test` DB로 검증한다. 검색 결과, 선택 후 관람 생성, 동시 중복 방지, 입력 검증, 공급자 오류와 토큰 비노출을 확인한다. 테스트가 생성한 사용자·영화는 종료 시 삭제한다.

2026-09-08 별도 검증 프로세스에서 실제 토큰으로 `기생충` 검색과 TMDB ID `496243` 상세 조회를 확인했다. 이 검증은 검색·상세 서비스 호출이며 실제 계정으로 HTTP 선택 API를 호출하거나 개발 DB에 저장한 결과는 아니다.

공식 근거: [영화 검색](https://developer.themoviedb.org/reference/search-movie), [영화 상세](https://developer.themoviedb.org/reference/movie-details), [서버 인증](https://developer.themoviedb.org/docs/authentication-application).
