// Z.ai Coding API 기반 수학 문항 생성 서비스
// OpenAI-compatible chat completions (non-streaming)

// ─────────────────────────────────────────────
// 공개 타입 (generation.service.ts와 공유)
// ─────────────────────────────────────────────

/** 템플릿 조회 결과의 축소 타입 */
export interface TemplateSnapshot {
  readonly id: string;
  readonly orgId: string;
  readonly title: string;
  readonly bodyTemplate: string;
  readonly parameters: unknown;
  readonly answerTemplate: string;
  readonly constraints: unknown;
}

/** 생성 요청 입력 */
export interface StartGenerationInput {
  readonly templateId: string;
  readonly count: number;
  readonly strategyOverride?: "sympy" | "llm";
  readonly params?: {
    readonly solutionSteps?: number;
    readonly coefficientRange?: readonly [number, number];
    readonly includeFractions?: boolean;
    readonly includeNegatives?: boolean;
  };
}

/** 생성된 변이 한 건 (math-ai API와 동일한 형태) */
export interface GenerateApiVariant {
  readonly body_latex: string;
  readonly params: Record<string, unknown>;
  readonly answer_value: string;
  readonly answer_latex: string;
  readonly seed: number | null;
}

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────

const ZAI_API_URL =
  process.env.ZAI_API_URL ??
  "https://api.z.ai/api/coding/paas/v4/chat/completions";
const ZAI_MODEL = process.env.ZAI_MODEL ?? "glm-4.7";
const GENERATE_TIMEOUT_MS = 180_000;
const BATCH_SIZE = 5;

// ─────────────────────────────────────────────
// 프롬프트 빌더
// ─────────────────────────────────────────────

/**
 * 시스템 프롬프트를 구성한다.
 * 한국 수학 교육 컨텍스트, LaTeX 규칙, JSON 출력 형식, 템플릿 구조를 포함.
 */
export function buildSystemPrompt(template: TemplateSnapshot): string {
  const parametersJson = JSON.stringify(template.parameters, null, 2);

  return `당신은 한국 중학교 수학 문항 생성 전문가입니다.
주어진 템플릿 구조를 기반으로 수학적으로 정확하고 고유한 변형 문항을 생성합니다.

## 출력 형식
반드시 JSON 배열로만 응답하세요. 다른 텍스트는 포함하지 마세요.
각 항목은 다음 필드를 포함해야 합니다:
- "body_latex": 문제 본문 (LaTeX 수식)
- "params": 사용된 파라미터 값 (객체)
- "answer_value": 정답 값 (문자열)
- "answer_latex": 정답의 LaTeX 표현

## LaTeX 규칙
- 분수: \\frac{분자}{분모}
- 제곱근: \\sqrt{값}
- 거듭제곱: x^{n}
- 표준 연산자: +, -, \\times, \\div
- $ 구분자를 사용하지 마세요

## 템플릿 구조
제목: ${template.title}
본문 템플릿: ${template.bodyTemplate}
정답 템플릿: ${template.answerTemplate}
파라미터 정의:
${parametersJson}

## 품질 요구사항
- 모든 문항은 수학적으로 정확해야 합니다
- 각 변형은 서로 다른 파라미터 값을 사용해야 합니다
- 정답이 계산 가능하고 유일해야 합니다`;
}

/**
 * 사용자 프롬프트를 구성한다.
 * 생성 개수, 계수 범위, 분수/음수 포함 여부를 전달.
 */
