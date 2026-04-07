// 시드 데이터: 스킬 간 선수학습 DAG (80개 간선)
import type { PrismaClient, EdgeStrength } from "@prisma/client";

interface EdgeDef {
  readonly from: string;
  readonly to: string;
  readonly strength: EdgeStrength;
  readonly weight: number;
}

/**
 * 선수학습 관계 정의.
 * from → to: "from을 먼저 배워야 to를 학습할 수 있다"
 * DAG 무결성 보장: 사이클 없음 (토폴로지컬 정렬 가능)
 */
export const EDGES: readonly EdgeDef[] = [
  // ── 수와 연산 내부 체인 ──
  { from: "NUM-001", to: "NUM-002", strength: "strong", weight: 1.0 },  // 정수 연산 → 혼합연산
  { from: "NUM-001", to: "NUM-003", strength: "strong", weight: 1.0 },  // 정수 연산 → 유리수 개념
  { from: "NUM-003", to: "NUM-004", strength: "strong", weight: 1.0 },  // 유리수 개념 → 유리수 연산
  { from: "NUM-001", to: "NUM-005", strength: "strong", weight: 0.8 },  // 정수 연산 → 소인수분해
  { from: "NUM-005", to: "NUM-006", strength: "strong", weight: 1.0 },  // 소인수분해 → GCD/LCM
  { from: "NUM-004", to: "NUM-007", strength: "strong", weight: 0.8 },  // 유리수 연산 → 제곱근
  { from: "NUM-007", to: "NUM-008", strength: "strong", weight: 1.0 },  // 제곱근 → 무리수/실수
  { from: "NUM-007", to: "NUM-009", strength: "strong", weight: 1.0 },  // 제곱근 → 근호 계산
  { from: "NUM-008", to: "NUM-010", strength: "strong", weight: 0.9 },  // 무리수/실수 → 실수 대소
  { from: "NUM-009", to: "NUM-010", strength: "weak", weight: 0.5 },    // 근호 계산 → 실수 대소

  // ── 문자와 식 내부 체인 ──
  { from: "EXP-001", to: "EXP-002", strength: "strong", weight: 1.0 },  // 문자 사용 → 일차식
  { from: "EXP-002", to: "EXP-003", strength: "strong", weight: 0.9 },  // 일차식 → 다항식 덧뺄
  { from: "EXP-003", to: "EXP-004", strength: "weak", weight: 0.6 },    // 다항식 덧뺄 → 지수법칙
  { from: "EXP-004", to: "EXP-005", strength: "strong", weight: 1.0 },  // 지수법칙 → 단항식 곱나눗
  { from: "EXP-005", to: "EXP-006", strength: "strong", weight: 1.0 },  // 단항식 곱나눗 → 다항식 곱셈
  { from: "EXP-006", to: "EXP-007", strength: "strong", weight: 1.0 },  // 다항식 곱셈 → 곱셈공식
  { from: "EXP-007", to: "EXP-008", strength: "strong", weight: 1.0 },  // 곱셈공식 → 인수분해
  { from: "EXP-001", to: "EXP-009", strength: "strong", weight: 0.8 },  // 문자 사용 → 등식 성질
  { from: "EXP-001", to: "EXP-010", strength: "strong", weight: 0.7 },  // 문자 사용 → 부등식 성질
  { from: "EXP-009", to: "EXP-010", strength: "weak", weight: 0.5 },    // 등식 성질 → 부등식 성질

  // ── 수와 연산 → 문자와 식 연결 ──
  { from: "NUM-001", to: "EXP-001", strength: "strong", weight: 1.0 },  // 정수 연산 → 문자 사용
  { from: "NUM-004", to: "EXP-002", strength: "strong", weight: 0.8 },  // 유리수 연산 → 일차식
  { from: "NUM-004", to: "EXP-003", strength: "weak", weight: 0.5 },    // 유리수 연산 → 다항식

  // ── 방정식 내부 체인 ──
  { from: "EQ-001", to: "EQ-002", strength: "strong", weight: 1.0 },    // 일차방정식 풀이 → 활용
  { from: "EQ-001", to: "EQ-003", strength: "strong", weight: 0.9 },    // 일차방정식 → 연립(가감법)
  { from: "EQ-001", to: "EQ-004", strength: "strong", weight: 0.9 },    // 일차방정식 → 연립(대입법)
  { from: "EQ-003", to: "EQ-005", strength: "strong", weight: 1.0 },    // 연립(가감법) → 연립 활용
  { from: "EQ-004", to: "EQ-005", strength: "strong", weight: 0.8 },    // 연립(대입법) → 연립 활용
  { from: "EQ-006", to: "EQ-008", strength: "strong", weight: 1.0 },    // 이차(인수분해) → 이차 활용
  { from: "EQ-007", to: "EQ-008", strength: "strong", weight: 1.0 },    // 이차(근의 공식) → 이차 활용
  { from: "EQ-001", to: "EQ-009", strength: "strong", weight: 0.9 },    // 일차방정식 → 일차부등식
  { from: "EQ-009", to: "EQ-010", strength: "strong", weight: 1.0 },    // 일차부등식 → 연립부등식

  // ── 문자와 식 → 방정식 연결 ──
  { from: "EXP-009", to: "EQ-001", strength: "strong", weight: 1.0 },   // 등식 성질 → 일차방정식
  { from: "EXP-002", to: "EQ-001", strength: "strong", weight: 0.9 },   // 일차식 → 일차방정식
  { from: "EXP-003", to: "EQ-003", strength: "strong", weight: 0.7 },   // 다항식 → 연립방정식
  { from: "EXP-008", to: "EQ-006", strength: "strong", weight: 1.0 },   // 인수분해 → 이차(인수분해)
  { from: "EXP-007", to: "EQ-007", strength: "strong", weight: 0.8 },   // 곱셈공식 → 이차(근의 공식)
  { from: "EXP-010", to: "EQ-009", strength: "strong", weight: 1.0 },   // 부등식 성질 → 일차부등식
  { from: "NUM-009", to: "EQ-007", strength: "weak", weight: 0.6 },     // 근호 계산 → 근의 공식

  // ── 함수 내부 체인 ──
  { from: "FN-001", to: "FN-002", strength: "strong", weight: 1.0 },    // 좌표평면 → 함수 개념
  { from: "FN-002", to: "FN-003", strength: "strong", weight: 1.0 },    // 함수 개념 → 일차함수 그래프
  { from: "FN-003", to: "FN-004", strength: "strong", weight: 1.0 },    // 일차함수 그래프 → 기울기/절편
  { from: "FN-004", to: "FN-005", strength: "strong", weight: 1.0 },    // 기울기/절편 → 일차함수-방정식 관계
  { from: "FN-004", to: "FN-006", strength: "strong", weight: 0.9 },    // 기울기/절편 → 일차함수 활용
  { from: "FN-005", to: "FN-006", strength: "weak", weight: 0.5 },      // 일차함수-방정식 → 일차함수 활용
  { from: "FN-002", to: "FN-007", strength: "strong", weight: 0.8 },    // 함수 개념 → 이차함수 기본
  { from: "FN-007", to: "FN-008", strength: "strong", weight: 1.0 },    // 이차함수 기본 → 꼭짓점 형태
  { from: "FN-008", to: "FN-009", strength: "strong", weight: 1.0 },    // 꼭짓점 → 일반형
  { from: "FN-009", to: "FN-010", strength: "strong", weight: 1.0 },    // 일반형 → 최대/최소

  // ── 방정식 → 함수 연결 ──
  { from: "EQ-001", to: "FN-005", strength: "strong", weight: 0.9 },    // 일차방정식 → 일차함수-방정식 관계
  { from: "EQ-003", to: "FN-005", strength: "weak", weight: 0.5 },      // 연립방정식 → 일차함수-방정식 관계
  { from: "EQ-006", to: "FN-007", strength: "strong", weight: 0.7 },    // 이차방정식 → 이차함수 기본
  { from: "EQ-007", to: "FN-009", strength: "weak", weight: 0.5 },      // 근의 공식 → 이차함수 일반형
  { from: "EXP-008", to: "FN-009", strength: "weak", weight: 0.5 },     // 인수분해 → 이차함수 일반형

  // ── 기하 내부 체인 ──
  { from: "GEO-001", to: "GEO-002", strength: "strong", weight: 1.0 },  // 기본도형 → 평행선
  { from: "GEO-001", to: "GEO-003", strength: "strong", weight: 1.0 },  // 기본도형 → 작도/합동
  { from: "GEO-002", to: "GEO-004", strength: "strong", weight: 0.8 },  // 평행선 → 삼각형 성질
  { from: "GEO-003", to: "GEO-005", strength: "strong", weight: 1.0 },  // 작도/합동 → 삼각형 합동
  { from: "GEO-004", to: "GEO-005", strength: "strong", weight: 0.9 },  // 삼각형 성질 → 삼각형 합동
  { from: "GEO-004", to: "GEO-006", strength: "strong", weight: 0.8 },  // 삼각형 성질 → 사각형 성질
  { from: "GEO-005", to: "GEO-007", strength: "strong", weight: 1.0 },  // 삼각형 합동 → 닮음
  { from: "GEO-007", to: "GEO-008", strength: "strong", weight: 1.0 },  // 닮음 → 닮음 활용
  { from: "GEO-004", to: "GEO-009", strength: "strong", weight: 0.9 },  // 삼각형 성질 → 피타고라스
  { from: "GEO-009", to: "GEO-010", strength: "strong", weight: 1.0 },  // 피타고라스 → 피타고라스 활용

  // ── 수와 연산 → 기하 연결 ──
  { from: "NUM-007", to: "GEO-009", strength: "strong", weight: 0.7 },  // 제곱근 → 피타고라스
  { from: "NUM-009", to: "GEO-010", strength: "weak", weight: 0.5 },    // 근호 계산 → 피타고라스 활용

  // ── 함수 → 기하 연결 ──
  { from: "FN-001", to: "GEO-001", strength: "weak", weight: 0.4 },     // 좌표평면 → 기본도형
  { from: "GEO-007", to: "FN-007", strength: "weak", weight: 0.4 },     // 닮음 → 이차함수 기본(비례 개념)

  // ── 교차 영역 보강 간선 ──
  { from: "NUM-006", to: "EXP-003", strength: "weak", weight: 0.4 },    // GCD/LCM → 다항식 덧뺄
  { from: "NUM-002", to: "EXP-009", strength: "weak", weight: 0.5 },    // 혼합연산 → 등식 성질
  { from: "EQ-002", to: "EQ-005", strength: "weak", weight: 0.4 },      // 일차 활용 → 연립 활용
  { from: "FN-006", to: "EQ-005", strength: "weak", weight: 0.3 },      // 일차함수 활용 → 연립 활용
  { from: "GEO-006", to: "GEO-007", strength: "weak", weight: 0.5 },    // 사각형 → 닮음
  { from: "GEO-002", to: "GEO-007", strength: "weak", weight: 0.5 },    // 평행선 → 닮음
  { from: "GEO-008", to: "GEO-010", strength: "weak", weight: 0.4 },    // 닮음 활용 → 피타고라스 활용
  { from: "EQ-008", to: "FN-010", strength: "weak", weight: 0.4 },      // 이차방정식 활용 → 이차함수 최대최소
  { from: "NUM-004", to: "EXP-005", strength: "weak", weight: 0.4 },    // 유리수 연산 → 단항식 곱나눗
  { from: "EXP-006", to: "EQ-006", strength: "weak", weight: 0.5 },     // 다항식 곱셈 → 이차방정식(인수분해)
  { from: "FN-003", to: "FN-006", strength: "weak", weight: 0.4 },      // 일차함수 그래프 → 일차함수 활용
  { from: "GEO-003", to: "GEO-004", strength: "weak", weight: 0.5 },    // 작도/합동 → 삼각형 성질
];

/** 선수학습 간선 80개 시드 (멱등) */
export async function seedEdges(
  prisma: PrismaClient,
  orgId: string,
  skillIds: Record<string, string>,
) {
  let count = 0;

  for (const e of EDGES) {
    const fromSkillId = skillIds[e.from];
    const toSkillId = skillIds[e.to];

    if (!fromSkillId || !toSkillId) {
      console.warn(`  [경고] 스킬 코드 미발견: ${e.from} → ${e.to}`);
      continue;
    }

    await prisma.prerequisiteEdge.upsert({
      where: {
        orgId_fromSkillId_toSkillId: { orgId, fromSkillId, toSkillId },
      },
      update: { strength: e.strength, weight: e.weight },
      create: {
        orgId,
        fromSkillId,
        toSkillId,
        strength: e.strength,
        weight: e.weight,
      },
    });
    count++;
  }

  console.log(`  [선수학습 간선] ${count}개 생성/갱신`);
}
