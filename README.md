# Math Item OS

수학 문항 관리 시스템 - HWP 문서에서 수학 문항을 추출하고 HTML로 변환하여 관리하는 플랫폼

## 기술 스택

- **Frontend**: Next.js 15 (App Router), Tailwind CSS v4, KaTeX 0.16
- **Backend**: tRPC 11, Prisma 6, Auth.js v5
- **AI Service**: Python 3.11+, FastAPI, SymPy 1.13
- **Infra**: Docker Compose (PostgreSQL 17 + pgvector, Redis 7, Meilisearch 1.12)
- **Build**: Turborepo, pnpm 9.15

## 프로젝트 구조

```
apps/
  web/              # Next.js 15 웹 애플리케이션
packages/
  db/               # Prisma 스키마 및 DB 클라이언트
  math-parser/      # 수학 수식 파싱/렌더링
  shared/           # 공유 타입, 상수, 유효성 검증
services/
  math-ai/          # Python FastAPI + SymPy AI 서비스
```

## 시작하기

### 요구사항

- Node.js >= 20.0.0
- pnpm 9.15+
- Docker & Docker Compose
- Python 3.11+ (AI 서비스용)

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env

# 인프라 실행
docker compose up -d

# 개발 서버 실행
pnpm dev
```

### 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | 테스트 실행 |
| `pnpm lint` | 린트 검사 |
| `pnpm db:migrate` | DB 마이그레이션 |
| `pnpm db:studio` | Prisma Studio 실행 |

## Speckit 워크플로우

이 프로젝트는 Spec-Driven Development 워크플로우를 사용한다.
자세한 사용법은 [Speckit 워크플로우 가이드](docs/speckit-workflow.md)를 참고.

### 빠른 시작 (Claude Code)

| 명령어 | 설명 |
|--------|------|
| `/speckit.specify` | 새 기능 스펙 생성 |
| `/speckit.plan` | 구현 계획 생성 |
| `/speckit.tasks` | 태스크 목록 생성 |
| `/speckit.implement` | 구현 실행 |

### 수동 실행 (터미널)

```bash
# 기능 브랜치 생성
bash .specify/scripts/bash/create-new-feature.sh "기능 설명"

# 다단계 태스크 실행 (별도 터미널에서)
bash .specify/scripts/bash/execute-phases.sh --verbose
```
