// item.router 통합 테스트
// 실제 test DB(`mathitem_test`)에 대해 createCallerFactory + Prisma로 검증한다.
// 외부 I/O(BullMQ 업로드, conversion math-ai, meilisearch 인덱싱)는 service 경계에서 mock.
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";

// ─────────────────────────────────────────────
// Env: Prisma 클라이언트 import 전에 설정 필수
// ─────────────────────────────────────────────
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
process.env.DATABASE_URL ??= TEST_DB_URL;
process.env.DIRECT_URL ??= TEST_DB_URL;
process.env.TEST_DATABASE_URL ??= TEST_DB_URL;

// ─────────────────────────────────────────────
// Mock: auth 모듈 (next-auth가 next/server를 직접 import 하므로 vitest 환경에서 회피)
// ─────────────────────────────────────────────
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ─────────────────────────────────────────────
// Mock: 외부 I/O가 있는 서비스 경계만 stub
// ─────────────────────────────────────────────
// math-ai 서비스 호출 회피 (LaTeX 3중 변환)
vi.mock("../../services/conversion.service", () => ({
  convertLatex: vi.fn().mockResolvedValue({
    mathml: "<math><mi>x</mi></math>",
    sympy: "x",
    html: "<span>x</span>",
    errors: [],
  }),
}));

// Meilisearch 인덱싱 (item.service에서 호출)
vi.mock("../../services/meilisearch.service", () => ({
  indexItem: vi.fn().mockResolvedValue(undefined),
  deleteItemFromIndex: vi.fn().mockResolvedValue(undefined),
  searchItems: vi.fn(),
}));

// BullMQ 업로드 큐
vi.mock("../../services/upload.service", () => ({
  startBulkUpload: vi
    .fn()
    .mockResolvedValue({ jobId: "test-job-1", status: "queued" }),
  getBulkUploadJobStatus: vi
    .fn()
    .mockResolvedValue({ jobId: "test-job-1", status: "processing", progress: 0 }),
}));

// 메타데이터 자동 태깅 (Anthropic/Embedding 호출 회피)
vi.mock("../../services/metadata-suggest.service", () => ({
  suggestMetadata: vi.fn().mockResolvedValue({
    skills: [],
    standards: [],
    misconceptions: [],
    bloomLevel: null,
  }),
}));

// ─────────────────────────────────────────────
// 라우터 / Prisma import (mock 등록 이후)
// ─────────────────────────────────────────────
import { createCallerFactory } from "../../trpc";
import { itemRouter } from "../item.router";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";

// ─────────────────────────────────────────────
// 테스트 헬퍼: caller 생성
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(itemRouter);

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

function makeCaller(role: UserRole | null) {
  if (role == null) {
    return createCaller({
      prisma,
      session: null,
      user: null,
    });
  }
  const user: TestUser = {
    id: `test-${role}-item`,
    email: `${role}-item@test.com`,
    name: `Test ${role}`,
    role,
  };
  const session = {
    user,
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
  return createCaller({
    prisma,
    // tRPC context 타입에는 session/user가 필요하다.
    session: session as never,
    user: user as never,
  });
}

const ORG_ID = "default-org";

// 테스트용 사용자/조직 ID는 별도 prefix로 격리한다.
const TEST_PREFIX = "router-item-test:";

// ─────────────────────────────────────────────
// Setup: 조직 및 사용자 시드
// ─────────────────────────────────────────────
const createdItemIds: string[] = [];

beforeAll(async () => {
  // 기본 조직 보장
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Default Org (Test)",
      slug: "default-org-test",
    },
  });

  // 테스트용 사용자 (item.create 시 createdBy FK 없음 - User 테이블과 분리되어 있으므로 강제 시드 불필요)
  for (const role of ["admin", "reviewer", "teacher"] as const) {
    await prisma.user.upsert({
      where: { email: `${role}-item@test.com` },
      update: { role },
      create: {
        id: `test-${role}-item`,
        email: `${role}-item@test.com`,
        name: `Test ${role}`,
        role,
      },
    });
  }
});

