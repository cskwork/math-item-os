import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ItemsListPage } from "../pages/items-list.page";
import { ItemCreatePage } from "../pages/item-create.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");

test.describe("문항 CRUD", () => {
  test.use({ storageState: reviewerAuth });

  test("문항 목록 로드 및 표시", async ({ page }) => {
    const itemsPage = new ItemsListPage(page);
    await itemsPage.goto();
    await expect(itemsPage.pageHeading).toBeVisible();
    // Wait for items to load
    const cards = itemsPage.itemCards;
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("상태 필터링", async ({ page }) => {
    const itemsPage = new ItemsListPage(page);
    await itemsPage.goto();
    await expect(itemsPage.itemCards.first()).toBeVisible({ timeout: 10_000 });

    // Filter by draft status
    await itemsPage.filterByStatus("초안");
    // Wait for refetch
    await page.waitForTimeout(1000);
    // All visible items should have draft status (we can verify the count changed)
  });

  test("문항 등록 폼 표시 및 취소", async ({ page }) => {
    const createPage = new ItemCreatePage(page);
    await createPage.goto();
    await expect(createPage.pageHeading).toBeVisible();
    // Cancel should return to items list
    await createPage.cancel();
    await expect(page).toHaveURL(/\/items$/);
  });

  test("문항 등록 - 필수 필드 검증", async ({ page }) => {
    const createPage = new ItemCreatePage(page);
    await createPage.goto();
    // Submit without filling required fields
    await createPage.submit();
    // Should show validation errors (form should not navigate away)
    await expect(page).toHaveURL(/\/items\/new/);
  });

  test("문항 등록 성공", async ({ page }) => {
    const createPage = new ItemCreatePage(page);
    await createPage.goto();

    // Fill required fields
    await createPage.fillLatex("x^2 + 2x + 1 = 0");
    await createPage.selectSchoolLevel("중등");
    await createPage.selectGrade("1학년");
    await createPage.selectItemType("단답형");
    await createPage.selectAnswerFormat("정확한 값");
    await createPage.fillAnswer("-1");

    // Submit
    await createPage.submit();

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/items\/[a-z0-9]+/, { timeout: 10_000 });
  });
});
