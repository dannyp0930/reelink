# Google 로그인 설정

로그인·세션·권한 코드와 자동 테스트는 구현했다. 2026-09-08 사용자가 로컬 3002 포트에서 실제 Google 로그인 성공을 확인했다. 다른 PC에서는 키를 별도로 설정해야 하며 설정 전에는 로그인 버튼이 비활성화된다.

## Google Cloud 설정

1. Google Cloud Console에서 Reelink용 프로젝트를 선택하거나 만든다.
2. Google Auth Platform의 Branding과 Audience를 설정한다. 테스트 모드라면 로그인에 사용할 본인 계정을 테스트 사용자로 등록한다.
3. Clients에서 유형이 Web application인 OAuth 클라이언트를 만든다.
4. 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/google/callback`을 등록한다. 뒤에 `/`를 추가하지 않는다.
5. Client ID와 Client Secret을 `backend/.env`에 입력한다. 채팅이나 Git에 올리지 않는다.

```dotenv
APP_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

위 빈칸을 발급받은 값으로 채우고 Backend를 재시작한다. `.env` 파일 변경만으로 실행 중인 프로세스에 반영되지는 않는다. `http://localhost:3000`에서 Google로 로그인 → 계정 선택 → 홈의 이메일 표시 → 로그아웃 순서로 확인한다. `localhost`와 `127.0.0.1`을 섞어 접속하지 않는다.

공식 안내: [Google OpenID Connect 설정과 서버 흐름](https://developers.google.com/identity/openid-connect/openid-connect).

3000 포트를 다른 작업에서 사용하면 Frontend를 `pnpm --dir frontend dev --port 3002`로 실행한다. Backend 실행 환경의 `APP_ORIGIN`도 `http://localhost:3002`로 맞추고 Google 승인된 리디렉션 URI에 `http://localhost:3002/api/auth/google/callback`을 추가한다. 이 PC는 파일 기본값을 바꾸지 않고 실행 환경에만 3002를 적용했다.

## 적용된 규칙

- Google `sub`로 계정을 식별한다. 이메일이 같다는 이유로 기존 계정에 자동 연결하지 않는다. 신규 사용자는 `USER`이며 요청에 담긴 역할은 사용하지 않는다.
- Google 서명·issuer·audience·만료를 공식 라이브러리로 검증하고 `nonce`, 검증된 이메일도 확인한다. 로그인 요청에는 `state`와 S256 PKCE를 사용한다.
- 로그인 요청은 브라우저 쿠키에 묶이며 10분 뒤 만료된다. 콜백은 DB에서 한 번만 소비한다. Google 토큰은 저장하지 않는다.
- 세션은 7일 뒤 만료된다. 브라우저에는 HttpOnly·SameSite=Lax 쿠키를 두고 DB에는 SHA-256 해시만 저장한다. 다시 로그인하면 해당 브라우저의 기존 세션을 교체한다.
- HTTPS에서는 Secure·`__Host-` 쿠키를 사용한다. production에서는 HTTPS `APP_ORIGIN`이 필수다.
- 공개로 지정하지 않은 API는 로그인이 필요하다. 변경 요청은 `Origin`이 `APP_ORIGIN`과 일치해야 한다. 개인 응답은 `Cache-Control: no-store`로 반환한다.
- `/api/viewings`는 본인 기록 최근 50건, `/api/viewings/:id`는 본인 기록 한 건을 반환한다. 작성·수정·삭제도 구현했으며 타인 기록 변경은 관리자에게도 `404`다. 입력 규칙은 `docs/domain-fields.md`에 있다. 평점 필터와 입력 화면은 다음 작업이다.
- 관리자 역할은 DB에서 명시적으로 부여한다. 첫 가입자를 자동 관리자로 만들지 않는다. 실제 관리자 제품 화면은 후속 작업이다.
- 계정 삭제 시 세션과 개인 관람 기록은 함께 삭제된다. 굿즈 제보가 연결된 계정은 현재 DB 정책상 삭제가 거부된다. 자동 삭제·익명화 기능은 아직 없으며 별도 정책 확정 후 구현한다.

## 로컬 테스트 준비

기본 앱 DB와 별도로 `reelink_test`를 사용한다. 아래 DB 생성 명령은 처음 한 번만 실행한다. 이 PC에는 이미 만들어져 있다.

```powershell
docker compose exec -T db createdb -U reelink reelink_test
```

`backend/.env`에 다음 값을 추가한다. 테스트는 이 주소를 사용하며 Auth 통합 테스트는 로컬 `reelink_test` 이외의 DB에서 실행을 거부한다.

```dotenv
TEST_DATABASE_URL=postgresql://reelink:reelink@localhost:5432/reelink_test?schema=public
```

별도 PowerShell 터미널에서 테스트 DB에 migration을 적용한다. 아래 환경 변수는 해당 터미널에만 적용되므로 검증 후 터미널을 닫는다.

```powershell
$env:DATABASE_URL='postgresql://reelink:reelink@localhost:5432/reelink_test?schema=public'
pnpm --dir backend db:deploy
pnpm --dir backend test:e2e
```

브라우저 검증은 앱 실행 후 저장소 루트에서 실행한다. Google 미설정 상태를 기준으로 하며 로그인 완료 화면은 응답을 대체한다. 로그아웃은 실제 API를 호출한다.

```powershell
pnpm dlx @playwright/cli -s=reelink-auth open http://localhost:3000/
pnpm dlx @playwright/cli -s=reelink-auth run-code --filename=scripts/check-auth-ui.cjs
pnpm dlx @playwright/cli -s=reelink-auth close
```

통합 테스트의 Google 응답 대체와 관리자 확인 경로는 테스트 코드에만 있다. 제품 코드에는 로그인 우회 기능이 없다. 로컬 실제 로그인은 사용자 확인 결과이며 운영 HTTPS·프록시 설정, 배포 환경의 요청 제한은 별도 확인이 필요하다.
