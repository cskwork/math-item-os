// deep-solve.router 단위 테스트
// protectedProcedure (인증 필수) - 서비스를 mock하여 라우터 레이어만 검증
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mock: auth
// ─────────────────────────────────────────────
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ─────────────────────────────────────────────
// Mock: deep-solve service
// ─────────────────────────────────────────────
vi.mock("../../services/deep-solve.service", () => ({
  deepSolve: vi.fn().mockResolvedValue({
    success: true,
    steps: [
      { stepNum: 1, latex: "x^2 + 3x + 2 = 0", explanation: "Factor", toolUsed: "sympy" },
      { stepNum: 2, latex: "(x+1)(x+2) = 0", explanation: "Roots", toolUsed: "sympy" },
    ],
    finalAnswer: "x = -1, -2",
    verification: "Verified by substitution",
  }),
}));

import { createCallerFactory } from "../../trpc";
import { deepSolveRouter } from "../deep-solve.router";
import { deepSolve } from "../../services/deep-solve.service";
import type { UserRole } from "@math-item-os/db";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(deepSolveRouter);

function makeCaller(role: UserRole | null) {
  if (role == null) {
    return createCaller({ prisma: {} as never, session: null, user: null });
  }
  const user = { id: `test-${role}`, email: `${role}@test.com`, name: `Test ${role}`, role };
  const session = { user, expires: new Date(Date.now() + 86_400_000).toISOString() };
  return createCaller({ prisma: {} as never, session: session as never, user: user as never });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("deep-solve.router", () => {
  it("인증된 사용자가 middle 레벨 풀이를 요청하면 서비스 결과를 반환한다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.solve({
      latex: "x^2 + 3x + 2 = 0",
      schoolLevel: "middle",
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.finalAnswer).toBe("x = -1, -2");
    // showWork 기본값 true
    expect(deepSolve).toHaveBeenCalledWith("x^2 + 3x + 2 = 0", "middle", true);
  });

  it("showWork=false가 서비스에 전달된다", async () => {
    const caller = makeCaller("teacher");

    await caller.solve({
      latex: "2 + 2",
      schoolLevel: "elementary",
      showWork: false,
    });

    expect(deepSolve).toHaveBeenCalledWith("2 + 2", "elementary", false);
  });

  it("high 학교 레벨이 정상 처리된다", async () => {
    const caller = makeCaller("reviewer");

    await caller.solve({
      latex: "\\int x^2 dx",
      schoolLevel: "high",
    });

    expect(deepSolve).toHaveBeenCalledWith("\\int x^2 dx", "high", true);
  });

  it("미인증 사용자는 UNAUTHORIZED를 받는다", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.solve({ latex: "x^2", schoolLevel: "middle" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("빈 latex 입력은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.solve({ latex: "", schoolLevel: "middle" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("잘못된 schoolLevel은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.solve({ latex: "x^2", schoolLevel: "university" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("서비스 에러가 발생해도 라우터는 결과를 그대로 반환한다", async () => {
    vi.mocked(deepSolve).mockResolvedValueOnce({
      success: false,
      error: "math-ai 서비스 호출 실패",
    });

    const caller = makeCaller("teacher");
    const result = await caller.solve({
      latex: "invalid",
      schoolLevel: "middle",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("실패");
  });

  it("admin 역할도 정상 접근 가능하다", async () => {
    const caller = makeCaller("admin");

    const result = await caller.solve({
      latex: "x + 1 = 2",
      schoolLevel: "elementary",
    });

    expect(result.success).toBe(true);
  });
});
