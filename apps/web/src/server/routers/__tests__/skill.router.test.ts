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
    where: { orgId: ORG_ID, tableName: "skills" },
  });
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
});
