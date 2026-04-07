# Research: Math Knowledge Graph + Item OS

**Date**: 2026-04-07 | **Branch**: `002-math-item-os`

## Overview

Technical Context의 모든 항목이 사전 결정되어 NEEDS CLARIFICATION 항목 없음.
기존 `docs/plan.md`에서 3가지 대안을 평가하여 대안 A(Full-stack TypeScript + Python AI)를
선택한 결과를 재정리한다.

---

## Decision 1: Tech Stack

**Decision**: Full-stack TypeScript + Python AI 마이크로서비스 (대안 A)

**Rationale**:
- 1-2명 팀에 최적화된 T3 Stack (create-t3-app, 28.5K stars)
- tRPC로 FE/BE 타입 공유, 별도 API 스키마 관리 불필요
- Node.js 배치 처리 제약은 Python 서비스 분리로 해결
- 초기 인프라 비용 $75-135/월 (Supabase + Vercel + Meilisearch)

**Alternatives Considered**:
- **대안 B (Python FastAPI + Neo4j)**: SymPy 생태계 장점, 그래프 DB 네이티브. BUT pyhwp AGPL, Neo4j GPL 라이선스 문제. FE/BE 타입 공유 불편. 2개 언어 관리 부담.
- **대안 C (Spring Boot + Kotlin)**: 대규모 확장성 최고, hwplib Java 통합 용이. BUT 최소 3-5명 팀 필요, 초기 비용 최고, 개발 속도 느림.

---

## Decision 2: CAS Engine

**Decision**: SymPy 1.13 (Python FastAPI 마이크로서비스)

**Rationale**:
- 수학 교육 분야에서 가장 많이 사용되는 오픈소스 CAS
- 수식 정규화, 동치 판별(equals), 자동 풀이(solve), AST 비교 모두 지원
- STACK(Moodle), examgen, OATutor 등 교육 플랫폼에서 검증됨
- Python 기반으로 SymPy + Claude API + embedding 모두 한 서비스에서 처리

**Alternatives Considered**:
- **Z3 (SMT Solver)**: 형식 검증에 강하나 수학 교육용 수식 조작 기능 부족. 보조 도구로 Phase 3에서 검토.
- **Maxima/SageMath**: SymPy 대비 설치/배포 복잡. 마이크로서비스 컨테이너화 어려움.
- **mathjs (JavaScript)**: Node.js 네이티브로 별도 서비스 불필요. BUT 심볼릭 연산 기능 제한적, AST 비교/동치 판별 부족.

---

## Decision 3: Search Engine

**Decision**: Meilisearch 1.12

**Rationale**:
- 한국어 CJK 토크나이저 내장 (별도 형태소 분석기 불필요)
- 설치 및 운영 간단 (단일 바이너리)
- 속도: 50ms 이하 응답 (80K 문항 규모)
- Faceted search로 구조 필터(학년/난이도/유형) 자연 지원
- 클라우드 호스팅 $30/월

**Alternatives Considered**:
- **Elasticsearch**: 기능 풍부, BUT 리소스 과다 (1-2인 팀에 과도), 한국어 nori 플러그인 별도 설치 필요.
- **Typesense**: Meilisearch와 유사, BUT CJK 지원이 상대적으로 미성숙.
- **PostgreSQL pg_trgm only**: 추가 인프라 없음. BUT 80K+ 문항 전문 검색 성능 불충분, faceted search 미지원.

---

## Decision 4: Database + Vector Search

**Decision**: PostgreSQL 17 + pgvector(HNSW) + ltree

**Rationale**:
- 단일 DB로 RDBMS + 벡터 검색 + 계층 구조 모두 처리
- pgvector HNSW: 768차원 임베딩 코사인 유사도, 80K 규모에서 충분한 성능
- ltree: 교육과정 계층 분류(대단원.중단원.소단원) 자연 표현
- Supabase 호스팅으로 관리 부담 최소화
- Prisma 6.x ORM으로 TypeScript 타입 안전 보장

