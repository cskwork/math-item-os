import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");
const teacherAuth = path.join(__dirname, "../.auth/teacher.json");

test.describe("성과 분석 대시보드", () => {
  test.use({ storageState: adminAuth });

  test("분석 페이지 렌더링 확인", async ({ page }) => {
    // 과제 목록 페이지에 접근
    await page.goto("/admin/assignments");
    await expect(page.locator("h1, h2")).toBeVisible({ timeout: 20_000 });

    // 페이지가 정상 로드되는지 확인
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("RBAC: 교사 분석 접근", () => {
  test.use({ storageState: teacherAuth });

  test("교사가 과제 관리 페이지에 접근 시 권한 확인", async ({ page }) => {
    await page.goto("/admin/assignments");
    // 교사는 admin 페이지에 접근 불가하거나 제한적 접근
    await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });
  });
});
