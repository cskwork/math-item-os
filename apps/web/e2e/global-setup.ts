/**
 * Playwright 글로벌 셋업
 * 1. 테스트 사용자 시딩
 * 2. 각 역할별 인증 상태(storageState) 저장
 */

import { chromium, type FullConfig } from "@playwright/test";
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

  // 2. 각 역할별 인증 쿠키 설정 후 storageState 저장
  const browser = await chromium.launch();

  try {
    const roles: TestRole[] = ["admin", "reviewer", "teacher"];

    for (const role of roles) {
      const user = TEST_USERS[role];
      const context = await browser.newContext();

      await context.addCookies([
        {
          name: SESSION_COOKIE_NAME,
          value: user.sessionToken,
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
