import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");
const teacherAuth = path.join(__dirname, "../.auth/teacher.json");

test.describe("인증 및 내비게이션", () => {
  test("admin 역할로 대시보드 로드", async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminAuth });
    const page = await context.newPage();
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "문항 목록" })).toBeVisible();
    // Verify sidebar has admin links
    await expect(page.getByRole("link", { name: "대시보드" })).toBeVisible();
    await expect(page.getByRole("link", { name: "사용자" })).toBeVisible();
    await context.close();
  });

  test("reviewer 역할로 대시보드 로드", async ({ browser }) => {
    const context = await browser.newContext({ storageState: reviewerAuth });
    const page = await context.newPage();
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "문항 목록" })).toBeVisible();
    await context.close();
  });

  test("teacher 역할로 대시보드 로드", async ({ browser }) => {
    const context = await browser.newContext({ storageState: teacherAuth });
    const page = await context.newPage();
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "문항 목록" })).toBeVisible();
    await context.close();
  });

  test("사이드바 내비게이션 링크 동작 확인", async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminAuth });
    const page = await context.newPage();

    // Navigate to items page
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "문항 목록" })).toBeVisible();

    // Navigate to search
    await page.getByRole("link", { name: "검색" }).click();
    await expect(page.getByRole("heading", { name: "문항 검색" })).toBeVisible({ timeout: 15_000 });

    // Navigate to admin dashboard
    await page.getByRole("link", { name: "대시보드" }).click();
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 15_000 });

    await context.close();
  });
});
