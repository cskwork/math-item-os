// rbac 미들웨어 단위 테스트 - 역할 기반 접근 제어
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { hasMinRole, hasAnyRole, requireRole, requireMinRole } from "../rbac";

// ─────────────────────────────────────────────
// hasMinRole
// ─────────────────────────────────────────────

describe("hasMinRole", () => {
  it("admin >= admin", () => {
    expect(hasMinRole("admin", "admin")).toBe(true);
  });

  it("admin >= reviewer", () => {
    expect(hasMinRole("admin", "reviewer")).toBe(true);
  });

  it("admin >= teacher", () => {
    expect(hasMinRole("admin", "teacher")).toBe(true);
  });

  it("reviewer >= reviewer", () => {
    expect(hasMinRole("reviewer", "reviewer")).toBe(true);
  });

  it("reviewer >= teacher", () => {
    expect(hasMinRole("reviewer", "teacher")).toBe(true);
  });

  it("reviewer < admin", () => {
    expect(hasMinRole("reviewer", "admin")).toBe(false);
  });

  it("teacher >= teacher", () => {
    expect(hasMinRole("teacher", "teacher")).toBe(true);
  });

  it("teacher < reviewer", () => {
    expect(hasMinRole("teacher", "reviewer")).toBe(false);
  });

  it("teacher < admin", () => {
    expect(hasMinRole("teacher", "admin")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// hasAnyRole
// ─────────────────────────────────────────────

describe("hasAnyRole", () => {
  it("admin이 [admin] 목록에 포함된다", () => {
    expect(hasAnyRole("admin", ["admin"])).toBe(true);
  });

  it("reviewer가 [admin, reviewer] 목록에 포함된다", () => {
    expect(hasAnyRole("reviewer", ["admin", "reviewer"])).toBe(true);
  });

  it("teacher가 [admin, reviewer] 목록에 포함되지 않는다", () => {
    expect(hasAnyRole("teacher", ["admin", "reviewer"])).toBe(false);
  });

  it("teacher가 [teacher] 목록에 포함된다", () => {
    expect(hasAnyRole("teacher", ["teacher"])).toBe(true);
  });

  it("admin이 빈 목록에 포함되지 않는다", () => {
    expect(hasAnyRole("admin", [])).toBe(false);
  });

  it("모든 역할이 [admin, reviewer, teacher]에 포함된다", () => {
    expect(hasAnyRole("admin", ["admin", "reviewer", "teacher"])).toBe(true);
    expect(hasAnyRole("reviewer", ["admin", "reviewer", "teacher"])).toBe(true);
    expect(hasAnyRole("teacher", ["admin", "reviewer", "teacher"])).toBe(true);
  });
});

// ─────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────

describe("requireRole", () => {
  it("역할이 undefined이면 UNAUTHORIZED를 던진다", () => {
    expect(() => requireRole(undefined, ["admin"])).toThrow(TRPCError);
    try {
      requireRole(undefined, ["admin"]);
    } catch (e) {
      expect((e as TRPCError).code).toBe("UNAUTHORIZED");
      expect((e as TRPCError).message).toBe("인증이 필요합니다");
    }
  });

  it("역할이 허용 목록에 없으면 FORBIDDEN을 던진다", () => {
    expect(() => requireRole("teacher", ["admin"])).toThrow(TRPCError);
    try {
      requireRole("teacher", ["admin"]);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
      expect((e as TRPCError).message).toContain("admin");
    }
  });

  it("역할이 허용 목록에 있으면 정상 통과한다", () => {
    expect(() => requireRole("admin", ["admin", "reviewer"])).not.toThrow();
  });

  it("reviewer가 [admin, reviewer]에 속하면 정상 통과한다", () => {
    expect(() => requireRole("reviewer", ["admin", "reviewer"])).not.toThrow();
  });

  it("FORBIDDEN 메시지에 필요 역할 목록이 포함된다", () => {
    try {
      requireRole("teacher", ["admin", "reviewer"]);
    } catch (e) {
      expect((e as TRPCError).message).toContain("admin");
      expect((e as TRPCError).message).toContain("reviewer");
    }
  });
});

// ─────────────────────────────────────────────
// requireMinRole
// ─────────────────────────────────────────────

describe("requireMinRole", () => {
  it("역할이 undefined이면 UNAUTHORIZED를 던진다", () => {
    expect(() => requireMinRole(undefined, "teacher")).toThrow(TRPCError);
    try {
      requireMinRole(undefined, "teacher");
    } catch (e) {
      expect((e as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  it("teacher가 reviewer 이상을 요구하면 FORBIDDEN을 던진다", () => {
    expect(() => requireMinRole("teacher", "reviewer")).toThrow(TRPCError);
    try {
      requireMinRole("teacher", "reviewer");
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
      expect((e as TRPCError).message).toContain("reviewer");
    }
  });

  it("reviewer가 reviewer 이상을 요구하면 정상 통과한다", () => {
    expect(() => requireMinRole("reviewer", "reviewer")).not.toThrow();
  });

  it("admin이 teacher 이상을 요구하면 정상 통과한다", () => {
    expect(() => requireMinRole("admin", "teacher")).not.toThrow();
  });

  it("teacher가 admin 이상을 요구하면 FORBIDDEN을 던진다", () => {
    expect(() => requireMinRole("teacher", "admin")).toThrow(TRPCError);
    try {
      requireMinRole("teacher", "admin");
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
      expect((e as TRPCError).message).toContain("admin");
    }
  });
});
