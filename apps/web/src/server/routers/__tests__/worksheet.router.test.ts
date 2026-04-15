// worksheet.router 통합 테스트
// 실제 Prisma + 테스트 DB로 caller 패턴 검증
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// next-auth 모듈 체인 차단
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// 유사 문항 검색은 외부 의존(임베딩) 회피 위해 빈 배열로 stub
vi.mock("../../services/similarity.service", () => ({
  findSimilarItems: vi.fn().mockResolvedValue([]),
}));

import { prisma } from "@math-item-os/db";
import { createCallerFactory } from "../../trpc";
import { worksheetRouter } from "../worksheet.router";

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
const createCaller = createCallerFactory(worksheetRouter);

type Role = "admin" | "reviewer" | "teacher" | null;

function makeCaller(role: Role) {
  const session = role
    ? {
        user: {
          id: `test-worksheet-router-user-${role}`,
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
const PREFIX = "test-worksheet-router";

interface SeedRefs {
  assignmentId: string;
  sessionId: string;
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
  // Assignment
  const assignment = await prisma.assignment.create({
    data: {
      orgId: ORG_ID,
      title: `${PREFIX}-assignment`,
      purpose: "diagnosis",
      isPublished: true,
      solveToken: `${PREFIX}-token-${Date.now()}-${Math.random()}`,
    },
  });

  // 채점 완료된 세션 (오답 워크시트는 graded 상태에서만 가능)
  const session = await prisma.studentSession.create({
    data: {
      assignmentId: assignment.id,
      studentName: `${PREFIX}-student`,
      token: `${PREFIX}-sess-${Date.now()}-${Math.random()}`,
      status: "graded",
      gradedAt: new Date(),
      submittedAt: new Date(),
      totalScore: 0,
      maxScore: 0,
    },
  });

  return { assignmentId: assignment.id, sessionId: session.id };
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
describe("worksheet.router", () => {
  it("happy path: 채점 완료 세션의 generate가 빈 items 배열을 반환", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.generate({ sessionId: seeded!.sessionId });
    expect(result.items).toEqual([]);
  });

  it("permission rejection: 비인증 사용자가 listSessions 호출 시 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.listSessions({
        page: 1,
        limit: 10,
        assignmentId: seeded!.assignmentId,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("input validation: assignmentId 누락 시 BAD_REQUEST", async () => {
    const caller = makeCaller("teacher");

    await expect(
      // @ts-expect-error - 의도적 잘못된 입력
      caller.listSessions({ page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("listSessions: 시드된 세션 1건이 페이지에 포함된다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.listSessions({
      page: 1,
      limit: 10,
      assignmentId: seeded!.assignmentId,
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    const ids = result.sessions.map((s) => s.id);
    expect(ids).toContain(seeded!.sessionId);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });
});
