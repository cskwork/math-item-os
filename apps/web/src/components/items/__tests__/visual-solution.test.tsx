// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { VisualSolution } from "../visual-solution";

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
    visualize: {
      generate: {
        useMutation: () => mockMutation,
      },
    },
  },
}));

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("VisualSolution", () => {
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

  it("idle 상태 → 시각화 생성 버튼 렌더링", () => {
    const { getByText } = render(<VisualSolution latex="x^2 + 1" />);
    expect(getByText("시각화 생성")).toBeDefined();
  });

  it("loading 상태 → 스피너 표시", () => {
    mockMutation = { ...mockMutation, isPending: true };
    const { container } = render(<VisualSolution latex="x^2 + 1" />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("success 상태 → SVG 콘텐츠 렌더링", () => {
    mockMutation = {
      ...mockMutation,
      isSuccess: true,
      data: {
        success: true,
        visualizationType: "svg",
        content: '<svg><circle r="10"/></svg>',
        reviewNotes: "그래프가 정확합니다",
      },
    };
    const { container, getByText } = render(<VisualSolution latex="x^2 + 1" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(getByText("그래프가 정확합니다")).toBeDefined();
  });

  it("error 상태 → 에러 메시지 표시", () => {
    mockMutation = {
      ...mockMutation,
      error: new Error("시각화 생성 실패"),
    };
    const { getByText } = render(<VisualSolution latex="x^2 + 1" />);
    expect(getByText("시각화 생성 실패")).toBeDefined();
  });

  it("버튼 클릭 → mutate 호출", () => {
    const onGenerate = vi.fn();
    const { getByText } = render(
      <VisualSolution latex="x^2 + 1" onGenerate={onGenerate} />,
    );
    fireEvent.click(getByText("시각화 생성"));
    expect(mockMutate).toHaveBeenCalledWith({ latex: "x^2 + 1" });
  });
});
