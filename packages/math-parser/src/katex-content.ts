// LaTeX 혼합 형식(한국어 + $...$ 수식) 토크나이저
// 서버(conversion.service)와 클라이언트(katex-renderer) 양쪽에서 사용한다.

export interface KatexTextSegment {
  readonly type: "text";
  readonly content: string;
}

export interface KatexMathSegment {
  readonly type: "math";
  readonly content: string;
  readonly displayMode: boolean;
}

export type KatexSegment = KatexTextSegment | KatexMathSegment;

const DELIMITER_PATTERNS = [
  { open: "$$", close: "$$", displayMode: true },
  { open: "$", close: "$", displayMode: false },
  { open: "\\[", close: "\\]", displayMode: true },
  { open: "\\(", close: "\\)", displayMode: false },
] as const;

export function tokenizeKatexContent(input: string): KatexSegment[] {
  const segments: KatexSegment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    let nextMatch:
      | { start: number; open: string; close: string; displayMode: boolean }
      | undefined;

    for (const pattern of DELIMITER_PATTERNS) {
      const start = input.indexOf(pattern.open, cursor);
      if (start === -1) continue;

      if (nextMatch == null || start < nextMatch.start) {
        nextMatch = { start, ...pattern };
      }
    }

    if (nextMatch == null) {
      if (cursor < input.length) {
        segments.push({ type: "text", content: input.slice(cursor) });
      }
      break;
    }

    if (nextMatch.start > cursor) {
      segments.push({
        type: "text",
        content: input.slice(cursor, nextMatch.start),
      });
    }

    const mathStart = nextMatch.start + nextMatch.open.length;
    const mathEnd = input.indexOf(nextMatch.close, mathStart);

    if (mathEnd === -1) {
      segments.push({ type: "text", content: input.slice(nextMatch.start) });
      break;
    }

    segments.push({
      type: "math",
      content: input.slice(mathStart, mathEnd),
      displayMode: nextMatch.displayMode,
    });

    cursor = mathEnd + nextMatch.close.length;
  }

  return segments.length > 0 ? segments : [{ type: "text", content: input }];
}

export function hasDelimitedMath(input: string): boolean {
  return tokenizeKatexContent(input).some((segment) => segment.type === "math");
}

export function shouldTreatAsPlainText(input: string): boolean {
  return hasDelimitedMath(input) || /[가-힣]/.test(input);
}
