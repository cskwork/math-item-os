// sanitize 미들웨어 단위 테스트 - XSS 방지 + SQL 주입 검출
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  hasSqlInjectionPattern,
  sanitizeString,
  sanitizeInput,
} from "../sanitize";

// ─────────────────────────────────────────────
// escapeHtml
// ─────────────────────────────────────────────

describe("escapeHtml", () => {
  it("& 기호를 이스케이프한다", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("< > 기호를 이스케이프한다", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("큰따옴표를 이스케이프한다", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("작은따옴표를 이스케이프한다", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("슬래시를 이스케이프한다", () => {
    expect(escapeHtml("a/b")).toBe("a&#x2F;b");
  });

  it("모든 특수문자를 한번에 이스케이프한다", () => {
    expect(escapeHtml('<a href="x">y\'s & z</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;y&#x27;s &amp; z&lt;&#x2F;a&gt;",
    );
  });

  it("특수문자가 없으면 그대로 반환한다", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("빈 문자열을 그대로 반환한다", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ─────────────────────────────────────────────
// hasSqlInjectionPattern
// ─────────────────────────────────────────────

describe("hasSqlInjectionPattern", () => {
  it("DROP TABLE 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("; DROP TABLE users")).toBe(true);
  });

  it("UNION SELECT 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("1 UNION SELECT * FROM users")).toBe(true);
  });

  it("SQL 주석 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("admin'-- ")).toBe(true);
  });

  it("블록 주석 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("/* malicious */")).toBe(true);
  });

  it("OR '1'='1 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("' OR '1'='1")).toBe(true);
  });

  it("OR 1=1 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("' OR 1=1")).toBe(true);
  });

  it("ALTER TABLE 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("; ALTER TABLE users")).toBe(true);
  });

  it("INSERT INTO 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("; INSERT INTO users")).toBe(true);
  });

  it("DELETE FROM 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("; DELETE FROM users")).toBe(true);
  });

  it("UPDATE SET 패턴을 감지한다", () => {
    expect(hasSqlInjectionPattern("; UPDATE users SET")).toBe(true);
  });

  it("정상 문자열은 false를 반환한다", () => {
    expect(hasSqlInjectionPattern("hello world")).toBe(false);
  });

  it("LaTeX 수식은 false를 반환한다", () => {
    expect(hasSqlInjectionPattern("x^2 + 3x + 2 = 0")).toBe(false);
  });

  it("빈 문자열은 false를 반환한다", () => {
    expect(hasSqlInjectionPattern("")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// sanitizeString
// ─────────────────────────────────────────────

describe("sanitizeString", () => {
  it("널 바이트를 제거한다", () => {
    expect(sanitizeString("hello\x00world")).toBe("helloworld");
  });

  it("제어 문자(0x01-0x08)를 제거한다", () => {
    expect(sanitizeString("a\x01b\x02c\x07d\x08e")).toBe("abcde");
  });

  it("탭은 보존한다", () => {
    expect(sanitizeString("a\tb")).toBe("a\tb");
  });

  it("줄바꿈은 보존한다", () => {
    expect(sanitizeString("a\nb")).toBe("a\nb");
  });

  it("캐리지 리턴은 보존한다", () => {
    expect(sanitizeString("a\rb")).toBe("a\rb");
  });

  it("앞뒤 공백을 트림한다", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("DEL 문자(0x7F)를 제거한다", () => {
    expect(sanitizeString("a\x7Fb")).toBe("ab");
  });

  it("빈 문자열을 그대로 반환한다", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("정상 문자열은 트림만 적용한다", () => {
    expect(sanitizeString("  x^2 + 1  ")).toBe("x^2 + 1");
  });
});

// ─────────────────────────────────────────────
// sanitizeInput (재귀적 정제)
// ─────────────────────────────────────────────

describe("sanitizeInput", () => {
  it("문자열 입력을 정제한다", () => {
    expect(sanitizeInput("  hello\x00  ")).toBe("hello");
  });

  it("숫자 입력을 그대로 반환한다", () => {
    expect(sanitizeInput(42)).toBe(42);
  });

  it("boolean 입력을 그대로 반환한다", () => {
    expect(sanitizeInput(true)).toBe(true);
  });

  it("null 입력을 그대로 반환한다", () => {
    expect(sanitizeInput(null)).toBeNull();
  });

  it("undefined 입력을 그대로 반환한다", () => {
    expect(sanitizeInput(undefined)).toBeUndefined();
  });

  it("배열의 문자열 요소를 재귀적으로 정제한다", () => {
    const result = sanitizeInput(["  a\x00  ", "  b\x01  ", 123]);
    expect(result).toEqual(["a", "b", 123]);
  });

  it("객체의 문자열 값을 재귀적으로 정제한다", () => {
    const result = sanitizeInput({
      name: "  test\x00  ",
      count: 5,
      nested: {
        value: "  nested\x01  ",
      },
    });
    expect(result).toEqual({
      name: "test",
      count: 5,
      nested: { value: "nested" },
    });
  });

  it("깊게 중첩된 구조를 재귀 처리한다", () => {
    const result = sanitizeInput({
      level1: {
        level2: {
          level3: "  deep\x00  ",
        },
      },
    });
    expect(result).toEqual({
      level1: { level2: { level3: "deep" } },
    });
  });

  it("혼합 배열-객체 구조를 처리한다", () => {
    const result = sanitizeInput({
      items: [
        { name: "  a\x00  " },
        { name: "  b\x01  " },
      ],
    });
    expect(result).toEqual({
      items: [{ name: "a" }, { name: "b" }],
    });
  });
});
