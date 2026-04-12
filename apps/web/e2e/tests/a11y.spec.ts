import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");

test.describe("접근성 (WCAG 2.2 AA)", () => {
  test.use({ storageState: adminAuth });

  test("대시보드 페이지 — 라이트 모드 접근성 검사", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("대시보드 페이지 — 다크 모드 접근성 검사", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 20_000 });

    // 다크 모드로 전환
    await page.getByRole("button", { name: "다크 모드로 전환" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("문항 목록 페이지 접근성 검사", async ({ page }) => {
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "문항 목록" })).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
