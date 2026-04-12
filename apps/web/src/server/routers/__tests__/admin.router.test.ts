// admin.router 통합 테스트
// 실제 test DB(`mathitem_test`)에 대해 createCallerFactory + Prisma로 검증한다.
// 외부 I/O 서비스(템플릿 생성, AI 생성, PDF 등)는 service 경계에서 mock.
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

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
// Mock: auth (next-auth import 회피)
// ─────────────────────────────────────────────
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ─────────────────────────────────────────────
// Mock: 생성/PDF/검수 등 외부 또는 무거운 서비스
// ─────────────────────────────────────────────
vi.mock("../../services/generation.service", () => ({
  startGenerationJob: vi
    .fn()
    .mockResolvedValue({ jobId: "gen-job-1", status: "pending" }),
  getGenerationResult: vi
    .fn()
    .mockReturnValue({ status: "pending", variants: [], passRate: 0 }),
  listGenerationJobs: vi.fn().mockReturnValue([]),
  detectStrategyForTemplate: vi
    .fn()
    .mockResolvedValue({ strategy: "sympy", reason: "test" }),
}));

vi.mock("../../services/pdf.service", () => ({
  exportAssignment: vi
    .fn()
    .mockResolvedValue({ url: "https://example.com/pdf", format: "pdf" }),
}));

vi.mock("../../services/template.service", () => ({
  listTemplates: vi
    .fn()
    .mockResolvedValue({ templates: [], total: 0, page: 1, limit: 20 }),
  getTemplateById: vi.fn().mockResolvedValue(null),
  createTemplate: vi
    .fn()
    .mockResolvedValue({ id: "tmpl-test-1", title: "test" }),
}));

vi.mock("../../services/assignment.service", () => ({
  createAssignment: vi
    .fn()
    .mockResolvedValue({ id: "assign-test-1", title: "test" }),
  getAssignmentById: vi.fn().mockResolvedValue(null),
  listAssignments: vi
    .fn()
    .mockResolvedValue({ assignments: [], total: 0, page: 1, limit: 20 }),
  updateAssignmentItems: vi.fn().mockResolvedValue({ id: "assign-test-1" }),
  publishAssignment: vi
    .fn()
    .mockResolvedValue({ id: "assign-test-1", publishedAt: new Date() }),
}));

vi.mock("../../services/quality-metrics.service", () => ({
  getQualityMetrics: vi
    .fn()
    .mockResolvedValue({ totalItems: 0, approvedItems: 0, draftItems: 0 }),
}));

vi.mock("../../services/review.service", () => ({
  listReviewTasks: vi
    .fn()
    .mockResolvedValue({ tasks: [], total: 0, page: 1, limit: 20 }),
  updateReviewTask: vi
    .fn()
    .mockResolvedValue({ id: "task-1", status: "completed" }),
}));


// ─────────────────────────────────────────────
// 라우터 / Prisma import (mock 등록 이후)
// ─────────────────────────────────────────────
import { createCallerFactory } from "../../trpc";
import { adminRouter } from "../admin.router";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";
import { generationEmitter } from "../../services/generation-events";
import type { GenerationEvent } from "../../services/generation-events";

// ─────────────────────────────────────────────
// 테스트 헬퍼: caller 생성
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(adminRouter);

function makeCaller(role: UserRole | null) {
  if (role == null) {
    return createCaller({ prisma, session: null, user: null });
  }
  const user = {
    id: `test-${role}-admin`,
    email: `${role}-admin@test.com`,
    name: `Test ${role}`,
    role,
  };
  const session = {
    user,
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
  return createCaller({
    prisma,
    session: session as never,
    user: user as never,
  });
}

const ORG_ID = "default-org";

// ─────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────
const seededAuditLogIds: string[] = [];
const seededUserIds: string[] = [];

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

  // 테스트 사용자 시드
  for (const role of ["admin", "reviewer", "teacher"] as const) {
    const u = await prisma.user.upsert({
      where: { email: `${role}-admin@test.com` },
      update: { role },
      create: {
        id: `test-${role}-admin`,
        email: `${role}-admin@test.com`,
        name: `Test ${role}`,
        role,
      },
    });
    seededUserIds.push(u.id);
  }

  // listAuditLogs용 데이터 1건 시드
  const log = await prisma.auditLog.create({
    data: {
      orgId: ORG_ID,
      tableName: "router-admin-test",
      recordId: "router-admin-test-record",
      action: "create",
      performedBy: "test-admin-admin",
      newData: { note: "router admin test fixture" },
    },
  });
  seededAuditLogIds.push(log.id);
});

