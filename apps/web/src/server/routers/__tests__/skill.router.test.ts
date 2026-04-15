// skill.router 통합 테스트
// 실제 Prisma + 테스트 DB로 caller 패턴 검증
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// next-auth 모듈 체인 차단 (vitest 환경에서 next/server import 실패 회피)
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@math-item-os/db";
import { createCallerFactory } from "../../trpc";
import { skillRouter } from "../skill.router";

// -------------------------------------------------
// DB env 설정 (테스트 DB로 강제)
// -------------------------------------------------
beforeAll(() => {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = testDbUrl;
  if (!process.env.DIRECT_URL) process.env.DIRECT_URL = testDbUrl;
});

// -------------------------------------------------
// caller 팩토리 + role helper
// -------------------------------------------------
const createCaller = createCallerFactory(skillRouter);

type Role = "admin" | "reviewer" | "teacher" | null;

function makeCaller(role: Role) {
  const session = role
    ? {
        user: {
          id: `test-skill-router-user-${role}`,
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
// 시드 데이터 prefix
// -------------------------------------------------
const ORG_ID = "default-org";
const CODE_PREFIX = "test-skill-router";

async function ensureOrg() {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Default Test Org", slug: ORG_ID },
  });
}

async function cleanup() {
  // 본 테스트가 만든 스킬과 그 의존 데이터 제거
  await prisma.auditLog.deleteMany({
    where: { orgId: ORG_ID, tableName: { in: ["skills", "prerequisite_edges", "misconceptions"] } },
  });
  // 선수 학습 관계 제거 (스킬 삭제 전 FK 해소)
  const skillIds = (
    await prisma.skill.findMany({
      where: { orgId: ORG_ID, code: { startsWith: CODE_PREFIX } },
      select: { id: true },
    })
  ).map((s) => s.id);
  if (skillIds.length > 0) {
    await prisma.prerequisiteEdge.deleteMany({
      where: {
        OR: [
          { fromSkillId: { in: skillIds } },
          { toSkillId: { in: skillIds } },
        ],
      },
    });
    await prisma.misconception.deleteMany({
      where: { orgId: ORG_ID, code: { startsWith: CODE_PREFIX } },
    });
  }
  await prisma.skill.deleteMany({
    where: { orgId: ORG_ID, code: { startsWith: CODE_PREFIX } },
  });
}

beforeEach(async () => {
  await ensureOrg();
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

// -------------------------------------------------
// 테스트
// -------------------------------------------------
describe("skill.router", () => {
  it("happy path: reviewer가 스킬을 생성하고 list로 조회한다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      code: `${CODE_PREFIX}-happy`,
      title: "테스트 스킬",
      topicPath: "math.algebra.linear",
      bloomLevel: 3,
      typeLevel: 2,
    });

    expect(created.skill.id).toBeDefined();
    expect(created.skill.code).toBe(`${CODE_PREFIX}-happy`);

    const listed = await caller.list({
      page: 1,
      limit: 50,
      topicPath: "math.algebra",
    });
    const found = listed.skills.find((s) => s.id === created.skill.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe("테스트 스킬");
  });

  it("permission rejection: teacher가 create 호출 시 FORBIDDEN", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.create({
        code: `${CODE_PREFIX}-forbidden`,
        title: "권한 없음",
        topicPath: "math.algebra",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("input validation: 빈 code로 create 호출 시 BAD_REQUEST", async () => {
    const caller = makeCaller("reviewer");

    await expect(
      caller.create({
        code: "",
        title: "x",
        topicPath: "math",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("getById: 존재하지 않는 id 조회 시 NOT_FOUND", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.getById({ id: "nonexistent-skill-id-xyz" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listMisconceptions: 인증된 사용자가 빈 결과를 받는다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.listMisconceptions({
      page: 1,
      limit: 10,
      skillId: `${CODE_PREFIX}-no-such-skill`,
    });

    expect(result.misconceptions).toBeDefined();
    expect(Array.isArray(result.misconceptions)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  // ─── 추가 커버리지: getItems (lines 116-121) ───

  it("happy path: teacher가 스킬별 문항 목록을 조회한다", async () => {
    const caller = makeCaller("reviewer");

    // 먼저 스킬 생성
    const created = await caller.create({
      code: `${CODE_PREFIX}-items`,
      title: "문항 조회용 스킬",
      topicPath: "math.geometry",
      bloomLevel: 2,
      typeLevel: 3,
    });

    const teacherCaller = makeCaller("teacher");
    const result = await teacherCaller.getItems({
      skillId: created.skill.id,
      page: 1,
      limit: 10,
    });

    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result).toHaveProperty("total");
  });

  it("getItems: sortBy=difficulty가 difficultyAuthor로 매핑된다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      code: `${CODE_PREFIX}-items-sort`,
      title: "정렬 테스트 스킬",
      topicPath: "math.algebra",
      typeLevel: 1,
    });

    const result = await caller.getItems({
      skillId: created.skill.id,
      page: 1,
      limit: 10,
      sortBy: "difficulty",
    });

    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("getItems: sortBy=createdAt가 그대로 전달된다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      code: `${CODE_PREFIX}-items-sort2`,
      title: "정렬 테스트 스킬 2",
      topicPath: "math.algebra",
      typeLevel: 1,
    });

    const result = await caller.getItems({
      skillId: created.skill.id,
      page: 1,
      limit: 10,
      sortBy: "createdAt",
    });

    expect(result).toHaveProperty("items");
  });

  // ─── 추가 커버리지: createPrerequisite (lines 126-128) ───

  it("happy path: reviewer가 선수 학습 관계를 생성한다", async () => {
    const caller = makeCaller("reviewer");

    const skill1 = await caller.create({
      code: `${CODE_PREFIX}-prereq-from`,
      title: "선수 스킬",
      topicPath: "math.algebra.basics",
      typeLevel: 1,
    });

    const skill2 = await caller.create({
      code: `${CODE_PREFIX}-prereq-to`,
      title: "후행 스킬",
      topicPath: "math.algebra.linear",
      typeLevel: 2,
    });

    const result = await caller.createPrerequisite({
      fromSkillId: skill1.skill.id,
      toSkillId: skill2.skill.id,
      strength: "strong",
      weight: 0.8,
    });

    expect(result.edge).toBeDefined();
    expect(result.edge.fromSkillId).toBe(skill1.skill.id);
    expect(result.edge.toSkillId).toBe(skill2.skill.id);

    // cleanup: 엣지 삭제도 커버 (lines 134-136)
    const deleted = await caller.deletePrerequisite({ edgeId: result.edge.id });
    expect(deleted.success).toBe(true);
  });

  // ─── 추가 커버리지: getPrerequisiteGraph (lines 141-144) ───

  it("happy path: teacher가 선수 학습 그래프를 조회한다", async () => {
    // 먼저 스킬 생성 (reviewer)
    const reviewerCaller = makeCaller("reviewer");
    const skill = await reviewerCaller.create({
      code: `${CODE_PREFIX}-graph-root`,
      title: "그래프 루트 스킬",
      topicPath: "math.algebra",
      typeLevel: 1,
    });

    const teacherCaller = makeCaller("teacher");
    const result = await teacherCaller.getPrerequisiteGraph({
      skillId: skill.skill.id,
      depth: 2,
    });

    expect(result).toHaveProperty("nodes");
    expect(result).toHaveProperty("edges");
  });

  // ─── 추가 커버리지: createMisconception (lines 159-160) ───

  it("happy path: reviewer가 오개념을 생성한다", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.createMisconception({
      code: `${CODE_PREFIX}-miscon-001`,
      title: "분모끼리 더하는 오류",
      typicalError: "1/2 + 1/3 = 1/5로 계산",
      severity: 4,
    });

    expect(result.misconception).toBeDefined();
    expect(result.misconception.title).toBe("분모끼리 더하는 오류");

    // cleanup
    await prisma.auditLog.deleteMany({
      where: { orgId: ORG_ID, tableName: "misconceptions" },
    });
    await prisma.misconception.deleteMany({
      where: { orgId: ORG_ID, code: `${CODE_PREFIX}-miscon-001` },
    });
  });

  // ─── 추가 커버리지: getRemediationPath (lines 166-168) ───

  it("getRemediationPath: 존재하지 않는 misconceptionId이면 NOT_FOUND", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.getRemediationPath({
        misconceptionId: "nonexistent-misconception-xyz",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ─── 추가 커버리지: permission 거부 ───

  it("teacher는 createPrerequisite를 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.createPrerequisite({
        fromSkillId: "a",
        toSkillId: "b",
        strength: "strong",
        weight: 0.5,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("teacher는 createMisconception을 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.createMisconception({
        code: "test-forbidden",
        title: "test",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("미인증 caller는 getItems 호출 시 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.getItems({ skillId: "a", page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