export function buildUserPrompt(
  _template: TemplateSnapshot,
  input: StartGenerationInput,
): string {
  const lines: string[] = [
    `${input.count}개의 고유한 변형 문항을 생성하세요.`,
  ];

  if (input.params?.coefficientRange != null) {
    const [min, max] = input.params.coefficientRange;
    lines.push(`계수 범위: ${min} ~ ${max}`);
  }

  if (input.params?.includeFractions != null) {
    lines.push(
      input.params.includeFractions
        ? "분수(fraction)를 포함하세요."
        : "분수를 포함하지 마세요.",
    );
  }

  if (input.params?.includeNegatives != null) {
    lines.push(
      input.params.includeNegatives
        ? "음수(negative)를 포함하세요."
        : "음수를 포함하지 마세요.",
    );
  }

  lines.push("각 문항은 수학적으로 서로 다른 고유한 변형이어야 합니다.");
  lines.push("JSON 배열로만 응답하세요.");

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// 응답 파서
// ─────────────────────────────────────────────

/** markdown code fence 제거 */
function stripCodeFence(text: string): string {
  const fenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = text.trim().match(fenceRegex);
  return match != null ? match[1]!.trim() : text.trim();
}

/** 단일 variant의 필수 필드 검증 (answer_value는 비문자열도 허용 - 문자열로 변환) */
function isValidVariant(
  item: unknown,
): item is { body_latex: string; answer_value: unknown; answer_latex: string } {
  if (typeof item !== "object" || item == null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.body_latex === "string" &&
    obj.answer_value != null &&
    typeof obj.answer_latex === "string"
  );
}

/** answer_value를 문자열로 변환 (배열, 숫자 등 대응) */
function toAnswerString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

/**
 * LLM 응답 텍스트를 파싱하여 GenerateApiVariant 배열로 변환한다.
 * - markdown code fence 제거
 * - 필수 필드 검증, 누락 항목 필터링
 * - seed는 null로 고정 (LLM 생성이므로)
 */
export function parseGenerationResponse(text: string): {
  readonly variants: GenerateApiVariant[];
  readonly error?: string;
} {
  const cleaned = stripCodeFence(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { variants: [], error: `JSON 파싱 실패: ${cleaned.slice(0, 100)}` };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];

  const variants: GenerateApiVariant[] = items
    .filter(isValidVariant)
    .map((item) => ({
      body_latex: (item as Record<string, unknown>).body_latex as string,
      params:
        typeof (item as Record<string, unknown>).params === "object" &&
        (item as Record<string, unknown>).params != null
          ? ((item as Record<string, unknown>).params as Record<
              string,
              unknown
            >)
          : {},
      answer_value: toAnswerString((item as Record<string, unknown>).answer_value),
      answer_latex: (item as Record<string, unknown>).answer_latex as string,
      seed: null,
    }));

  return { variants };
}

// ─────────────────────────────────────────────
// Z.ai Coding API 호출
// ─────────────────────────────────────────────

/**
 * Z.ai Coding API로 문항을 생성한다.
 * count > BATCH_SIZE(5)일 경우 배치 분할 순차 호출.
 */
export async function generateWithLLM(
  template: TemplateSnapshot,
  input: StartGenerationInput,
): Promise<GenerateApiVariant[]> {
  if (input.count <= BATCH_SIZE) {
    return _generateBatch(template, input);
  }

  // count > BATCH_SIZE: 배치 분할 순차 호출
  const allVariants: GenerateApiVariant[] = [];
  let remaining = input.count;
  let batchIndex = 0;

  while (remaining > 0) {
    const batchCount = Math.min(remaining, BATCH_SIZE);
    batchIndex++;
    console.log(`[LLM] 배치 ${batchIndex} 시작 (${batchCount}개)`);

    const batchVariants = await _generateBatch(template, {
      ...input,
      count: batchCount,
    });
    allVariants.push(...batchVariants);
    remaining -= batchCount;

    console.log(
      `[LLM] 배치 ${batchIndex} 완료 (${batchVariants.length}개 생성, 잔여 ${remaining}개)`,
    );
  }

  return allVariants;
}

/** 단일 배치 생성 (BATCH_SIZE 이하) */
async function _generateBatch(
  template: TemplateSnapshot,
  input: StartGenerationInput,
): Promise<GenerateApiVariant[]> {
  const systemPrompt = buildSystemPrompt(template);
  const userPrompt = buildUserPrompt(template, input);

  const text = await callZaiApi(systemPrompt, userPrompt, GENERATE_TIMEOUT_MS);

  const { variants, error } = parseGenerationResponse(text);

  if (error != null) {
    throw new Error(`Z.ai API 응답 파싱 실패: ${error}`);
  }

  return variants;
}

/**
 * Z.ai Coding API streaming 호출 (SSE).
 * 청크를 점진적으로 수신하여 타임아웃 없이 긴 응답을 처리한다.
 * 초기 연결에만 타임아웃 적용, 스트리밍 중에는 청크 간 유휴 타임아웃 적용.
 */
async function callZaiApi(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new Error("ZAI_API_KEY 환경변수가 설정되지 않았습니다");
  }

  // 초기 연결 타임아웃
  const controller = new AbortController();
  const connectTimeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("[LLM] Z.ai API 스트리밍 호출 시작");

    const response = await fetch(ZAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
      signal: controller.signal,
    });

    // 연결 성공 -> 연결 타임아웃 해제
    clearTimeout(connectTimeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Z.ai API HTTP 오류: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      );
    }

    if (!response.body) {
      throw new Error("Z.ai API 응답에 body 스트림이 없습니다");
    }

    // SSE 청크 파싱 + 청크 간 유휴 타임아웃 (60초)
    const IDLE_TIMEOUT_MS = 60_000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdleTimer = () => {
      if (idleTimer != null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };

    resetIdleTimer();

    let content = "";
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      resetIdleTimer();
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const choices = parsed.choices as
            | Array<Record<string, unknown>>
            | undefined;
          const delta = choices?.[0]?.delta as
            | Record<string, string>
            | undefined;
          if (delta?.content) {
            content += delta.content;
          }
        } catch {
          // 불완전한 JSON 건너뜀
        }
      }
    }

    if (idleTimer != null) clearTimeout(idleTimer);

    if (!content) {
      throw new Error("Z.ai API 스트리밍 응답에 content가 없습니다");
    }

    console.log(`[LLM] Z.ai API 스트리밍 완료 (${content.length}자)`);
    return content;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Z.ai API 타임아웃 (${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(connectTimeoutId);
  }
}
