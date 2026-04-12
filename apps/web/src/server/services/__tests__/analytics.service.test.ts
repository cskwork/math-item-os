// 분석 서비스 단위 테스트 - 순수 함수 + Prisma mock DB 연동 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { computeMedian } from "../analytics.service";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

vi.mock("@math-item-os/db", () => ({
  prisma: {
    studentSession: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    assignment: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@math-item-os/shared/constants/index", () => ({
  TYPE_LEVEL: {
    1: { label: "계산" },
    2: { label: "이해" },
    3: { label: "추론" },
    99: undefined, // label이 없는 경우
  },
}));

describe("computeMedian", () => {
  it("홀수 개: [1, 3, 5] -> 3", () => {
    expect(computeMedian([1, 3, 5])).toBe(3);
  });

  it("짝수 개: [1, 2, 3, 4] -> 2.5", () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it("단일 값: [7] -> 7", () => {
    expect(computeMedian([7])).toBe(7);
  });

  it("빈 배열: [] -> 0", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("정렬되지 않은 배열도 올바르게 처리: [5, 1, 3] -> 3", () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
  });

  it("정렬되지 않은 짝수 개: [4, 1, 3, 2] -> 2.5", () => {
    expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
  });

  it("동일한 값들: [5, 5, 5] -> 5", () => {
    expect(computeMedian([5, 5, 5])).toBe(5);
  });

  it("소수점 값: [1.5, 2.5, 3.5] -> 2.5", () => {
    expect(computeMedian([1.5, 2.5, 3.5])).toBe(2.5);
  });

  it("두 개 값: [10, 20] -> 15", () => {
    expect(computeMedian([10, 20])).toBe(15);
  });

  it("원본 배열을 변경하지 않는다 (immutability)", () => {
    const original = [3, 1, 2];
    computeMedian(original);
    expect(original).toEqual([3, 1, 2]);
  });
});

// ─────────────────────────────────────────────
// getAssignmentAnalytics
// ─────────────────────────────────────────────

describe("getAssignmentAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("채점 세션이 없으면 모든 통계가 0인 기본 결과를 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getAssignmentAnalytics } = await import("../analytics.service");
    const result = await getAssignmentAnalytics("asgn-1", "org-1");

    expect(result).toEqual({
      assignmentId: "asgn-1",
      sessionCount: 0,
      avgScore: 0,
      medianScore: 0,
      minScore: 0,
      maxScore: 0,
      typeLevelStats: [],
    });
  });

  it("채점 세션이 있으면 점수 통계와 typeLevel 분석을 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { totalScore: 80, maxScore: 100 },
      { totalScore: 60, maxScore: 100 },
      { totalScore: 90, maxScore: 100 },
    ]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 1, totalCount: 10, correctCount: 8 },
    ]);

    const { getAssignmentAnalytics } = await import("../analytics.service");
    const result = await getAssignmentAnalytics("asgn-2", "org-1");

    expect(result.sessionCount).toBe(3);
    expect(result.avgScore).toBeCloseTo(76.7, 0);
    expect(result.medianScore).toBe(80);
    expect(result.minScore).toBe(60);
    expect(result.maxScore).toBe(90);
    expect(result.typeLevelStats).toHaveLength(1);
  });

  it("maxScore가 0인 세션은 0점으로 처리한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { totalScore: 50, maxScore: 0 },
    ]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getAssignmentAnalytics } = await import("../analytics.service");
    const result = await getAssignmentAnalytics("asgn-3", "org-1");

    expect(result.avgScore).toBe(0);
    expect(result.sessionCount).toBe(1);
  });

  it("totalScore/maxScore가 null인 세션을 처리한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { totalScore: null, maxScore: null },
      { totalScore: 100, maxScore: 100 },
    ]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getAssignmentAnalytics } = await import("../analytics.service");
    const result = await getAssignmentAnalytics("asgn-4", "org-1");

    // null totalScore -> 0, null maxScore -> 1
    expect(result.sessionCount).toBe(2);
  });
});

// ─────────────────────────────────────────────
// getWeakTypes
// ─────────────────────────────────────────────

describe("getWeakTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("threshold 미만인 typeLevel만 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 1, totalCount: 10, correctCount: 8 }, // 0.8
      { typeLevel: 2, totalCount: 10, correctCount: 3 }, // 0.3
      { typeLevel: 3, totalCount: 10, correctCount: 5 }, // 0.5
    ]);

    const { getWeakTypes } = await import("../analytics.service");
    const result = await getWeakTypes("asgn-1", "org-1", 0.6);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.typeLevel)).toEqual([2, 3]);
  });

  it("모든 typeLevel이 threshold 이상이면 빈 배열을 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 1, totalCount: 10, correctCount: 9 },
    ]);

    const { getWeakTypes } = await import("../analytics.service");
    const result = await getWeakTypes("asgn-1", "org-1", 0.5);

    expect(result).toHaveLength(0);
  });

  it("totalCount가 0이면 correctRate=0으로 계산된다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 1, totalCount: 0, correctCount: 0 },
    ]);

    const { getWeakTypes } = await import("../analytics.service");
    const result = await getWeakTypes("asgn-1", "org-1", 0.5);

    expect(result).toHaveLength(1);
    expect(result[0]!.correctRate).toBe(0);
  });
});

