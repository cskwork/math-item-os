// 시드 데이터: 정보처리실기 스킬 트리 (30개)
import type { PrismaClient } from "@prisma/client";

/**
 * IT 자격증 스킬 정의.
 * typeLevel: 1=개념이해, 2=기본연산(기본 명령/구문), 3=유형적용, 4=복합적용
 */
export const IT_CERT_SKILLS = [
  // ── 프로그래밍 (8) ──
  { code: "IT-PG-001", title: "C 기본 문법과 자료형", topicPath: "it_cert.programming.c", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-PG-002", title: "C 포인터와 배열", topicPath: "it_cert.programming.c", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "IT-PG-003", title: "Java 클래스와 객체", topicPath: "it_cert.programming.java", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "IT-PG-004", title: "Java 상속과 다형성", topicPath: "it_cert.programming.java", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "IT-PG-005", title: "Python 기본 문법", topicPath: "it_cert.programming.python", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "IT-PG-006", title: "Python 리스트와 딕셔너리", topicPath: "it_cert.programming.python", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-PG-007", title: "알고리즘: 정렬과 탐색", topicPath: "it_cert.programming.algorithm", bloomLevel: 3, typeLevel: 4, estimatedTimeMin: 20 },
  { code: "IT-PG-008", title: "자료구조: 스택, 큐, 트리", topicPath: "it_cert.programming.data_structure", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 18 },

  // ── 데이터베이스 (6) ──
  { code: "IT-DB-001", title: "SQL SELECT 기본 쿼리", topicPath: "it_cert.database.sql", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-DB-002", title: "SQL JOIN과 서브쿼리", topicPath: "it_cert.database.sql", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "IT-DB-003", title: "SQL 집계함수와 GROUP BY", topicPath: "it_cert.database.sql", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "IT-DB-004", title: "DDL/DML/DCL 명령어", topicPath: "it_cert.database.sql", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-DB-005", title: "데이터 모델링과 정규화", topicPath: "it_cert.database.modeling", bloomLevel: 3, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "IT-DB-006", title: "ER 다이어그램과 관계", topicPath: "it_cert.database.modeling", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },

  // ── 네트워크 (4) ──
  { code: "IT-NW-001", title: "OSI 7계층 모델", topicPath: "it_cert.network", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 10 },
  { code: "IT-NW-002", title: "TCP/IP 프로토콜", topicPath: "it_cert.network", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "IT-NW-003", title: "IP 주소와 서브넷 마스크", topicPath: "it_cert.network", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "IT-NW-004", title: "라우팅과 스위칭", topicPath: "it_cert.network", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },

  // ── 보안 (4) ──
  { code: "IT-SC-001", title: "대칭키/비대칭키 암호화", topicPath: "it_cert.security", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-SC-002", title: "접근 제어와 인증", topicPath: "it_cert.security", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-SC-003", title: "보안 공격 유형과 대응", topicPath: "it_cert.security", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "IT-SC-004", title: "네트워크 보안 (방화벽, VPN)", topicPath: "it_cert.security", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },

  // ── 소프트웨어 공학 (8) ──
  { code: "IT-SE-001", title: "소프트웨어 개발 생명주기", topicPath: "it_cert.sw_engineering.lifecycle", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "IT-SE-002", title: "요구사항 분석과 명세", topicPath: "it_cert.sw_engineering.requirements", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-SE-003", title: "디자인 패턴 (GoF)", topicPath: "it_cert.sw_engineering.design_pattern", bloomLevel: 3, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "IT-SE-004", title: "UML 다이어그램", topicPath: "it_cert.sw_engineering.uml", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "IT-SE-005", title: "소프트웨어 테스트 기법", topicPath: "it_cert.sw_engineering.testing", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "IT-SE-006", title: "형상 관리와 버전 관리", topicPath: "it_cert.sw_engineering.config_mgmt", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 8 },
  { code: "IT-SE-007", title: "애자일과 스크럼", topicPath: "it_cert.sw_engineering.agile", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "IT-SE-008", title: "통합 테스트와 시스템 테스트", topicPath: "it_cert.sw_engineering.testing", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
] as const;

/** IT 자격증 스킬 시드 — upsert으로 멱등성 보장 */
export async function seedITCertSkills(
  prisma: PrismaClient,
  orgId: string,
): Promise<Record<string, string>> {
  const created: Record<string, string> = {};

  for (const skill of IT_CERT_SKILLS) {
    const result = await prisma.skill.upsert({
      where: { orgId_code: { orgId, code: skill.code } },
      create: {
        orgId,
        subject: "IT_CERT",
        code: skill.code,
        title: skill.title,
        topicPath: skill.topicPath,
        bloomLevel: skill.bloomLevel,
        typeLevel: skill.typeLevel,
        estimatedTimeMin: skill.estimatedTimeMin,
      },
      update: {
        subject: "IT_CERT",
        title: skill.title,
        topicPath: skill.topicPath,
        bloomLevel: skill.bloomLevel,
        typeLevel: skill.typeLevel,
        estimatedTimeMin: skill.estimatedTimeMin,
      },
      select: { id: true },
    });
    created[skill.code] = result.id;
  }

  console.log(`  ✓ IT 자격증 스킬 ${Object.keys(created).length}개 생성/갱신`);
  return created;
}
