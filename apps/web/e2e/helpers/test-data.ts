/**
 * E2E 테스트용 상수 정의
 * - 테스트 사용자, 세션 토큰, 시드 데이터 참조
 */

import type { UserRole } from "@math-item-os/db";
import path from "node:path";
import { fileURLToPath } from "node:url";

export { DEFAULT_ORG_ID } from "@/server/config/org-context";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────
// 테스트 사용자
// ─────────────────────────────────────────────────

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly sessionToken: string;
}

export const TEST_USERS = {
  admin: {
    id: "e2e-admin-user-id",
    email: "e2e-admin@test.local",
    name: "E2E Admin",
    role: "admin" as const,
    sessionToken: "e2e-admin-session-token-xxx",
  },
  reviewer: {
    id: "e2e-reviewer-user-id",
    email: "e2e-reviewer@test.local",
    name: "E2E Reviewer",
    role: "reviewer" as const,
    sessionToken: "e2e-reviewer-session-token-xxx",
  },
  teacher: {
    id: "e2e-teacher-user-id",
    email: "e2e-teacher@test.local",
    name: "E2E Teacher",
    role: "teacher" as const,
    sessionToken: "e2e-teacher-session-token-xxx",
  },
} as const satisfies Record<string, TestUser>;

export type TestRole = keyof typeof TEST_USERS;

// ─────────────────────────────────────────────────
// 인증 상태 파일 경로
// ─────────────────────────────────────────────────

const AUTH_DIR = path.join(__dirname, "..", ".auth");

export const AUTH_STATE_PATHS = {
  admin: path.join(AUTH_DIR, "admin.json"),
  reviewer: path.join(AUTH_DIR, "reviewer.json"),
  teacher: path.join(AUTH_DIR, "teacher.json"),
} as const satisfies Record<TestRole, string>;

// ─────────────────────────────────────────────────
// 쿠키/세션 상수
// ─────────────────────────────────────────────────

/** Auth.js v5 데이터베이스 세션 쿠키 이름 */
export const SESSION_COOKIE_NAME = "authjs.session-token";

/** 세션 만료 시간 (30일 후) */
export const SESSION_EXPIRES_DAYS = 30;

// ─────────────────────────────────────────────────
// 조직
// ─────────────────────────────────────────────────

export const DEFAULT_ORG_NAME = "Default Organization";
export const DEFAULT_ORG_SLUG = "default";

// ─────────────────────────────────────────────────
// 시드 데이터 참조 카운트
// ─────────────────────────────────────────────────

export const SEED_COUNTS = {
  items: 100,
  skills: 50,
  standards: 30,
  misconceptions: 20,
  templates: 10,
  assignments: 5,
} as const;
