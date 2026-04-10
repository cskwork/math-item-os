// ─── 타입 정의 ───

export interface GenerationInfoProps {
  readonly metadata: unknown;
  readonly variant?: { readonly generationLog: unknown } | null;
  readonly isGenerated: boolean;
}

export interface GenerationInfoData {
  readonly empty: boolean;
  readonly emptyLabel: string;
  readonly casVerification: {
    readonly passed: boolean;
    readonly label: string;
    readonly failureReason: string | null;
  };
  readonly strategy: string | null;
  readonly generatedAt: string | null;
}

// ─── 런타임 타입 가드 ───

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseCasVerification(metadata: Record<string, unknown>): {
  passed: boolean;
  label: string;
  failureReason: string | null;
} {
  const cas = isRecord(metadata.casVerification)
    ? metadata.casVerification
    : null;
  if (!cas) {
    return { passed: false, label: "CAS 검증 실패", failureReason: null };
  }
  const passed = cas.passed === true;
  return {
    passed,
    label: passed ? "CAS 검증 통과" : "CAS 검증 실패",
    failureReason:
      typeof cas.failureReason === "string" ? cas.failureReason : null,
  };
}

function parseGenerationLog(log: unknown): {
  strategy: string | null;
  generatedAt: string | null;
} {
  if (!isRecord(log)) return { strategy: null, generatedAt: null };
  const raw = typeof log.strategy === "string" ? log.strategy : null;
  const strategy =
    raw === "sympy" ? "SymPy" : raw === "llm" ? "LLM" : raw;
  const generatedAt =
    typeof log.generatedAt === "string" ? log.generatedAt : null;
  return { strategy, generatedAt };
}

// ─── 파싱 로직 (테스트 대상) ───

export function parseGenerationInfo(
  props: GenerationInfoProps,
): GenerationInfoData | null {
  if (!props.isGenerated) return null;

  if (props.metadata == null || !isRecord(props.metadata)) {
    return {
      empty: true,
      emptyLabel: "생성 정보 없음",
      casVerification: {
        passed: false,
        label: "CAS 검증 실패",
        failureReason: null,
      },
      strategy: null,
      generatedAt: null,
    };
  }

  const casVerification = parseCasVerification(props.metadata);
  const { strategy, generatedAt } = parseGenerationLog(
    props.variant?.generationLog,
  );

  return {
    empty: false,
    emptyLabel: "",
    casVerification,
    strategy,
    generatedAt,
  };
}
