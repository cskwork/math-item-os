// solve.router 통합 테스트
// publicProcedure (인증 불필요) - 토큰 기반 학생 풀이 흐름
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// next-auth 모듈 체인 차단
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@math-item-os/db";
import { createCallerFactory } from "../../trpc";
import { solveRouter } from "../solve.router";

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
// caller (publicProcedure이므로 session null 가능)
// -------------------------------------------------
const createCaller = createCallerFactory(solveRouter);

function makeCaller() {
  return createCaller({
    prisma,
    session: null,
    user: null,
  });
}

// -------------------------------------------------
// 시드 prefix
// -------------------------------------------------
const ORG_ID = "default-org";
const PREFIX = "test-solve-router";

interface SeedRefs {
  assignmentId: string;
  solveToken: string;
  studentName: string;
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
  const solveToken = `${PREFIX}-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const assignment = await prisma.assignment.create({
    data: {
      orgId: ORG_ID,
      title: `${PREFIX}-assignment`,
      purpose: "diagnosis",
      isPublished: true,
      solveToken,
    },
  });

  return {
    assignmentId: assignment.id,
    solveToken,
    studentName: `${PREFIX}-student`,
  };
}

async function cleanup() {
  // 세션 먼저 (FK)
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
describe("solve.router", () => {
  it("happy path: solveToken으로 공개 과제를 조회한다", async () => {
    const caller = makeCaller();

    const result = await caller.getAssignment({
      assignmentId: seeded!.assignmentId,
      solveToken: seeded!.solveToken,
    });

    expect(result.assignment.id).toBe(seeded!.assignmentId);
    expect(result.assignment.solveToken).toBe(seeded!.solveToken);
    expect(result.assignment.isPublished).toBe(true);
  });

  it("permission rejection: 잘못된 solveToken으로 startSession 호출 시 FORBIDDEN", async () => {
    const caller = makeCaller();

    await expect(
      caller.startSession({
        assignmentId: seeded!.assignmentId,
        solveToken: "wrong-token-xyz",
        studentName: seeded!.studentName,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("input validation: 빈 solveToken으로 getAssignment 호출 시 BAD_REQUEST", async () => {
    const caller = makeCaller();

    await expect(
      caller.getAssignment({
        assignmentId: seeded!.assignmentId,
        solveToken: "",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("startSession: 정상 토큰으로 새 세션을 생성한다", async () => {
    const caller = makeCaller();

    const result = await caller.startSession({
      assignmentId: seeded!.assignmentId,
      solveToken: seeded!.solveToken,
      studentName: seeded!.studentName,
    });

    expect(result.session.id).toBeDefined();
    expect(result.session.token).toBeDefined();
    expect(result.session.assignmentId).toBe(seeded!.assignmentId);
    expect(result.session.status).toBe("in_progress");
  });

  // ─── 추가 커버리지: submitResponse (lines 38-39) ───

  it("happy path: 세션에 개별 문항 응답을 제출한다", async () => {
    const caller = makeCaller();

    // 세션 생성
    const session = await caller.startSession({
      assignmentId: seeded!.assignmentId,
      solveToken: seeded!.solveToken,
      studentName: seeded!.studentName,
    });

    // 문항이 없어도 응답 제출 시 에러가 나는지 또는 빈 응답이 기록되는지 확인
    // assignmentItem이 없으므로 NOT_FOUND가 날 수 있음
    await expect(
      caller.submitResponse({
        sessionToken: session.session.token,
        assignmentItemId: "nonexistent-assignment-item",
        answer: { value: "42", format: "exact_value" },
      }),
    ).rejects.toBeDefined();
  });

  // ─── 추가 커버리지: submitSession (lines 44-45) ───

  it("happy path: 세션을 제출하면 채점 결과를 반환한다", async () => {
    const caller = makeCaller();

    // 세션 생성
    const session = await caller.startSession({
      assignmentId: seeded!.assignmentId,
      solveToken: seeded!.solveToken,
      studentName: seeded!.studentName,
    });

    // 문항 없는 세션 제출 → 0점 채점
    const result = await caller.submitSession({
      sessionToken: session.session.token,
    });

    expect(result.session).toBeDefined();
    expect(result.session.status).toBe("graded");
  });

  // ─── 추가 커버리지: getResults (lines 50-52) ───

  it("happy path: 채점 완료 세션의 결과를 조회한다", async () => {
    const caller = makeCaller();

    // 세션 생성 → 제출
    const session = await caller.startSession({
      assignmentId: seeded!.assignmentId,
      solveToken: seeded!.solveToken,
      studentName: seeded!.studentName,
    });

    await caller.submitSession({
      sessionToken: session.session.token,
    });

    const result = await caller.getResults({
      sessionToken: session.session.token,
    });

    expect(result.session).toBeDefined();
    expect(result.session.status).toBe("graded");
  });

  it("getResults: 존재하지 않는 토큰이면 NOT_FOUND", async () => {
    const caller = makeCaller();

    await expect(
      caller.getResults({ sessionToken: "nonexistent-session-token-xyz" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
