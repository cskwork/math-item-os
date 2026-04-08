// 품질 메트릭 대시보드 서비스 - 문항 현황, 상태별 분포, 메타데이터 완전성, CAS 통과율
// Redis 캐싱 적용 (60초 TTL)
import { prisma } from "@math-item-os/db";
import type { QualityStatus } from "@math-item-os/db";
import { cacheGetOrSet, CACHE_TTL, CACHE_PREFIX } from "./cache.service";

interface QualityMetricsResult {
  readonly totalItems: number;
  readonly byStatus: Record<string, number>;
  readonly metadataCompleteness: number;
  readonly avgDifficulty: number;
  readonly recentActivity: readonly {
    id: string;
    tableName: string;
    action: string;
    performedBy: string;
    createdAt: Date;
  }[];
  readonly pendingReviews: number;
  readonly generatedItemPassRate: number;
}

/** 품질 KPI 대시보드 데이터 조회 (캐시: 60초) */
export async function getQualityMetrics(
  orgId: string,
): Promise<QualityMetricsResult> {
  const cacheKey = `${CACHE_PREFIX.METRICS}${orgId}`;
  return cacheGetOrSet(cacheKey, CACHE_TTL.QUALITY_METRICS, () =>
    fetchQualityMetrics(orgId),
  );
}

/** 실제 품질 메트릭 조회 (캐시 미스 시 실행) */
async function fetchQualityMetrics(
  orgId: string,
): Promise<QualityMetricsResult> {
  const [
    totalItems,
    statusCounts,
    metadataStats,
    difficultyStats,
    recentActivity,
    pendingReviews,
    generatedStats,
  ] = await Promise.all([
    // 총 문항 수
    prisma.item.count({ where: { orgId } }),

    // 상태별 문항 수
    prisma.item.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { id: true },
    }),

    // 메타데이터 완전성: 스킬, 성취기준, 난이도 모두 있는 문항 비율
    Promise.all([
      prisma.item.count({ where: { orgId } }),
      prisma.item.count({
        where: {
          orgId,
          difficultyAuthor: { not: null },
          skills: { some: {} },
          standards: { some: {} },
        },
      }),
    ]),

    // 평균 난이도
    prisma.item.aggregate({
      where: { orgId, difficultyAuthor: { not: null } },
      _avg: { difficultyAuthor: true },
    }),

    // 최근 활동 (10건)
    prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        tableName: true,
        action: true,
        performedBy: true,
        createdAt: true,
      },
    }),

    // 검수 대기 수 (draft + reviewed)
    prisma.item.count({
      where: {
        orgId,
        status: { in: ["draft", "reviewed"] as QualityStatus[] },
      },
    }),

    // AI 생성 문항 CAS 통과율
    Promise.all([
      prisma.item.count({
        where: { orgId, isGenerated: true },
      }),
      prisma.item.count({
        where: {
          orgId,
          isGenerated: true,
          status: { in: ["reviewed", "approved"] as QualityStatus[] },
        },
      }),
    ]),
  ]);

  // 상태별 분포 매핑
  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    byStatus[row.status] = row._count.id;
  }

  // 메타데이터 완전성 계산
  const [totalForMeta, completeCount] = metadataStats;
  const metadataCompleteness =
    totalForMeta > 0 ? Math.round((completeCount / totalForMeta) * 100) : 0;

  // CAS 통과율 계산
  const [totalGenerated, passedGenerated] = generatedStats;
  const generatedItemPassRate =
    totalGenerated > 0
      ? Math.round((passedGenerated / totalGenerated) * 100)
      : 0;

  return {
    totalItems,
    byStatus,
    metadataCompleteness,
    avgDifficulty: difficultyStats._avg.difficultyAuthor ?? 0,
    recentActivity,
    pendingReviews,
    generatedItemPassRate,
  };
}