afterAll(async () => {
  // 이 파일이 만든 문항/감사로그 정리
  if (createdItemIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { recordId: { in: createdItemIds } },
    });
    await prisma.itemVersion.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.itemSkill.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.difficultyProfile.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: createdItemIds } },
    });
  }
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("item.router", () => {
  it("happy path: reviewer가 문항을 생성하면 DB에 저장된다", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.create({
      bodyLatex: `${TEST_PREFIX}happy x + 1 = 2`,
      answer: { value: "1", format: "exact_value" },
      schoolLevel: "middle",
      grade: 7,
      itemType: "short_answer",
      answerFormat: "exact_value",
    });

    expect(result.item).toBeDefined();
    expect(result.item?.id).toBeTypeOf("string");
    expect(result.item?.orgId).toBe(ORG_ID);
    expect(result.item?.bodyLatex).toContain("happy x + 1 = 2");
    expect(result.item?.status).toBe("draft");

    if (result.item?.id) createdItemIds.push(result.item.id);
  });

  it("happy path: list가 방금 생성한 문항을 포함한다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      bodyLatex: `${TEST_PREFIX}list-fixture y = 3`,
      answer: { value: "3", format: "exact_value" },
      schoolLevel: "high",
      grade: 10,
      itemType: "short_answer",
      answerFormat: "exact_value",
    });
    if (created.item?.id) createdItemIds.push(created.item.id);

    const listed = await caller.list({
      page: 1,
      limit: 50,
      schoolLevel: "high",
      grade: 10,
    });

    expect(listed.total).toBeGreaterThanOrEqual(1);
    const ids = listed.items.map((i) => i.id);
    expect(ids).toContain(created.item?.id);
  });

  it("teacher가 create를 호출하면 FORBIDDEN", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.create({
        bodyLatex: `${TEST_PREFIX}forbidden`,
        answer: { value: "0", format: "exact_value" },
        schoolLevel: "middle",
        grade: 7,
        itemType: "short_answer",
        answerFormat: "exact_value",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("미인증 caller가 list를 호출하면 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.list({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("input validation: grade가 범위 밖이면 BAD_REQUEST", async () => {
    const caller = makeCaller("reviewer");

    await expect(
      caller.create({
        bodyLatex: "invalid grade",
        answer: { value: "0", format: "exact_value" },
        schoolLevel: "middle",
        grade: 99, // 1-12 범위 위반
        itemType: "short_answer",
        answerFormat: "exact_value",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("teacher가 list 조회는 가능 (protectedProcedure)", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.list({ page: 1, limit: 5 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  // ─── 추가 커버리지: update (lines 52-54) ───

  it("happy path: reviewer가 문항을 수정하면 결과를 반환한다", async () => {
    const caller = makeCaller("reviewer");

    // 먼저 문항 생성
    const created = await caller.create({
      bodyLatex: `${TEST_PREFIX}update-target z = 5`,
      answer: { value: "5", format: "exact_value" },
      schoolLevel: "middle",
      grade: 8,
      itemType: "short_answer",
      answerFormat: "exact_value",
    });
    if (created.item?.id) createdItemIds.push(created.item.id);

    const result = await caller.update({
      id: created.item!.id,
      bodyLatex: `${TEST_PREFIX}updated z = 10`,
    });

    expect(result.item).toBeDefined();
    expect(result.item?.bodyLatex).toContain("updated z = 10");
  });

  // ─── 추가 커버리지: updateStatus (lines 59-68) ───

  it("happy path: reviewer가 문항 상태를 전이한다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      bodyLatex: `${TEST_PREFIX}status-target w = 7`,
      answer: { value: "7", format: "exact_value" },
      schoolLevel: "high",
      grade: 10,
      itemType: "short_answer",
      answerFormat: "exact_value",
    });
    if (created.item?.id) createdItemIds.push(created.item.id);

    // draft → reviewed 전이
    const result = await caller.updateStatus({
      id: created.item!.id,
      status: "reviewed",
    });

    expect(result.item).toBeDefined();
    expect(result.item.status).toBe("reviewed");
  });

  // ─── 추가 커버리지: getById (lines 74-76) ───

  it("happy path: reviewer가 문항 단건 조회를 한다", async () => {
    const caller = makeCaller("reviewer");

    const created = await caller.create({
      bodyLatex: `${TEST_PREFIX}getById-target a = 3`,
      answer: { value: "3", format: "exact_value" },
      schoolLevel: "middle",
      grade: 7,
      itemType: "short_answer",
      answerFormat: "exact_value",
    });
    if (created.item?.id) createdItemIds.push(created.item.id);

    const result = await caller.getById({ id: created.item!.id });

    // getItemById returns the item directly (no wrapper)
    expect(result).toBeDefined();
    expect(result.id).toBe(created.item!.id);
    expect(result.bodyLatex).toContain("getById-target");
  });

  // ─── 추가 커버리지: suggestMetadata (lines 91-92) ───

  it("happy path: teacher가 suggestMetadata를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.suggestMetadata({
      bodyLatex: "x^2 + 2x + 1 = 0",
      schoolLevel: "high",
      grade: 10,
    });

    expect(result).toMatchObject({
      skills: [],
      standards: [],
      misconceptions: [],
    });
  });

  // ─── 추가 커버리지: bulkUpload (lines 98-100) ───

  it("happy path: reviewer가 bulkUpload를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.bulkUpload({
      format: "json",
      fileUrl: "https://example.com/items.json",
    });

    expect(result).toMatchObject({ jobId: "test-job-1", status: "queued" });
  });

  // ─── 추가 커버리지: getBulkUploadStatus (lines 106-107) ───

  it("happy path: reviewer가 getBulkUploadStatus를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.getBulkUploadStatus({ jobId: "test-job-1" });

    expect(result).toMatchObject({ jobId: "test-job-1", status: "processing" });
  });
});
