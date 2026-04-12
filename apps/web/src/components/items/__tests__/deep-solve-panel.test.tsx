// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { DeepSolvePanel } from "../deep-solve-panel";

// ─────────────────────────────────────────────
// Mock: tRPC
// ─────────────────────────────────────────────
const mockMutate = vi.fn();
let mockMutation = {
  mutate: mockMutate,
  isPending: false,
  data: null as Record<string, unknown> | null,
  error: null as Error | null,
  isSuccess: false,
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    deepSolve: {
      solve: {
        useMutation: () => mockMutation,
      },
    },
  },
}));

// ─────────────────────────────────────────────
// 테스트 데이터
// ─────────────────────────────────────────────
const mockSolveData = {
  success: true,
  steps: [
    {
      stepNumber: 1,
      latex: "x + 1 = 0",
      explanation: "양변에서 1을 빼기",
      toolUsed: "sympy",
    },
    {
      stepNumber: 2,
      latex: "x = -1",
      explanation: "최종 결과",
    },
  ],
  finalAnswer: "x = -1",
  verification: "검증 완료: x = -1 대입 시 0 = 0",
};

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("DeepSolvePanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation = {
      mutate: mockMutate,
      isPending: false,
      data: null,
      error: null,
      isSuccess: false,
    };
  });

  it("idle 상태 → 심층 풀이 버튼 렌더링", () => {
    const { getByText } = render(
      <DeepSolvePanel latex="x + 1 = 0" schoolLevel="middle" />,
    );
    expect(getByText("심층 풀이")).toBeDefined();
  });

  it("success 상태 → 풀이 단계 + 최종 답 렌더링", () => {
    mockMutation = {
      ...mockMutation,
      isSuccess: true,
      data: mockSolveData,
    };
    const { getByText, getAllByText } = render(
      <DeepSolvePanel latex="x + 1 = 0" schoolLevel="middle" />,
    );
    expect(getByText("양변에서 1을 빼기")).toBeDefined();
    expect(getByText("최종 결과")).toBeDefined();
    // "x = -1" appears in both step latex and final answer
    expect(getAllByText("x = -1").length).toBeGreaterThanOrEqual(1);
    expect(getByText("검증 완료: x = -1 대입 시 0 = 0")).toBeDefined();
  });

  it("success 상태 → toolUsed 배지 표시", () => {
    mockMutation = {
      ...mockMutation,
      isSuccess: true,
      data: mockSolveData,
    };
    const { getByText } = render(
      <DeepSolvePanel latex="x + 1 = 0" schoolLevel="middle" />,
    );
    expect(getByText("sympy")).toBeDefined();
  });

  it("error 상태 → 에러 메시지 표시", () => {
    mockMutation = {
      ...mockMutation,
      error: new Error("풀이 실패"),
    };
    const { getByText } = render(
      <DeepSolvePanel latex="x + 1 = 0" schoolLevel="middle" />,
    );
    expect(getByText("풀이 실패")).toBeDefined();
  });

  it("버튼 클릭 → mutate 호출", () => {
    const onSolved = vi.fn();
    const { getByText } = render(
      <DeepSolvePanel latex="x + 1 = 0" schoolLevel="middle" onSolved={onSolved} />,
    );
    fireEvent.click(getByText("심층 풀이"));
    expect(mockMutate).toHaveBeenCalledWith(
      { latex: "x + 1 = 0", schoolLevel: "middle" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
