// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { AutoTagSuggestions } from "../auto-tag-suggestions";

// ─────────────────────────────────────────────
// Mock: tRPC
// ─────────────────────────────────────────────
const mockUseQuery = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    item: {
      suggestMetadata: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
    },
  },
}));

// ─────────────────────────────────────────────
// Mock: shared constants (Node ESM 호환)
// ─────────────────────────────────────────────
vi.mock("@math-item-os/shared/constants/index", () => ({
  BLOOM_LEVEL: {
    1: { value: 1, label: "기억", order: 1 },
    2: { value: 2, label: "이해", order: 2 },
    3: { value: 3, label: "적용", order: 3 },
    4: { value: 4, label: "분석", order: 4 },
    5: { value: 5, label: "평가", order: 5 },
    6: { value: 6, label: "창조", order: 6 },
  },
}));

// ─────────────────────────────────────────────
// 테스트 데이터
// ─────────────────────────────────────────────
const mockData = {
  skills: [{ id: "sk1", title: "일차방정식", similarity: 0.92 }],
  standards: [{ id: "std1", code: "M8-01", title: "표준1" }],
  misconceptions: [{ id: "mc1", title: "부호 오류", typicalError: "부호 반전" }],
  bloomLevel: 3,
};

function defaultProps(overrides: Partial<Parameters<typeof AutoTagSuggestions>[0]> = {}) {
  return {
    bodyLatex: "x + 1 = 0",
    schoolLevel: "middle" as const,
    grade: 2,
    selectedSkillIds: [] as string[],
    selectedStandardIds: [] as string[],
    selectedMisconceptionIds: [] as string[],
    onSkillSelect: vi.fn(),
    onStandardSelect: vi.fn(),
    onMisconceptionSelect: vi.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("AutoTagSuggestions", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it("bodyLatex 빈 문자열 → null 렌더링", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { container } = render(
      <AutoTagSuggestions {...defaultProps({ bodyLatex: "" })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("isLoading → 스켈레톤(animate-pulse) 표시", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(
      <AutoTagSuggestions {...defaultProps()} />,
    );
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("data 반환 → 스킬/성취기준/오개념 칩 렌더링", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false, error: null });
    const { getByText } = render(
      <AutoTagSuggestions {...defaultProps()} />,
    );
    expect(getByText("일차방정식")).toBeDefined();
    expect(getByText("M8-01 표준1")).toBeDefined();
    expect(getByText("부호 오류")).toBeDefined();
    // Bloom 레벨 배지
    expect(getByText("적용(3)")).toBeDefined();
  });

  it("칩 클릭 → onSkillSelect 콜백 호출", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false, error: null });
    const onSkillSelect = vi.fn();
    const { getByText } = render(
      <AutoTagSuggestions {...defaultProps({ onSkillSelect })} />,
    );
    fireEvent.click(getByText("일차방정식"));
    expect(onSkillSelect).toHaveBeenCalledWith("sk1");
  });

  it("선택된 항목 → 체크마크(✓) 표시", () => {
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false, error: null });
    const { container } = render(
      <AutoTagSuggestions {...defaultProps({ selectedSkillIds: ["sk1"] })} />,
    );
    // sk1 칩의 버튼 내부에 ✓ 문자 존재
    const buttons = container.querySelectorAll("button");
    const sk1Button = Array.from(buttons).find((b) => b.textContent?.includes("일차방정식"));
    expect(sk1Button?.textContent).toContain("\u2713");
  });
});
