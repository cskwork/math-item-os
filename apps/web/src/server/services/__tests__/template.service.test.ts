// template.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

const mockTx = {
  template: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("@math-item-os/db", () => ({
  prisma: {
    template: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  incrementVariantCount,
} from "../template.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const ORG_ID = "org-1";
const USER_ID = "user-1";

const mockTemplate = {
  id: "tmpl-1",
  orgId: ORG_ID,
  title: "이차방정식 유형",
  bodyTemplate: "{{a}}x^2 + {{b}}x + {{c}} = 0",
  parameters: [{ name: "a", min: 1, max: 10 }],
  answerTemplate: "x = (-{{b}} ± √({{b}}²-4{{a}}{{c}}))/(2{{a}})",
  constraints: {},
  _count: { variants: 5 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// createTemplate
// ─────────────────────────────────────────────

describe("createTemplate", () => {
  it("새 템플릿을 생성하고 감사 로그를 기록한다", async () => {
    mockTx.template.create.mockResolvedValue(mockTemplate);

    const result = await createTemplate(
      {
        title: "이차방정식 유형",
        bodyTemplate: "{{a}}x^2 = 0",
        parameters: [{ name: "a", min: 1, max: 10 }],
        answerTemplate: "x = 0",
      },
      USER_ID,
      ORG_ID,
    );

    expect(result.template).toEqual(mockTemplate);
    expect(mockTx.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ORG_ID, title: "이차방정식 유형" }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "create", performedBy: USER_ID }),
      }),
    );
  });

  it("constraints가 없으면 빈 객체를 사용한다", async () => {
    mockTx.template.create.mockResolvedValue(mockTemplate);

    await createTemplate(
      {
        title: "test",
        bodyTemplate: "body",
        parameters: [],
        answerTemplate: "ans",
      },
      USER_ID,
      ORG_ID,
    );

    const createCall = mockTx.template.create.mock.calls[0][0];
    expect(createCall.data.constraints).toEqual({});
  });
});

// ─────────────────────────────────────────────
// updateTemplate
// ─────────────────────────────────────────────

describe("updateTemplate", () => {
  it("기존 템플릿을 수정하고 감사 로그를 기록한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(mockTemplate as never);
    mockTx.template.update.mockResolvedValue({ ...mockTemplate, title: "수정됨" });

    const result = await updateTemplate(
      { id: "tmpl-1", title: "수정됨" },
      USER_ID,
      ORG_ID,
    );

    expect(result.template.title).toBe("수정됨");
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "update" }),
      }),
    );
  });

  it("템플릿을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(null);

    await expect(
      updateTemplate({ id: "bad-id" }, USER_ID, ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 템플릿이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue({
      ...mockTemplate,
      orgId: "other-org",
    } as never);

    try {
      await updateTemplate({ id: "tmpl-1" }, USER_ID, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// deleteTemplate
// ─────────────────────────────────────────────

describe("deleteTemplate", () => {
  it("템플릿을 삭제하고 감사 로그를 기록한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(mockTemplate as never);
    mockTx.template.delete.mockResolvedValue({});

    const result = await deleteTemplate("tmpl-1", USER_ID, ORG_ID);

    expect(result.success).toBe(true);
    expect(mockTx.template.delete).toHaveBeenCalledWith({ where: { id: "tmpl-1" } });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "delete" }),
      }),
    );
  });

  it("템플릿을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(null);

    await expect(deleteTemplate("bad-id", USER_ID, ORG_ID)).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 템플릿이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue({
      ...mockTemplate,
      orgId: "other-org",
    } as never);

    try {
      await deleteTemplate("tmpl-1", USER_ID, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// getTemplateById
// ─────────────────────────────────────────────

describe("getTemplateById", () => {
  it("ID로 템플릿을 반환한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(mockTemplate as never);

    const result = await getTemplateById("tmpl-1", ORG_ID);

    expect(result.template).toEqual(mockTemplate);
  });

  it("템플릿을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue(null);

    await expect(getTemplateById("bad-id", ORG_ID)).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 템플릿이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.template.findUnique).mockResolvedValue({
      ...mockTemplate,
      orgId: "other-org",
    } as never);

    try {
      await getTemplateById("tmpl-1", ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// listTemplates
// ─────────────────────────────────────────────

describe("listTemplates", () => {
  it("페이지네이션으로 목록을 반환한다", async () => {
    vi.mocked(prisma.template.findMany).mockResolvedValue([mockTemplate] as never);
    vi.mocked(prisma.template.count).mockResolvedValue(1);

    const result = await listTemplates({ page: 1, limit: 20 }, ORG_ID);

    expect(result.templates).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("page 2 이상에서 올바른 skip 값을 사용한다", async () => {
    vi.mocked(prisma.template.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.template.count).mockResolvedValue(0);

    await listTemplates({ page: 3, limit: 10 }, ORG_ID);

    expect(prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

// ─────────────────────────────────────────────
// incrementVariantCount
// ─────────────────────────────────────────────

describe("incrementVariantCount", () => {
  it("variantCount를 원자적으로 증가시킨다", async () => {
    vi.mocked(prisma.template.update).mockResolvedValue({
      id: "tmpl-1",
      variantCount: 8,
    } as never);

    const result = await incrementVariantCount("tmpl-1", 3);

    expect(prisma.template.update).toHaveBeenCalledWith({
      where: { id: "tmpl-1" },
      data: { variantCount: { increment: 3 } },
      select: { id: true, variantCount: true },
    });
    expect(result).toEqual({ id: "tmpl-1", variantCount: 8 });
  });
});
