// 입력 정제 유틸리티 - XSS 방지를 위한 HTML 이스케이프 + SQL 주입 방지 패턴 검출
// Zod validator와 함께 사용하여 사용자 입력을 정제한다.

/** HTML 특수문자 이스케이프 매핑 */
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const HTML_ESCAPE_PATTERN = /[&<>"'/]/g;

/**
 * HTML 특수문자를 이스케이프하여 XSS를 방지한다.
 * LaTeX 수식은 이스케이프하지 않아야 하므로 UI 렌더링에만 적용.
 */
export function escapeHtml(input: string): string {
  return input.replace(
    HTML_ESCAPE_PATTERN,
    (char) => HTML_ESCAPE_MAP[char] ?? char,
  );
}

/** SQL 주입 의심 패턴 */
const SQL_INJECTION_PATTERNS = [
  /;\s*(DROP|ALTER|CREATE|INSERT|UPDATE|DELETE)\s/i,
  /UNION\s+SELECT/i,
  /--\s/,
  /\/\*[\s\S]*?\*\//,
  /'\s*OR\s+'1'\s*=\s*'1/i,
  /'\s*OR\s+1\s*=\s*1/i,
];

/**
 * 문자열에서 SQL 주입 의심 패턴을 검출한다.
 * Prisma 파라미터 바인딩이 1차 방어이므로, 추가 검출용.
 * @returns true면 의심 패턴 포함
 */
export function hasSqlInjectionPattern(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * 문자열 입력을 정제한다 (트림 + 제어 문자 제거).
 * LaTeX 수식 내 유효한 특수문자는 보존.
 */
export function sanitizeString(input: string): string {
  // 널 바이트와 제어 문자 제거 (탭, 줄바꿈은 보존)
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * 객체의 모든 문자열 값을 재귀적으로 정제한다.
 * Zod 파싱 후 추가 정제 레이어로 사용.
 */
export function sanitizeInput<T>(input: T): T {
  if (typeof input === "string") {
    return sanitizeString(input) as T;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput) as T;
  }

  if (input != null && typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = sanitizeInput(value);
    }
    return result as T;
  }

  return input;
}
