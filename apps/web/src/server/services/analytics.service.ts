// 성과 분석 서비스 - 과제별 통계, typeLevel 분석, 학생 약점 프로필
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import { TYPE_LEVEL } from "@math-item-os/shared/constants/index";
import type {
  TypeLevelStat,
  AssignmentAnalytics,
  StudentWeaknessProfile,
} from "@math-item-os/shared/types/index";

// -------------------------------------------------
// 타입 정의 (raw SQL 결과)
// -------------------------------------------------

/** typeLevel별 집계 raw 결과 */
interface RawTypeLevelRow {
  readonly typeLevel: number;
  readonly totalCount: number;
  readonly correctCount: number;
}

/** 스킬별 집계 raw 결과 */
interface RawSkillRow {
  readonly skillId: string;
  readonly title: string;
  readonly totalCount: number;
  readonly correctCount: number;
}

/** 과제 트렌드 결과 */
export interface AssignmentTrend {
  readonly assignmentId: string;
  readonly title: string;
  readonly typeLevelStats: ReadonlyArray<TypeLevelStat>;
}

// -------------------------------------------------
// 헬퍼: 중앙값 계산
// -------------------------------------------------

/** 정렬된 숫자 배열의 중앙값을 구한다. 빈 배열이면 0을 반환. */
export function computeMedian(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

// -------------------------------------------------
// 헬퍼: raw 결과 -> TypeLevelStat 매핑
// -------------------------------------------------

/** raw SQL 결과를 TypeLevelStat[]로 변환. TYPE_LEVEL 상수에서 라벨을 가져온다. */
function mapToTypeLevelStats(
  rows: ReadonlyArray<RawTypeLevelRow>,
): ReadonlyArray<TypeLevelStat> {
  return rows.map((row) => {
    const typeLevelKey = row.typeLevel as keyof typeof TYPE_LEVEL;
    const entry = TYPE_LEVEL[typeLevelKey];
    const label = entry?.label ?? `유형${row.typeLevel}`;
    const totalCount = Number(row.totalCount);
    const correctCount = Number(row.correctCount);
    const correctRate = totalCount > 0 ? correctCount / totalCount : 0;

    return {
      typeLevel: row.typeLevel,
      label,
      totalCount,
      correctCount,
      correctRate,
    };
  });
}

// -------------------------------------------------
// 1. typeLevel별 분석
// -------------------------------------------------

/**
 * 과제의 채점 완료된 세션들에 대해 typeLevel별 정답률을 집계한다.
 * 문항 -> 주요 스킬 -> typeLevel 경로로 조인.
 */
export async function getTypeLevelAnalytics(
  assignmentId: string,
  _orgId: string,
): Promise<ReadonlyArray<TypeLevelStat>> {
  const rows = await prisma.$queryRaw<ReadonlyArray<RawTypeLevelRow>>`
    SELECT
      s."typeLevel" AS "typeLevel",
      COUNT(*)::int AS "totalCount",
      COUNT(*) FILTER (WHERE sr.result = 'correct')::int AS "correctCount"
    FROM student_responses sr
    JOIN assignment_items ai ON sr."assignmentItemId" = ai.id
    JOIN items i ON ai."itemId" = i.id
    JOIN item_skills isk ON i.id = isk."itemId" AND isk."isPrimary" = true
    JOIN skills s ON isk."skillId" = s.id
    WHERE sr."sessionId" IN (
      SELECT id FROM student_sessions
      WHERE "assignmentId" = ${assignmentId} AND status = 'graded'
    )
    AND s."typeLevel" IS NOT NULL
    GROUP BY s."typeLevel"
    ORDER BY s."typeLevel"
  `;

  return mapToTypeLevelStats(rows);
}

// -------------------------------------------------
// 2. 과제 전체 통계
// -------------------------------------------------

/**
 * 과제의 전체 통계를 집계한다.
 * 채점 완료된 세션의 점수 분포 + typeLevel별 분석을 반환.
 */
export async function getAssignmentAnalytics(
  assignmentId: string,
  orgId: string,
): Promise<AssignmentAnalytics> {
  // 채점 완료된 세션의 점수 조회
  const sessions = await prisma.studentSession.findMany({
    where: {
      assignmentId,
      status: "graded",
    },
    select: {
      totalScore: true,
      maxScore: true,
    },
  });

  if (sessions.length === 0) {
    return {
      assignmentId,
      sessionCount: 0,
      avgScore: 0,
      medianScore: 0,
      minScore: 0,
      maxScore: 0,
      typeLevelStats: [],
    };
  }

  // 점수를 퍼센트(100점 기준)로 변환
  const scores = sessions.map((s) => {
    const total = s.totalScore != null ? Number(s.totalScore) : 0;
    const max = s.maxScore != null ? Number(s.maxScore) : 1;
    return max > 0 ? (total / max) * 100 : 0;
  });

  const sum = scores.reduce((acc, v) => acc + v, 0);
  const avgScore = Math.round((sum / scores.length) * 10) / 10;
  const medianScore = Math.round(computeMedian(scores) * 10) / 10;
  const minScore = Math.round(Math.min(...scores) * 10) / 10;
  const maxScore = Math.round(Math.max(...scores) * 10) / 10;

  // typeLevel별 분석
  const typeLevelStats = await getTypeLevelAnalytics(assignmentId, orgId);

  return {
    assignmentId,
    sessionCount: sessions.length,
    avgScore,
    medianScore,
    minScore,
    maxScore,
    typeLevelStats: typeLevelStats as TypeLevelStat[],
  };
}

// -------------------------------------------------
// 3. 취약 유형 추출
// -------------------------------------------------

/**
 * 정답률이 threshold 미만인 typeLevel을 필터링하여 반환한다.
 */
export async function getWeakTypes(
  assignmentId: string,
  orgId: string,
  threshold: number,
): Promise<ReadonlyArray<TypeLevelStat>> {
  const stats = await getTypeLevelAnalytics(assignmentId, orgId);
  return stats.filter((s) => s.correctRate < threshold);
}

// -------------------------------------------------
// 4. 학생 약점 프로필
// -------------------------------------------------

/**
 * 개별 학생 세션의 약점 프로필을 분석한다.
 * typeLevel별 정답률 + 스킬별 정답률을 반환.
 */
export async function getStudentWeaknessProfile(
  sessionId: string,
  _orgId: string,
): Promise<StudentWeaknessProfile> {
  // 세션 기본 정보 조회
  const session = await prisma.studentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      studentName: true,
      totalScore: true,
      maxScore: true,
      status: true,
    },
  });

  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `풀이 세션을 찾을 수 없습니다: ${sessionId}`,
    });
  }

  if (session.status !== "graded") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "채점이 완료된 세션에서만 약점 분석이 가능합니다",
    });
  }

  // typeLevel별 집계 (단일 세션)
  const typeLevelRows = await prisma.$queryRaw<ReadonlyArray<RawTypeLevelRow>>`
    SELECT
      s."typeLevel" AS "typeLevel",
      COUNT(*)::int AS "totalCount",
      COUNT(*) FILTER (WHERE sr.result = 'correct')::int AS "correctCount"
    FROM student_responses sr
    JOIN assignment_items ai ON sr."assignmentItemId" = ai.id
    JOIN items i ON ai."itemId" = i.id
    JOIN item_skills isk ON i.id = isk."itemId" AND isk."isPrimary" = true
    JOIN skills s ON isk."skillId" = s.id
    WHERE sr."sessionId" = ${sessionId}
    AND s."typeLevel" IS NOT NULL
    GROUP BY s."typeLevel"
    ORDER BY s."typeLevel"
  `;

  // 스킬별 집계 (단일 세션)
  const skillRows = await prisma.$queryRaw<ReadonlyArray<RawSkillRow>>`
    SELECT
      s.id AS "skillId",
      s.title,
      COUNT(*)::int AS "totalCount",
      COUNT(*) FILTER (WHERE sr.result = 'correct')::int AS "correctCount"
    FROM student_responses sr
    JOIN assignment_items ai ON sr."assignmentItemId" = ai.id
    JOIN items i ON ai."itemId" = i.id
    JOIN item_skills isk ON i.id = isk."itemId" AND isk."isPrimary" = true
    JOIN skills s ON isk."skillId" = s.id
    WHERE sr."sessionId" = ${sessionId}
    GROUP BY s.id, s.title
    ORDER BY s.title
  `;

  const typeLevelStats = mapToTypeLevelStats(typeLevelRows);
  // 정답률 60% 미만인 typeLevel만 약점으로 분류
  const weakTypeLevels = typeLevelStats.filter((s) => s.correctRate < 0.6);

  // 정답률 60% 미만인 스킬만 약점으로 분류
  const weakSkills = skillRows
    .map((row) => {
      const totalCount = Number(row.totalCount);
      const correctCount = Number(row.correctCount);
      const correctRate = totalCount > 0 ? correctCount / totalCount : 0;
      return {
        skillId: row.skillId,
        title: row.title,
        correctRate,
      };
    })
    .filter((s) => s.correctRate < 0.6);

  return {
    sessionId,
    studentName: session.studentName,
    totalScore: session.totalScore != null ? Number(session.totalScore) : 0,
    maxScore: session.maxScore != null ? Number(session.maxScore) : 0,
    weakTypeLevels: weakTypeLevels as TypeLevelStat[],
    weakSkills,
  };
}

// -------------------------------------------------
// 5. 과제 트렌드 분석
// -------------------------------------------------

/**
 * 여러 과제의 typeLevel별 분석을 한번에 조회한다.
 * 과제 간 추세 비교에 사용.
 */
export async function getAssignmentTrends(
  assignmentIds: ReadonlyArray<string>,
  orgId: string,
): Promise<ReadonlyArray<AssignmentTrend>> {
  // 과제 제목 일괄 조회
  const assignments = await prisma.assignment.findMany({
    where: { id: { in: [...assignmentIds] } },
    select: { id: true, title: true },
  });

  const titleMap = new Map(assignments.map((a) => [a.id, a.title]));

  // 각 과제별 typeLevel 분석 병렬 실행
  const results = await Promise.all(
    assignmentIds.map(async (assignmentId) => {
      const typeLevelStats = await getTypeLevelAnalytics(assignmentId, orgId);
      return {
        assignmentId,
        title: titleMap.get(assignmentId) ?? assignmentId,
        typeLevelStats,
      };
    }),
  );

  return results;
}
