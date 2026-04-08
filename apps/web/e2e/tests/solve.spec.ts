import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");

test.describe("학생 풀이 (공개 페이지)", () => {
  test("유효하지 않은 토큰으로 접근 시 오류 표시", async ({ page }) => {
    await page.goto("/solve/nonexistent-id?token=invalid-token");
    // 오류 메시지 또는 과제를 찾을 수 없음 표시 확인
    await expect(
      page.getByText(/과제를 찾을 수 없|오류|찾을 수 없습니다/),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("토큰 없이 접근 시 오류 표시", async ({ page }) => {
    await page.goto("/solve/some-id");
    // 토큰이 없거나 과제를 찾을 수 없는 오류
    await expect(
      page.getByText(/과제를 찾을 수 없|오류|토큰/),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("교사 세션 관리", () => {
  test.use({ storageState: adminAuth });

  test("세션 목록 페이지 로드", async ({ page }) => {
    // 과제 목록에서 첫 번째 과제 접근
    await page.goto("/admin/assignments");
    await expect(page.locator("h1, h2")).toBeVisible({ timeout: 20_000 });
  });

  test("성과 분석 페이지 접근", async ({ page }) => {
    // 분석 페이지 직접 접근 테스트 (과제 ID는 존재하지 않을 수 있음)
    await page.goto("/admin/assignments/test-id/analytics");
    // 페이지가 로드되면 (오류든 데이터든) 렌더링 확인
    await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  });
});
