import { describe, it, expect } from "vitest";
import {
  parseGenerationInfo,
  type GenerationInfoData,
} from "../generation-info-utils";

// ─────────────────────────────────────────────
// parseGenerationInfo 단위 테스트
// ─────────────────────────────────────────────

describe("parseGenerationInfo", () => {
  it("isGenerated=false -> null 반환 (렌더링 없음)", () => {
    const result = parseGenerationInfo({
      metadata: { casVerification: { passed: true } },
      variant: null,
      isGenerated: false,
    });
    expect(result).toBeNull();
  });

  it("CAS 검증 통과 -> passed=true, label='CAS 검증 통과'", () => {
    const result = parseGenerationInfo({
      metadata: {
        casVerification: {
          passed: true,
          answerEquivalence: true,
          solutionUniqueness: true,
        },
      },
      variant: null,
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.casVerification.passed).toBe(true);
    expect(data.casVerification.label).toBe("CAS 검증 통과");
    expect(data.casVerification.failureReason).toBeNull();
  });

  it("CAS 검증 실패 + failureReason -> passed=false, failureReason 포함", () => {
    const result = parseGenerationInfo({
      metadata: {
        casVerification: {
          passed: false,
          answerEquivalence: false,
          solutionUniqueness: true,
          failureReason: "정답이 일치하지 않습니다",
        },
      },
      variant: null,
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.casVerification.passed).toBe(false);
    expect(data.casVerification.label).toBe("CAS 검증 실패");
    expect(data.casVerification.failureReason).toBe(
      "정답이 일치하지 않습니다",
    );
  });

  it("strategy 'sympy' -> strategy='SymPy'", () => {
    const result = parseGenerationInfo({
      metadata: { casVerification: { passed: true } },
      variant: {
        generationLog: {
          strategy: "sympy",
          generatedAt: "2026-04-10T00:00:00Z",
          casVerification: {},
        },
      },
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.strategy).toBe("SymPy");
  });

  it("strategy 'llm' -> strategy='LLM'", () => {
    const result = parseGenerationInfo({
      metadata: { casVerification: { passed: true } },
      variant: {
        generationLog: {
          strategy: "llm",
          generatedAt: "2026-04-10T00:00:00Z",
          casVerification: {},
        },
      },
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.strategy).toBe("LLM");
  });

  it("metadata가 null -> '생성 정보 없음'", () => {
    const result = parseGenerationInfo({
      metadata: null,
      variant: null,
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.empty).toBe(true);
    expect(data.emptyLabel).toBe("생성 정보 없음");
  });

  it("metadata가 undefined -> '생성 정보 없음'", () => {
    const result = parseGenerationInfo({
      metadata: undefined,
      variant: null,
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.empty).toBe(true);
    expect(data.emptyLabel).toBe("생성 정보 없음");
  });

  it("generatedAt이 있으면 포함한다", () => {
    const result = parseGenerationInfo({
      metadata: { casVerification: { passed: true } },
      variant: {
        generationLog: {
          strategy: "sympy",
          generatedAt: "2026-04-10T12:30:00Z",
          casVerification: {},
        },
      },
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.generatedAt).toBe("2026-04-10T12:30:00Z");
  });

  it("variant가 null이면 strategy와 generatedAt이 null", () => {
    const result = parseGenerationInfo({
      metadata: { casVerification: { passed: true } },
      variant: null,
      isGenerated: true,
    });
    expect(result).not.toBeNull();
    const data = result as GenerationInfoData;
    expect(data.strategy).toBeNull();
    expect(data.generatedAt).toBeNull();
  });
});
