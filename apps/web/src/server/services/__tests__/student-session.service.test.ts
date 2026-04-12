// student-session.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

const mockTx = {
  studentSession: {
    findUnique: vi.fn(),
  },
  assignmentItem: {
    findUnique: vi.fn(),
  },
  studentResponse: {
    upsert: vi.fn(),
  },
};

vi.mock("@math-item-os/db", () => ({
  prisma: {
    assignment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    studentSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}));

// grading.service 동적 import 모킹
vi.mock("../grading.service", () => ({
  gradeSession: vi.fn().mockResolvedValue({ id: "session-1", status: "graded" }),
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  getAssignmentBySolveToken,
  createStudentSession,
  getSessionByToken,
  submitStudentResponse,
  submitSession,
} from "../student-session.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const mockAssignment = {
  id: "assign-1",
  solveToken: "valid-token",
  isPublished: true,
  items: [],
};

const mockSession = {
  id: "session-1",
  assignmentId: "assign-1",
  studentName: "홍길동",
  token: "session-token",
  status: "in_progress",
  assignment: { items: [] },
  responses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// getAssignmentBySolveToken
// ─────────────────────────────────────────────

describe("getAssignmentBySolveToken", () => {
  it("유효한 토큰으로 공개 과제를 반환한다", async () => {
    vi.mocked(prisma.assignment.findFirst).mockResolvedValue(mockAssignment as never);

    const result = await getAssignmentBySolveToken("valid-token");

    expect(result.assignment).toEqual(mockAssignment);
    expect(prisma.assignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { solveToken: "valid-token", isPublished: true },
      }),
    );
  });

  it("과제를 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.assignment.findFirst).mockResolvedValue(null);

    await expect(getAssignmentBySolveToken("bad-token")).rejects.toThrow(TRPCError);
    try {
      await getAssignmentBySolveToken("bad-token");
    } catch (e) {
      expect((e as TRPCError).code).toBe("NOT_FOUND");
    }
  });
});

// ─────────────────────────────────────────────
// createStudentSession
// ─────────────────────────────────────────────

describe("createStudentSession", () => {
  it("유효한 입력으로 세션을 생성한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as never);
    vi.mocked(prisma.studentSession.create).mockResolvedValue(mockSession as never);

    const result = await createStudentSession({
      assignmentId: "assign-1",
      solveToken: "valid-token",
      studentName: "홍길동",
    });

    expect(result.session).toBeDefined();
    expect(prisma.studentSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignmentId: "assign-1",
          studentName: "홍길동",
          status: "in_progress",
        }),
      }),
    );
  });

  it("과제를 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(
      createStudentSession({
        assignmentId: "bad-id",
        solveToken: "valid-token",
        studentName: "홍길동",
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("미공개 과제이면 BAD_REQUEST를 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      isPublished: false,
    } as never);

    try {
      await createStudentSession({
        assignmentId: "assign-1",
        solveToken: "valid-token",
        studentName: "홍길동",
      });
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("solveToken 불일치 시 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as never);

    try {
      await createStudentSession({
        assignmentId: "assign-1",
        solveToken: "wrong-token",
        studentName: "홍길동",
      });
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// getSessionByToken
// ─────────────────────────────────────────────

describe("getSessionByToken", () => {
  it("유효한 토큰으로 세션을 반환한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(mockSession as never);

    const result = await getSessionByToken("session-token");

    expect(result.session).toEqual(mockSession);
  });

  it("세션을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(null);

    await expect(getSessionByToken("bad-token")).rejects.toThrow(TRPCError);
  });
});

// ─────────────────────────────────────────────
// submitStudentResponse
// ─────────────────────────────────────────────

describe("submitStudentResponse", () => {
  const responseInput = {
    sessionToken: "session-token",
    assignmentItemId: "ai-1",
    studentAnswer: { value: "42" },
    timeTakenSec: 30,
  };

  it("응답을 upsert한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue({
      id: "session-1",
      assignmentId: "assign-1",
      status: "in_progress",
    });
    mockTx.assignmentItem.findUnique.mockResolvedValue({
      id: "ai-1",
      assignmentId: "assign-1",
    });
    mockTx.studentResponse.upsert.mockResolvedValue({
      id: "resp-1",
      studentAnswer: { value: "42" },
    });

    const result = await submitStudentResponse(responseInput);

    expect(result.response).toBeDefined();
    expect(mockTx.studentResponse.upsert).toHaveBeenCalled();
  });

  it("세션을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue(null);

    await expect(submitStudentResponse(responseInput)).rejects.toThrow(TRPCError);
  });

  it("이미 제출된 세션이면 BAD_REQUEST를 throw한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue({
      id: "session-1",
      assignmentId: "assign-1",
      status: "submitted",
    });

    try {
      await submitStudentResponse(responseInput);
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("과제 문항이 없으면 NOT_FOUND를 throw한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue({
      id: "session-1",
      assignmentId: "assign-1",
      status: "in_progress",
    });
    mockTx.assignmentItem.findUnique.mockResolvedValue(null);

    await expect(submitStudentResponse(responseInput)).rejects.toThrow(TRPCError);
  });

  it("문항이 다른 과제에 속하면 BAD_REQUEST를 throw한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue({
      id: "session-1",
      assignmentId: "assign-1",
      status: "in_progress",
    });
    mockTx.assignmentItem.findUnique.mockResolvedValue({
      id: "ai-1",
      assignmentId: "assign-other",
    });

    try {
      await submitStudentResponse(responseInput);
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("timeTakenSec 없이도 응답을 생성한다", async () => {
    mockTx.studentSession.findUnique.mockResolvedValue({
      id: "session-1",
      assignmentId: "assign-1",
      status: "in_progress",
    });
    mockTx.assignmentItem.findUnique.mockResolvedValue({
      id: "ai-1",
      assignmentId: "assign-1",
    });
    mockTx.studentResponse.upsert.mockResolvedValue({
      id: "resp-1",
      studentAnswer: { value: "42" },
    });

    const result = await submitStudentResponse({
      sessionToken: "session-token",
      assignmentItemId: "ai-1",
      studentAnswer: { value: "42" },
    });

    expect(result.response).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// submitSession
// ─────────────────────────────────────────────

describe("submitSession", () => {
  it("세션을 submitted로 전환하고 채점을 트리거한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue({
      id: "session-1",
      status: "in_progress",
    } as never);
    vi.mocked(prisma.studentSession.update).mockResolvedValue({} as never);

    const result = await submitSession("session-token");

    expect(prisma.studentSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "submitted" }),
      }),
    );
    expect(result.session).toBeDefined();
  });

  it("세션을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(null);

    await expect(submitSession("bad-token")).rejects.toThrow(TRPCError);
  });

  it("이미 제출된 세션이면 BAD_REQUEST를 throw한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue({
      id: "session-1",
      status: "submitted",
    } as never);

    try {
      await submitSession("session-token");
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });
});