**Alternatives Considered**:
- **Neo4j**: 그래프 순회 최적. BUT 추가 DB 운영 부담, GPL 라이선스, 작은 규모에서 PostgreSQL recursive CTE로 충분.
- **MongoDB**: 스키마 유연. BUT 관계형 데이터(M:N 연결 테이블 다수)에 비효율적.
- **Pinecone/Weaviate (전용 벡터 DB)**: 벡터 검색 특화. BUT 80K 규모에서 pgvector로 충분, 추가 인프라 비용/복잡도.

---

## Decision 5: Authentication + RBAC

**Decision**: Auth.js v5 + 3역할 RBAC

**Rationale**:
- Next.js 15 네이티브 통합 (App Router + Server Components)
- Prisma adapter로 DB 기반 세션/사용자 관리
- OAuth(Google) + 향후 Naver/Kakao 확장 용이
- 3역할(시스템 관리자, 콘텐츠 검수자, 교사): MVP에서는 관리자+검수자 중심

**Alternatives Considered**:
- **Clerk/Auth0**: 관리형 인증. BUT 비용 증가, 벤더 종속.
- **Supabase Auth**: Supabase 생태계 통합. BUT Auth.js 대비 커스터마이징 제한적.

---

## Decision 6: Math Rendering

**Decision**: KaTeX 0.16 (서버/클라이언트 이중 렌더링) + MathML

**Rationale**:
- MathJax 대비 10x 빠른 렌더링 속도
- 서버사이드 렌더링 지원 (Next.js RSC와 호환)
- MathML 출력 옵션으로 접근성(스크린리더) 준수
- 크기 작음 (~100KB vs MathJax ~400KB)

**Alternatives Considered**:
- **MathJax 3**: 더 넓은 LaTeX 커버리지. BUT 렌더링 느림, 번들 크기 큼. 80K 문항 목록에서 성능 문제.

---

## Decision 7: HWP Parsing

**Decision**: hwpjs (Rust core, MIT license)

**Rationale**:
- MIT 라이선스 (상업 사용 자유)
- Rust 코어로 파싱 성능 우수
- WASM 빌드 가능 (Node.js + 브라우저 양쪽 사용 가능)

**Alternatives Considered**:
- **pyhwp**: AGPL v3 라이선스로 상업 프로젝트 부적합.
- **hwplib (Java)**: Java 의존성 추가 필요.

---

## Decision 8: Misconception Taxonomy

**Decision**: 수학교육 연구 기반 사전 정의 목록 + 검수자 확장

**Rationale** (Clarification Q3 결과):
- 수학 오개념은 교육학 연구에서 잘 정리된 영역 (부호 이동 오류, 분배법칙 누락 등)
- MVP에서 빠른 시작을 위해 사전 목록 제공
- 현장 운영 중 발견되는 오개념은 검수자가 추가/수정

**초기 데이터 소스**:
- Ryan & Williams (2007) "Children's Mathematics 4-15"
- Booth et al. (2014) algebra misconceptions taxonomy
- 한국수학교육학회 오류 유형 분류
- AI Hub 수학문제 데이터셋 오류 분석

---

## Decision 9: Difficulty Scale

**Decision**: 5단계 정수 (1=매우 쉬움 ~ 5=매우 어려움), 검수자 수동 설정

**Rationale** (Clarification Q5 결과):
- MVP에서 학생 응답 데이터 없어 IRT 불가
- 이산적 레벨이 검색 필터링에 직관적
- 향후 행동 데이터 축적 시 `difficulty_profile` 테이블의 IRT 컬럼으로 보정 추가

---

## Decision 10: Quality State Machine

**Decision**: 역전이 허용 (approved -> draft)

**Rationale** (Clarification Q4 결과):
- 승인 후 오류 발견 시 draft로 되돌려 수정 필요
- 검수자: draft <-> reviewed <-> approved 전이
- 관리자: retired 전이 + 모든 역전이 승인

```
draft --[검수자]--> reviewed --[검수자]--> approved --[관리자]--> retired
  ^                                          |
  |______________[관리자 승인]________________|
```
