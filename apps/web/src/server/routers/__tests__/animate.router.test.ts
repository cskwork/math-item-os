// animate.router 단위 테스트
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
// Mock: animate service
// ─────────────────────────────────────────────
vi.mock("../../services/animate.service", () => ({
  animateLatex: vi.fn().mockResolvedValue({
    success: true,
    manimCode: "class MyScene(Scene): ...",
    summary: "Step-by-step animation of quadratic",
    error: null,
  }),
}));

import { createCallerFactory } from "../../trpc";
import { animateRouter } from "../animate.router";
import { animateLatex } from "../../services/animate.service";
import type { UserRole } from "@math-item-os/db";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(animateRouter);

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
describe("animate.router", () => {
  it("인증된 사용자가 step_by_step 애니메이션을 요청하면 서비스 결과를 반환한다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.generate({
      latex: "x^2 + 3x + 2 = 0",
      animationStyle: "step_by_step",
    });

    expect(result.success).toBe(true);
    expect(result.manimCode).toContain("MyScene");
    expect(animateLatex).toHaveBeenCalledWith("x^2 + 3x + 2 = 0", "step_by_step", undefined);
  });

  it("durationHint 옵션이 서비스에 전달된다", async () => {
    const caller = makeCaller("reviewer");

    await caller.generate({
      latex: "y = sin(x)",
      animationStyle: "transform",
      durationHint: 10,
    });

    expect(animateLatex).toHaveBeenCalledWith("y = sin(x)", "transform", 10);
  });

  it("graph 스타일이 정상 처리된다", async () => {
    const caller = makeCaller("teacher");

    await caller.generate({
      latex: "f(x) = x^3",
      animationStyle: "graph",
    });

    expect(animateLatex).toHaveBeenCalledWith("f(x) = x^3", "graph", undefined);
  });

  it("미인증 사용자는 UNAUTHORIZED를 받는다", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.generate({ latex: "x^2", animationStyle: "step_by_step" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("빈 latex 입력은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "", animationStyle: "step_by_step" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("잘못된 animationStyle은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "x^2", animationStyle: "dissolve" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("durationHint가 음수이면 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "x^2", animationStyle: "step_by_step", durationHint: -1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("durationHint가 0이면 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "x^2", animationStyle: "step_by_step", durationHint: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("durationHint가 소수이면 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "x^2", animationStyle: "step_by_step", durationHint: 1.5 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("서비스 에러가 발생해도 라우터는 결과를 그대로 반환한다", async () => {
    vi.mocked(animateLatex).mockResolvedValueOnce({
      success: false,
      manimCode: null,
      summary: null,
      error: "math-ai 서비스 호출 실패",
    });

    const caller = makeCaller("teacher");
    const result = await caller.generate({
      latex: "invalid",
      animationStyle: "step_by_step",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("실패");
  });
});
