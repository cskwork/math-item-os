import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SkillsListPage } from "../pages/skills-list.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");

test.describe("스킬 관리", () => {
  test.use({ storageState: reviewerAuth });

  test("스킬 목록 로드", async ({ page }) => {
    const skillsPage = new SkillsListPage(page);
    await skillsPage.goto();
    await expect(skillsPage.pageHeading).toBeVisible();
    // Wait for skills to load in table
    await expect(skillsPage.skillRows.first()).toBeVisible({ timeout: 10_000 });
  });

  test("스킬 목록 페이지네이션", async ({ page }) => {
    const skillsPage = new SkillsListPage(page);
    await skillsPage.goto();
    await expect(skillsPage.skillRows.first()).toBeVisible({ timeout: 10_000 });

    // Check page indicator exists
    await expect(skillsPage.pageIndicator).toBeVisible();
  });

  test("그래프 보기 링크 동작", async ({ page }) => {
    const skillsPage = new SkillsListPage(page);
    await skillsPage.goto();
    await expect(skillsPage.pageHeading).toBeVisible({ timeout: 10_000 });
    await skillsPage.clickGraphView();
    await expect(page).toHaveURL(/\/skills\/graph/, { timeout: 10_000 });
  });

  test("Bloom 수준 필터링", async ({ page }) => {
    const skillsPage = new SkillsListPage(page);
    await skillsPage.goto();
    await expect(skillsPage.skillRows.first()).toBeVisible({ timeout: 10_000 });

    // Filter by Bloom level
    await skillsPage.filterByBloomLevel("이해");
    await page.waitForTimeout(1000);
  });
});
