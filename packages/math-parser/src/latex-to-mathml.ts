import katex from "katex";

// --- 타입 정의 ---

export interface MathmlConversionResult {
  /** 변환된 MathML 문자열, 실패 시 null */
  mathml: string | null;
  /** 변환 중 발생한 오류 목록 */
  errors: string[];
}

export interface MathmlConversionInput {
  latex: string;
  displayMode?: boolean;
}

/**
 * KaTeX renderToString 래퍼 HTML에서 순수 <math> 요소만 추출
 *
 * KaTeX의 output:"mathml" 옵션은 결과를 <span class="katex">로 감싼다.
 * 이 헬퍼는 래퍼를 제거하고 <math>...</math> 부분만 반환한다.
 */
export function extractMathmlFromKatex(katexOutput: string): string {
  const mathStart = katexOutput.indexOf("<math");
  const mathEnd = katexOutput.lastIndexOf("</math>");

  if (mathStart === -1 || mathEnd === -1) {
    // <math> 태그를 찾을 수 없으면 원본 반환
    return katexOutput;
  }

  return katexOutput.slice(mathStart, mathEnd + "</math>".length);
}

/**
 * LaTeX 문자열을 순수 MathML로 변환
 *
 * KaTeX를 사용하여 LaTeX를 MathML로 변환하고,
 * 래퍼 HTML을 제거하여 순수 <math> 요소만 반환한다.
 * 실패 시 예외를 던지지 않고 errors 배열에 오류를 담아 반환한다.
 */
export function latexToMathml(
  latex: string,
  options?: { displayMode?: boolean },
): MathmlConversionResult {
  const errors: string[] = [];

  if (latex.trim().length === 0) {
    return { mathml: null, errors: ["빈 LaTeX 입력"] };
  }

  try {
    const raw = katex.renderToString(latex, {
      displayMode: options?.displayMode ?? false,
      throwOnError: true,
      output: "mathml",
      strict: false,
    });

    const mathml = extractMathmlFromKatex(raw);
    return { mathml, errors };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(message);
    return { mathml: null, errors };
  }
}

/**
 * 여러 LaTeX 문자열을 일괄 MathML 변환
 */
export function latexToMathmlBatch(
  items: ReadonlyArray<MathmlConversionInput>,
): MathmlConversionResult[] {
  return items.map(({ latex, displayMode }) =>
    latexToMathml(latex, { displayMode }),
  );
}
