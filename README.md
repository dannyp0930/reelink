# 🎬 Reelink

> 영화 기반 콘텐츠 추천 및 관리 서비스  
> 현재는 **Frontend(Next.js + TypeScript + Tailwind CSS)** 기반 UI가 완성된 상태입니다.  
> 이후 **Backend(NestJS → Spring Boot 전환 예정)** 과 **CI/CD, Docker 인프라 구성**이 순차적으로 추가됩니다.

---

## 📁 Project Structure (현재)

```
reelink/
 ┣ frontend/        # Next.js 프론트엔드
 ┣ backend-nest/    # (예정) NestJS API 서버
 ┣ backend-spring/  # (예정) Spring Boot 서버
 ┗ infra/           # (예정) Docker, Nginx, CI/CD 설정
```

---

## 🚀 Frontend (Next.js)

**Tech Stack**

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS / shadcn/ui
- **State Management:** Zustand (예정)
- **Build Tool:** Yarn

**Run Locally**

```bash
cd frontend
pnpm install
pnpm dev
```

앱은 기본적으로 `http://localhost:3000` 에서 실행됩니다.

---

## 🧱 Backend (예정)

| 단계  | 기술 스택                       | 설명                            |
| ----- | ------------------------------- | ------------------------------- |
| 1단계 | **NestJS + Prisma + MySQL**     | TypeScript 기반 풀스택 API 서버 |
| 2단계 | **Spring Boot + JPA + MySQL**   | 엔터프라이즈형 전환 구조        |
| Infra | Docker, AWS EC2, GitHub Actions | CI/CD 및 배포 자동화 구성 예정  |

---

## 🧩 개발 로드맵

| 목표                            | 상태      |
| ------------------------------- | --------- |
| Next.js 프론트엔드 완성         | 진행중    |
| NestJS 백엔드 구축 (JWT + CRUD) | 진행 예정 |
| Spring Boot 전환 및 구조 비교   | 예정      |
| Docker 기반 CI/CD + AWS 배포    | 예정      |

---

## 🧠 Notes

- 현재 버전은 **프론트엔드 중심 프로토타입**입니다.
- 향후 버전에서는 API 연동 및 데이터 모델이 추가될 예정입니다.
- 백엔드 구조는 **NestJS와 Spring Boot 병행 개발**로 관리됩니다.
- 모노레포 구조로 구성되어 있으며, 각각의 서비스는 독립적으로 실행 가능합니다.

---

## 🧩 Naming

> **Reelink** = _Reel (Film Strip)_ 🎞️ + _Link (Connection)_ 🔗  
> 영화를 매개로 한 **사용자 간 연결, 그리고 취향의 연결**을 의미합니다.

---

## 📄 License

MIT License  
© 2025. 상훈 박 (SH)