// ─────────────────────────────────────────────
// getStudentWeaknessProfile
// ─────────────────────────────────────────────

describe("getStudentWeaknessProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("세션이 존재하지 않으면 NOT_FOUND를 던진다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { getStudentWeaknessProfile } = await import("../analytics.service");

    await expect(
      getStudentWeaknessProfile("nonexistent", "org-1"),
    ).rejects.toThrow(TRPCError);
  });

  it("채점되지 않은 세션이면 BAD_REQUEST를 던진다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess-1",
      studentName: "Alice",
      totalScore: null,
      maxScore: null,
      status: "submitted",
    });

    const { getStudentWeaknessProfile } = await import("../analytics.service");

    await expect(
      getStudentWeaknessProfile("sess-1", "org-1"),
    ).rejects.toThrow("채점이 완료된 세션에서만");
  });

  it("채점된 세션의 약점 프로필을 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess-1",
      studentName: "Alice",
      totalScore: 60,
      maxScore: 100,
      status: "graded",
    });

    // typeLevel별 raw rows
    const queryRawMock = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    queryRawMock
      .mockResolvedValueOnce([
        // typeLevelRows
        { typeLevel: 1, totalCount: 5, correctCount: 4 },  // 0.8 -> not weak
        { typeLevel: 2, totalCount: 5, correctCount: 2 },  // 0.4 -> weak
      ])
      .mockResolvedValueOnce([
        // skillRows
        { skillId: "sk-1", title: "덧셈", totalCount: 3, correctCount: 3 }, // 1.0 -> not weak
        { skillId: "sk-2", title: "뺄셈", totalCount: 3, correctCount: 1 }, // 0.33 -> weak
      ]);

    const { getStudentWeaknessProfile } = await import("../analytics.service");
    const result = await getStudentWeaknessProfile("sess-1", "org-1");

    expect(result.sessionId).toBe("sess-1");
    expect(result.studentName).toBe("Alice");
    expect(result.totalScore).toBe(60);
    expect(result.maxScore).toBe(100);
    expect(result.weakTypeLevels).toHaveLength(1);
    expect(result.weakTypeLevels[0]!.typeLevel).toBe(2);
    expect(result.weakSkills).toHaveLength(1);
    expect(result.weakSkills[0]!.skillId).toBe("sk-2");
  });

  it("totalScore/maxScore가 null인 세션을 올바르게 처리한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.studentSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sess-2",
      studentName: "Bob",
      totalScore: null,
      maxScore: null,
      status: "graded",
    });
    (prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { getStudentWeaknessProfile } = await import("../analytics.service");
    const result = await getStudentWeaknessProfile("sess-2", "org-1");

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(0);
  });
});

// ─────────────────────────────────────────────
// getAssignmentTrends
// ─────────────────────────────────────────────

describe("getAssignmentTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("여러 과제의 타입별 분석을 한 번에 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "asgn-1", title: "과제 1" },
      { id: "asgn-2", title: "과제 2" },
    ]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ typeLevel: 1, totalCount: 5, correctCount: 4 }])
      .mockResolvedValueOnce([{ typeLevel: 2, totalCount: 3, correctCount: 1 }]);

    const { getAssignmentTrends } = await import("../analytics.service");
    const result = await getAssignmentTrends(["asgn-1", "asgn-2"], "org-1");

    expect(result).toHaveLength(2);
    expect(result[0]!.title).toBe("과제 1");
    expect(result[0]!.typeLevelStats).toHaveLength(1);
    expect(result[1]!.title).toBe("과제 2");
  });

  it("빈 과제 ID 배열이면 빈 결과를 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getAssignmentTrends } = await import("../analytics.service");
    const result = await getAssignmentTrends([], "org-1");

    expect(result).toEqual([]);
  });

  it("DB에 없는 과제 ID는 ID 자체를 제목으로 사용한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.assignment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { getAssignmentTrends } = await import("../analytics.service");
    const result = await getAssignmentTrends(["unknown-id"], "org-1");

    expect(result[0]!.title).toBe("unknown-id");
  });
});

// ─────────────────────────────────────────────
// mapToTypeLevelStats (via getTypeLevelAnalytics)
// ─────────────────────────────────────────────

describe("getTypeLevelAnalytics - mapToTypeLevelStats 매핑", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TYPE_LEVEL 상수에 없는 typeLevel은 기본 라벨을 생성한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 99, totalCount: 5, correctCount: 3 },
    ]);

    const { getTypeLevelAnalytics } = await import("../analytics.service");
    const result = await getTypeLevelAnalytics("asgn-1", "org-1");

    expect(result[0]!.label).toBe("유형99");
    expect(result[0]!.correctRate).toBeCloseTo(0.6);
  });

  it("bigint totalCount/correctCount를 올바르게 Number로 변환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { typeLevel: 1, totalCount: BigInt(10), correctCount: BigInt(7) },
    ]);

    const { getTypeLevelAnalytics } = await import("../analytics.service");
    const result = await getTypeLevelAnalytics("asgn-1", "org-1");

    expect(result[0]!.totalCount).toBe(10);
    expect(result[0]!.correctCount).toBe(7);
    expect(result[0]!.correctRate).toBeCloseTo(0.7);
  });
});
