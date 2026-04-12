// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { AnimationPreview } from "../animation-preview";

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
    animate: {
      generate: {
        useMutation: () => mockMutation,
      },
    },
  },
}));

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("AnimationPreview", () => {
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

  it("idle 상태 → 애니메이션 생성 버튼 렌더링", () => {
    const { getByText } = render(<AnimationPreview latex="x^2 + 1" />);
    expect(getByText("애니메이션 생성")).toBeDefined();
  });

  it("success 상태 → Manim 코드 블록 표시", () => {
    mockMutation = {
      ...mockMutation,
      isSuccess: true,
      data: {
        success: true,
        manimCode: "class Example(Scene):\n  def construct(self):\n    pass",
        summary: "이차함수 그래프 애니메이션",
      },
    };
    const { container, getByText } = render(<AnimationPreview latex="x^2 + 1" />);
    expect(container.querySelector("pre")).not.toBeNull();
    expect(getByText("이차함수 그래프 애니메이션")).toBeDefined();
  });

  it("error 상태 → 에러 메시지 표시", () => {
    mockMutation = {
      ...mockMutation,
      error: new Error("애니메이션 생성 실패"),
    };
    const { getByText } = render(<AnimationPreview latex="x^2 + 1" />);
    expect(getByText("애니메이션 생성 실패")).toBeDefined();
  });

  it("버튼 클릭 → mutate 호출 (기본 스타일)", () => {
    const { getByText } = render(<AnimationPreview latex="x^2 + 1" />);
    fireEvent.click(getByText("애니메이션 생성"));
    expect(mockMutate).toHaveBeenCalledWith({
      latex: "x^2 + 1",
      style: "step_by_step",
    });
  });

  it("스타일 변경 후 mutate 호출", () => {
    const { getByText, getByDisplayValue } = render(
      <AnimationPreview latex="x^2 + 1" />,
    );
    fireEvent.change(getByDisplayValue("step_by_step"), {
      target: { value: "transform" },
    });
    fireEvent.click(getByText("애니메이션 생성"));
    expect(mockMutate).toHaveBeenCalledWith({
      latex: "x^2 + 1",
      style: "transform",
    });
  });
});
