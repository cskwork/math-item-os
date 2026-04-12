// analytics.router 통합 테스트
// 실제 Prisma + 테스트 DB로 caller 패턴 검증
// raw SQL 의존이 많아 실제 DB seed 후 집계 결과를 검증한다
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// next-auth 모듈 체인 차단
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@math-item-os/db";
import { createCallerFactory } from "../../trpc";
import { analyticsRouter } from "../analytics.router";

// -------------------------------------------------
// DB env 설정
// -------------------------------------------------
beforeAll(() => {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = testDbUrl;
  if (!process.env.DIRECT_URL) process.env.DIRECT_URL = testDbUrl;
});

// -------------------------------------------------
// caller helper
// -------------------------------------------------
const createCaller = createCallerFactory(analyticsRouter);

type Role = "admin" | "reviewer" | "teacher" | null;

function makeCaller(role: Role) {
  const session = role
    ? {
        user: {
          id: `test-analytics-router-user-${role}`,
          email: `${role}@test.local`,
          name: role,
          role,
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      }
    : null;
  return createCaller({
    prisma,
    session,
    user: session?.user ?? null,
  });
}

// -------------------------------------------------
// 시드 prefix
// -------------------------------------------------
const ORG_ID = "default-org";
const PREFIX = "test-analytics-router";

interface SeedRefs {
  assignmentId: string;
  emptySessionId: string;
}

let seeded: SeedRefs | null = null;

async function ensureOrg() {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Default Test Org", slug: ORG_ID },
  });
}

async function seed(): Promise<SeedRefs> {
  // 비어있는 graded 세션 → 집계 결과는 빈 배열이 되는 것을 검증
  const assignment = await prisma.assignment.create({
    data: {
      orgId: ORG_ID,
      title: `${PREFIX}-assignment`,
      purpose: "diagnosis",
      isPublished: true,
      solveToken: `${PREFIX}-token-${Date.now()}-${Math.random()}`,
    },
  });

  const session = await prisma.studentSession.create({
    data: {
      assignmentId: assignment.id,
      studentName: `${PREFIX}-student`,
      token: `${PREFIX}-sess-${Date.now()}-${Math.random()}`,
      status: "graded",
      gradedAt: new Date(),
      submittedAt: new Date(),
      totalScore: 80,
      maxScore: 100,
    },
  });

  return { assignmentId: assignment.id, emptySessionId: session.id };
}

async function cleanup() {
  await prisma.studentSession.deleteMany({
    where: { studentName: { startsWith: PREFIX } },
  });
  await prisma.assignment.deleteMany({
    where: { orgId: ORG_ID, title: { startsWith: PREFIX } },
  });
}

beforeEach(async () => {
  await ensureOrg();
  await cleanup();
  seeded = await seed();
});

afterEach(async () => {
  await cleanup();
  seeded = null;
});

// -------------------------------------------------
// 테스트
// -------------------------------------------------
describe("analytics.router", () => {
  it("happy path: 시드된 graded 세션 1건의 assignmentOverview를 집계한다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.assignmentOverview({
      assignmentId: seeded!.assignmentId,
    });

    expect(result.assignmentId).toBe(seeded!.assignmentId);
    expect(result.sessionCount).toBe(1);
    // 80/100 → 80%
    expect(result.avgScore).toBeCloseTo(80, 1);
    expect(result.minScore).toBeCloseTo(80, 1);
    expect(result.maxScore).toBeCloseTo(80, 1);
    expect(Array.isArray(result.typeLevelStats)).toBe(true);
  });

  it("permission rejection: 비인증 사용자가 typeLevelBreakdown 호출 시 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.typeLevelBreakdown({ assignmentId: seeded!.assignmentId }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("input validation: trends에 빈 assignmentIds 배열 전달 시 BAD_REQUEST", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.trends({ assignmentIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("weakTypes: typeLevel 데이터가 없으면 빈 배열을 반환", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.weakTypes({
      assignmentId: seeded!.assignmentId,
      threshold: 0.6,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("studentProfile: 채점 완료 세션에 대해 약점 프로필 객체를 반환", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.studentProfile({
      sessionId: seeded!.emptySessionId,
    });

    expect(result.sessionId).toBe(seeded!.emptySessionId);
    expect(result.studentName).toContain(PREFIX);
    expect(result.totalScore).toBe(80);
    expect(result.maxScore).toBe(100);
    expect(Array.isArray(result.weakTypeLevels)).toBe(true);
    expect(Array.isArray(result.weakSkills)).toBe(true);
  });
});