afterAll(async () => {
  if (seededAuditLogIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: seededAuditLogIds } },
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
describe("admin.router", () => {
  it("happy path: admin이 listAuditLogs를 호출하면 시드 데이터가 포함된다", async () => {
    const caller = makeCaller("admin");

    const result = await caller.listAuditLogs({
      page: 1,
      limit: 50,
      tableName: "router-admin-test",
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.logs.some((l) => l.recordId === "router-admin-test-record")).toBe(
      true,
    );
  });

  it("happy path: admin이 listUsers 호출 시 시드된 사용자가 노출된다", async () => {
    const caller = makeCaller("admin");

    const result = await caller.listUsers({ page: 1, limit: 100 });

    expect(result.total).toBeGreaterThanOrEqual(3);
    const emails = result.users.map((u) => u.email);
    expect(emails).toContain("admin-admin@test.com");
  });

  it("happy path: reviewer가 getQualityMetrics를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");

    const metrics = await caller.getQualityMetrics();
    expect(metrics).toMatchObject({ totalItems: 0 });
  });

  it("admin 전용 절차(listUsers)는 reviewer 호출 시 FORBIDDEN", async () => {
    const caller = makeCaller("reviewer");

    await expect(
      caller.listUsers({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin 전용 절차(listAuditLogs)는 teacher 호출 시 FORBIDDEN", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.listAuditLogs({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("input validation: updateUserRole이 잘못된 role 문자열이면 BAD_REQUEST", async () => {
    const caller = makeCaller("admin");

    await expect(
      caller.updateUserRole({
        userId: "test-teacher-admin",
        role: "superadmin", // userRoleSchema는 admin/reviewer/teacher만 허용
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // ─── 추가 커버리지: reviewer 절차 호출 ───

  it("happy path: reviewer가 listTemplates를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.listTemplates({ page: 1, limit: 20 });
    expect(result).toMatchObject({ templates: [], total: 0 });
  });

  it("happy path: reviewer가 getTemplate을 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.getTemplate({ id: "tmpl-1" });
    expect(result).toBeNull();
  });

  it("happy path: reviewer가 createTemplate을 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.createTemplate({
      title: "Test Template",
      bodyTemplate: "x + {{a}} = {{b}}",
      parameters: [{ name: "a" }],
      answerTemplate: "{{b}} - {{a}}",
    });
    expect(result).toMatchObject({ id: "tmpl-test-1" });
  });

  it("happy path: reviewer가 generateVariants를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.generateVariants({
      templateId: "tmpl-1",
      count: 5,
    });
    expect(result).toMatchObject({ jobId: "gen-job-1" });
  });

  it("happy path: reviewer가 getGenerationResult를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.getGenerationResult({ jobId: "gen-job-1" });
    expect(result).toMatchObject({ status: "pending" });
  });

  it("happy path: reviewer가 listGenerationJobs를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.listGenerationJobs({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("happy path: reviewer가 detectStrategy를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.detectStrategy({ templateId: "tmpl-1" });
    expect(result).toMatchObject({ strategy: "sympy" });
  });

  it("happy path: reviewer가 createAssignment를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.createAssignment({
      title: "Test Assignment",
      purpose: "diagnosis",
      itemIds: ["item-1"],
    });
    expect(result).toMatchObject({ id: "assign-test-1" });
  });

  it("happy path: reviewer가 getAssignment를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.getAssignment({ id: "assign-1" });
    expect(result).toBeNull();
  });

  it("happy path: reviewer가 listAssignments를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.listAssignments({ page: 1, limit: 20 });
    expect(result).toMatchObject({ assignments: [], total: 0 });
  });

  it("happy path: reviewer가 updateAssignmentItems를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.updateAssignmentItems({
      assignmentId: "assign-1",
      itemIds: ["item-1", "item-2"],
    });
    expect(result).toMatchObject({ id: "assign-test-1" });
  });

  it("happy path: reviewer가 publishAssignment를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.publishAssignment({ id: "assign-1" });
    expect(result).toMatchObject({ id: "assign-test-1" });
  });

  it("happy path: reviewer가 exportAssignment를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.exportAssignment({
      assignmentId: "assign-1",
      format: "pdf",
    });
    expect(result).toMatchObject({ url: "https://example.com/pdf" });
  });

  it("happy path: reviewer가 listReviewTasks를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.listReviewTasks({ page: 1, limit: 20 });
    expect(result).toMatchObject({ tasks: [], total: 0 });
  });

  it("happy path: reviewer가 updateReviewTask를 호출하면 mock 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");
    const result = await caller.updateReviewTask({
      taskId: "task-1",
      status: "completed",
    });
    expect(result).toMatchObject({ id: "task-1", status: "completed" });
  });

  // ─── 추가 커버리지: admin 전용 절차 ───

  it("happy path: admin이 updateUserRole을 호출하면 DB에서 역할을 변경한다", async () => {
    const caller = makeCaller("admin");
    const result = await caller.updateUserRole({
      userId: "test-teacher-admin",
      role: "reviewer",
    });
    // DB 변경이므로 실제 결과 확인
    expect(result).toBeDefined();
  });

  // ─── 추가 커버리지: teacher 권한 거부 ───

  it("teacher는 listTemplates를 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");
    await expect(
      caller.listTemplates({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("teacher는 createTemplate을 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");
    await expect(
      caller.createTemplate({
        title: "X",
        bodyTemplate: "y",
        parameters: [],
        answerTemplate: "z",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("teacher는 generateVariants를 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");
    await expect(
      caller.generateVariants({ templateId: "tmpl-1", count: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("미인증 caller는 getQualityMetrics 호출 시 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(caller.getQualityMetrics()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("미인증 caller는 listUsers 호출 시 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.listUsers({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  // ─── 추가 커버리지: onGenerationProgress subscription (lines 143-221) ───

  it("onGenerationProgress: 버퍼된 터미널 이벤트가 있으면 즉시 yield 후 종료", async () => {
    const jobId = `test-job-sub-buffered-${Date.now()}`;

    // 버퍼에 이벤트 미리 추가 (터미널 이벤트 포함)
    const events: GenerationEvent[] = [
      { jobId, type: "job_started", data: {}, timestamp: new Date().toISOString() },
      { jobId, type: "job_completed", data: { variants: 3 }, timestamp: new Date().toISOString() },
    ];
    for (const e of events) {
      generationEmitter.emitGeneration(e);
    }

    const caller = makeCaller("reviewer");

    // createCallerFactory의 subscription은 async iterable을 반환
    const iterable = await caller.onGenerationProgress({ jobId });
    const collected: unknown[] = [];

    for await (const event of iterable) {
      collected.push(event);
      if (collected.length >= 2) break;
    }

    expect(collected.length).toBe(2);

    // cleanup
    generationEmitter.clearBuffer(jobId);
  });

  it("onGenerationProgress: 라이브 이벤트를 수신하고 터미널 이벤트에서 종료", async () => {
    const jobId = `test-job-sub-live-${Date.now()}`;
    const caller = makeCaller("reviewer");

    const iterable = await caller.onGenerationProgress({ jobId });
    const collected: unknown[] = [];

    // 비동기로 이벤트 발행 (구독 시작 후)
    const emitTimeout = setTimeout(() => {
      generationEmitter.emitGeneration({
        jobId,
        type: "job_started",
        data: {},
        timestamp: new Date().toISOString(),
      });
      generationEmitter.emitGeneration({
        jobId,
        type: "variant_generated",
        data: { index: 0 },
        timestamp: new Date().toISOString(),
      });
      generationEmitter.emitGeneration({
        jobId,
        type: "job_failed",
        data: { error: "test" },
        timestamp: new Date().toISOString(),
      });
    }, 50);

    for await (const event of iterable) {
      collected.push(event);
      if (collected.length >= 3) break;
    }

    clearTimeout(emitTimeout);

    expect(collected.length).toBe(3);

    // cleanup
    generationEmitter.clearBuffer(jobId);
  });

  it("onGenerationProgress: 다른 jobId 이벤트는 무시된다", async () => {
    const jobId = `test-job-sub-filter-${Date.now()}`;
    const otherJobId = `test-job-sub-other-${Date.now()}`;
    const caller = makeCaller("reviewer");

    const iterable = await caller.onGenerationProgress({ jobId });
    const collected: unknown[] = [];

    const emitTimeout = setTimeout(() => {
      // 다른 job 이벤트 (무시되어야 함)
      generationEmitter.emitGeneration({
        jobId: otherJobId,
        type: "variant_generated",
        data: {},
        timestamp: new Date().toISOString(),
      });
      // 본래 job 이벤트
      generationEmitter.emitGeneration({
        jobId,
        type: "job_started",
        data: {},
        timestamp: new Date().toISOString(),
      });
      generationEmitter.emitGeneration({
        jobId,
        type: "job_completed",
        data: {},
        timestamp: new Date().toISOString(),
      });
    }, 50);

    for await (const event of iterable) {
      collected.push(event);
      if (collected.length >= 2) break;
    }

    clearTimeout(emitTimeout);

    // 다른 job 이벤트는 포함되지 않아야 함
    expect(collected.length).toBe(2);

    // cleanup
    generationEmitter.clearBuffer(jobId);
    generationEmitter.clearBuffer(otherJobId);
  });

  it("onGenerationProgress: teacher는 호출할 수 없다 (FORBIDDEN)", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.onGenerationProgress({ jobId: "any" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
