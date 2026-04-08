/**
 * Playwright 글로벌 셋업
 * 1. 테스트 사용자 시딩
 * 2. Auth.js JWT 생성 후 각 역할별 storageState 저장
 */

import { chromium, type FullConfig } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { seedTestUsers, cleanup } from "./helpers/db";
import {
  TEST_USERS,
  AUTH_STATE_PATHS,
  SESSION_COOKIE_NAME,
  type TestRole,
} from "./helpers/test-data";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // 1. 테스트 사용자 및 세션 시딩
  await seedTestUsers();

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다.");
  }

  // 2. 각 역할별 JWT 생성 후 storageState 저장
  const browser = await chromium.launch();

  try {
    const roles: TestRole[] = ["admin", "reviewer", "teacher"];

    for (const role of roles) {
      const user = TEST_USERS[role];

      // Auth.js v5 JWT 인코딩 (session strategy: "jwt")
      const token = await encode({
        token: {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          id: user.id,
        },
        secret,
        salt: SESSION_COOKIE_NAME,
      });

      const context = await browser.newContext();

      await context.addCookies([
        {
          name: SESSION_COOKIE_NAME,
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);

      await context.storageState({ path: AUTH_STATE_PATHS[role] });
      await context.close();
    }
  } finally {
    await browser.close();
    await cleanup();
  }
}
