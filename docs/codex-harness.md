# Codex 하네스

Reelink 하네스는 구현, 검증, 문서, 보고의 책임을 나눠 처리한다.

## 현재 구성

```text
AGENTS.md                         저장소 공통 규칙
frontend/AGENTS.md                Next.js 작업 규칙
backend/AGENTS.md                 NestJS·Prisma 작업 규칙
.codex/config.toml                subagent 동시 실행 한도
.codex/agents/source-researcher.toml  외부 소스 검증
.codex/agents/backend-worker.toml     backend 구현
.codex/agents/frontend-worker.toml    frontend 구현
.codex/agents/qa-reviewer.toml        변경 검토
```

단순 작업은 기본 agent 하나로 끝낸다. 서로 독립적인 조사나 검토가 있을 때만 custom agent를 쓴다.

- `source_researcher`: 영화관, Instagram, 영화 메타데이터, 수집 소스의 공개 접근 범위와 운영 위험을 확인한다. 저장소는 수정하지 않는다.
- `backend_worker`: NestJS modular monolith, PostgreSQL·Prisma, 인증, 관람 기록, 굿즈 수집기를 구현한다.
- `frontend_worker`: Next.js App Router 안에서 관람 기록, 캘린더, 굿즈, `/admin` 화면을 구현한다.
- `qa_reviewer`: 정확성, 보안, 데이터 손실, 접근성, 회귀, 빠진 검증만 찾는다. 취향이나 추측성 추상화는 지적하지 않는다.

## Plugin과 Skill 점검

2026-09-02 기준 필요한 핵심 도구는 설치되어 있다. 추가 plugin 설치는 필요 없다.

- `caveman`: Codex 답변을 짧게 유지한다. 기술 용어와 핵심 근거는 줄이지 않는다.
- `ponytail`: 코드를 작성하거나 검토할 때 가장 작은 올바른 구현을 택한다.
- `superpowers`: 복잡한 작업의 기획, 체계적 디버깅, TDD 절차를 맡는다.
- `vercel-react-best-practices`: React와 Next.js 변경에서 성능 저하를 막는다.
- `web-design-guidelines`: 사용자 화면을 마감할 때 접근성, UX, 성능 규칙을 점검한다.
- `playwright-cli`: 바뀐 화면을 데스크톱과 모바일에서 직접 검증한다.
- `codex-security`: 인증, 권한, 비밀, 결제, 업로드, 외부 입력처럼 신뢰 경계를 건드린 diff를 검사한다.
- `humanize-korean`: 한글 문서를 마무리할 때 의미를 바꾸지 않고 문체만 다듬는다.

Prisma 공식 Skill도 확인했다. DB 작업을 시작할 때 `prisma/skills@prisma-database-setup`처럼 해당 단계에 필요한 것만 설치한다. NestJS community Skill과 접근성 community Skill은 현재 규칙, 공식 문서, 기존 `playwright-cli`와 역할이 겹쳐 추가하지 않는다.

코드를 먼저 최소 범위로 구현한 뒤 필요한 성능·UI·보안 검사를 거친다. 화면 변경은 브라우저에서 확인하고, 한글 문서는 마지막에 윤문한다. 소스 코드와 설정 파일에는 `humanize-korean`을 적용하지 않는다.

## 설치

Windows PowerShell에서 저장소 루트를 기준으로 실행한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-codex-harness.ps1
```

스크립트가 설치하는 community plugin과 standalone skill은 검토를 마친 upstream commit에 고정되어 있다. OpenAI curated marketplace에서는 현재 `codex-security` snapshot을 설치한다. `playwright-cli`를 바로 쓸 수 있도록 `@playwright/cli@0.1.19` command도 설치한다.

설치가 끝나면 Codex를 재시작한다. `ponytail`은 lifecycle hook을 포함하므로 새 세션에서 `/hooks`를 열어 명령과 경로를 확인한 뒤 신뢰한다. `codex-security`의 외부 app 연결은 설치와 별개이며, 실제로 해당 기능을 쓸 때만 인증한다.

## 확인

```powershell
codex plugin marketplace list
codex plugin list
playwright-cli --version
Get-ChildItem $HOME\.codex\skills\react-best-practices,$HOME\.codex\skills\web-design-guidelines,$HOME\.codex\skills\playwright-cli
```

새 스레드에서 다음 요청으로 각 역할을 확인한다.

```text
현재 프로젝트 지침과 활성 skill을 요약해줘.
```

프로젝트 기본값은 [AGENTS.md](../AGENTS.md)에 있다. plugin이 아직 로드되지 않은 세션에서도 같은 역할 경계를 따르되, 실행하지 않은 skill을 실행했다고 보고하지 않는다.

## 업데이트

upstream을 갱신할 때는 새 commit의 manifest, skill 지침, hook을 먼저 검토한다. 검토가 끝난 commit SHA로 설치 스크립트의 `Ref`를 바꾼 뒤 다시 실행한다. 특히 `ponytail` hook의 네트워크 호출·임의 shell 실행·저장소 파일 변경 여부와 `web-design-guidelines`가 실행 중 가져오는 최신 규칙의 변경 내용을 확인한다.
