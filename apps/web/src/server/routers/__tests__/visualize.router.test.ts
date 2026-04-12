// visualize.router 단위 테스트
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
// Mock: visualize service
// ─────────────────────────────────────────────
vi.mock("../../services/visualize.service", () => ({
  visualizeLatex: vi.fn().mockResolvedValue({
    success: true,
    visualizationType: "svg",
    content: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>',
    reviewNotes: "Quadratic graph",
    error: null,
  }),
}));

import { createCallerFactory } from "../../trpc";
import { visualizeRouter } from "../visualize.router";
import { visualizeLatex } from "../../services/visualize.service";
import type { UserRole } from "@math-item-os/db";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(visualizeRouter);

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
describe("visualize.router", () => {
  it("인증된 사용자가 SVG 시각화를 요청하면 서비스 결과를 반환한다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.generate({
      latex: "x^2 + 1",
      visualizationType: "svg",
    });

    expect(result.success).toBe(true);
    expect(result.visualizationType).toBe("svg");
    expect(result.content).toContain("<svg");
    expect(visualizeLatex).toHaveBeenCalledWith("x^2 + 1", "svg", undefined);
  });

  it("context 옵션이 서비스에 전달된다", async () => {
    const caller = makeCaller("reviewer");

    await caller.generate({
      latex: "y = 2x",
      visualizationType: "chartjs",
      context: "linear function",
    });

    expect(visualizeLatex).toHaveBeenCalledWith("y = 2x", "chartjs", "linear function");
  });

  it("미인증 사용자는 UNAUTHORIZED를 받는다", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.generate({ latex: "x^2", visualizationType: "svg" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("빈 latex 입력은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "", visualizationType: "svg" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("잘못된 visualizationType은 BAD_REQUEST를 받는다", async () => {
    const caller = makeCaller("teacher");

    await expect(
      caller.generate({ latex: "x^2", visualizationType: "png" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("admin 역할도 정상 접근 가능하다", async () => {
    const caller = makeCaller("admin");

    const result = await caller.generate({
      latex: "x^2",
      visualizationType: "svg",
    });

    expect(result.success).toBe(true);
  });

  it("서비스 에러가 발생해도 라우터는 결과를 그대로 반환한다", async () => {
    vi.mocked(visualizeLatex).mockResolvedValueOnce({
      success: false,
      visualizationType: null,
      content: null,
      reviewNotes: null,
      error: "math-ai 서비스 호출 실패",
    });

    const caller = makeCaller("teacher");
    const result = await caller.generate({
      latex: "invalid",
      visualizationType: "svg",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("실패");
  });
});
