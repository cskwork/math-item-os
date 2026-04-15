import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");

test.describe("다크 모드 토글", () => {
  test.use({ storageState: adminAuth });

  test("테마 토글 클릭 시 html class가 dark로 변경", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 20_000 });

    // 라이트 모드에서 시작 — 다크 모드로 전환
    const toggle = page.getByRole("button", { name: "다크 모드로 전환" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // html 요소에 "dark" class가 적용되어야 함
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("다크 모드 전환 후 새로고침해도 유지", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 20_000 });

    // 다크 모드로 전환
    await page.getByRole("button", { name: "다크 모드로 전환" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // 새로고침 후에도 다크 모드 유지
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // localStorage에 theme 값 확인
    const theme = await page.evaluate(() => localStorage.getItem("theme"));
    expect(theme).toBe("dark");
  });

  test("aria-label이 모드에 따라 전환", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "품질 지표 대시보드" })).toBeVisible({ timeout: 20_000 });

    // 라이트 모드: "다크 모드로 전환"
    const darkToggle = page.getByRole("button", { name: "다크 모드로 전환" });
    await expect(darkToggle).toBeVisible();

    // 클릭하여 다크 모드로 전환
    await darkToggle.click();

    // 다크 모드: "라이트 모드로 전환"
    const lightToggle = page.getByRole("button", { name: "라이트 모드로 전환" });
    await expect(lightToggle).toBeVisible();

    // 다시 클릭하여 라이트 모드로 복원
    await lightToggle.click();
    await expect(darkToggle).toBeVisible();
  });
});
