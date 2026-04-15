// assignment.service 단위 테스트 — Prisma 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// -------------------------------------------------
// Prisma mock
// -------------------------------------------------

const mockTx = {
  item: { findMany: vi.fn() },
  assignment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  assignmentItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@math-item-os/db", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    ),
    assignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// randomBytes mock — deterministic token
vi.mock("crypto", () => ({
  randomBytes: vi.fn(() => ({
    toString: () => "abcdef0123456789abcdef0123456789",
  })),
}));

import { prisma } from "@math-item-os/db";
import {
  createAssignment,
  getAssignmentById,
  listAssignments,
  updateAssignmentItems,
  publishAssignment,
  deleteAssignment,
} from "../assignment.service";

const ORG = "org-1";
const USER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------
// createAssignment
// -------------------------------------------------

describe("createAssignment", () => {
  it("points 길이가 itemIds와 다르면 BAD_REQUEST", async () => {
    await expect(
      createAssignment(
        { title: "T", purpose: "practice" as never, itemIds: ["a", "b"], points: [10] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("존재하지 않는 itemId가 포함되면 NOT_FOUND", async () => {
    mockTx.item.findMany.mockResolvedValue([{ id: "a" }]);

    await expect(
      createAssignment(
        { title: "T", purpose: "practice" as never, itemIds: ["a", "b"] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("정상 생성 시 assignment를 반환한다", async () => {
    const created = { id: "asgn-1", title: "T", items: [] };
    mockTx.item.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mockTx.assignment.create.mockResolvedValue(created);
    mockTx.auditLog.create.mockResolvedValue({});

    const result = await createAssignment(
      { title: "T", purpose: "practice" as never, itemIds: ["a", "b"] },
      USER,
      ORG,
    );

    expect(result).toEqual({ assignment: created });
    expect(mockTx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("points가 있으면 create data에 포함된다", async () => {
    const created = { id: "asgn-1", title: "T", items: [] };
    mockTx.item.findMany.mockResolvedValue([{ id: "a" }]);
    mockTx.assignment.create.mockResolvedValue(created);
    mockTx.auditLog.create.mockResolvedValue({});

    await createAssignment(
      { title: "T", purpose: "practice" as never, itemIds: ["a"], points: [5] },
      USER,
      ORG,
    );

    const createCall = mockTx.assignment.create.mock.calls[0]![0];
    const itemData = createCall.data.items.create[0];
    expect(itemData.points).toBe(5);
  });
});

// -------------------------------------------------
// getAssignmentById
// -------------------------------------------------

describe("getAssignmentById", () => {
  it("존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(getAssignmentById("x", ORG)).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: "other-org",
    } as never);

    await expect(getAssignmentById("x", ORG)).rejects.toThrow(TRPCError);
  });

  it("정상 조회 시 assignment를 반환한다", async () => {
    const assignment = { id: "x", orgId: ORG, items: [] };
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(assignment as never);

    const result = await getAssignmentById("x", ORG);
    expect(result).toEqual({ assignment });
  });
});

// -------------------------------------------------
// listAssignments
// -------------------------------------------------

describe("listAssignments", () => {
  it("페이지네이션 결과를 반환한다", async () => {
    const assignments = [{ id: "a1" }, { id: "a2" }];
    vi.mocked(prisma.assignment.findMany).mockResolvedValue(assignments as never);
    vi.mocked(prisma.assignment.count).mockResolvedValue(5);

    const result = await listAssignments({ page: 1, limit: 2 }, ORG);

    expect(result).toEqual({ assignments, total: 5, page: 1, limit: 2 });
  });

  it("purpose 필터를 적용한다", async () => {
    vi.mocked(prisma.assignment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.assignment.count).mockResolvedValue(0);

    await listAssignments({ page: 1, limit: 10, purpose: "practice" as never }, ORG);

    const call = vi.mocked(prisma.assignment.findMany).mock.calls[0]![0];
    expect(call!.where).toHaveProperty("purpose", "practice");
  });
});

// -------------------------------------------------
// updateAssignmentItems
// -------------------------------------------------

describe("updateAssignmentItems", () => {
  it("points 길이가 itemIds와 다르면 BAD_REQUEST", async () => {
    await expect(
      updateAssignmentItems(
        { assignmentId: "a1", itemIds: ["x"], points: [1, 2] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("학습지가 존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(
      updateAssignmentItems(
        { assignmentId: "a1", itemIds: ["x"] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "a1",
      orgId: "other-org",
      items: [],
    } as never);

    await expect(
      updateAssignmentItems(
        { assignmentId: "a1", itemIds: ["x"] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("유효하지 않은 itemId가 있으면 NOT_FOUND", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "a1",
      orgId: ORG,
      items: [{ itemId: "old" }],
    } as never);
    mockTx.item.findMany.mockResolvedValue([]);

    await expect(
      updateAssignmentItems(
        { assignmentId: "a1", itemIds: ["bad-id"] },
        USER,
        ORG,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("정상 업데이트 시 assignment를 반환한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "a1",
      orgId: ORG,
      items: [{ itemId: "old", position: 0, points: null }],
    } as never);
    mockTx.item.findMany.mockResolvedValue([{ id: "new-item" }]);
    mockTx.assignmentItem.deleteMany.mockResolvedValue({});
    mockTx.assignmentItem.createMany.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});
    const updated = { id: "a1", items: [{ itemId: "new-item" }] };
    mockTx.assignment.findUnique.mockResolvedValue(updated);

    const result = await updateAssignmentItems(
      { assignmentId: "a1", itemIds: ["new-item"] },
      USER,
      ORG,
    );

    expect(result).toEqual({ assignment: updated });
  });
});

// -------------------------------------------------
// publishAssignment
// -------------------------------------------------

describe("publishAssignment", () => {
  it("존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(publishAssignment("x", USER, ORG)).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: "other",
      isPublished: false,
    } as never);

    await expect(publishAssignment("x", USER, ORG)).rejects.toThrow(TRPCError);
  });

  it("이미 공개된 학습지면 BAD_REQUEST", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: ORG,
      isPublished: true,
    } as never);

    await expect(publishAssignment("x", USER, ORG)).rejects.toThrow(TRPCError);
  });

  it("정상 공개 시 assignment와 shareUrl을 반환한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: ORG,
      isPublished: false,
      title: "T",
    } as never);
    const published = { id: "x", isPublished: true, solveToken: "tok" };
    mockTx.assignment.update.mockResolvedValue(published);
    mockTx.auditLog.create.mockResolvedValue({});

    const result = await publishAssignment("x", USER, ORG);

    expect(result.assignment).toEqual(published);
    expect(result.shareUrl).toContain("/solve/x?token=");
  });
});

// -------------------------------------------------
// deleteAssignment
// -------------------------------------------------

describe("deleteAssignment", () => {
  it("존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(deleteAssignment("x", USER, ORG)).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: "other",
    } as never);

    await expect(deleteAssignment("x", USER, ORG)).rejects.toThrow(TRPCError);
  });

  it("정상 삭제 시 success: true를 반환한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: "x",
      orgId: ORG,
      title: "T",
    } as never);
    mockTx.assignment.delete.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    const result = await deleteAssignment("x", USER, ORG);

    expect(result).toEqual({ success: true });
    expect(mockTx.auditLog.create).toHaveBeenCalledOnce();
  });
});
