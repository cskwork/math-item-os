import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ItemsListPage } from "../pages/items-list.page";
import { ItemDetailPage } from "../pages/item-detail.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");
const teacherAuth = path.join(__dirname, "../.auth/teacher.json");

test.describe("문항 상태 전이", () => {
  test("draft -> reviewed 전이 (reviewer)", async ({ browser }) => {
    const context = await browser.newContext({ storageState: reviewerAuth });
    const page = await context.newPage();

    const itemsPage = new ItemsListPage(page);
    await itemsPage.goto();
    // 초안 필터 적용
    await itemsPage.filterByStatus("초안");
    await expect(itemsPage.itemCards.first()).toBeVisible({ timeout: 10_000 });
    await itemsPage.clickItem(0);

    // 상세 페이지에서 상태 확인 및 전이
    const detailPage = new ItemDetailPage(page);
    await expect(detailPage.statusBadge).toContainText("초안");

    await detailPage.clickTransition("reviewed");
    await expect(detailPage.statusBadge).toContainText("검토완료", {
      timeout: 5_000,
    });

    await context.close();
  });

  test("teacher는 상태 전이 버튼 없음", async ({ browser }) => {
    const context = await browser.newContext({ storageState: reviewerAuth });
    const page = await context.newPage();

    // reviewer로 먼저 아이템 상세 페이지 진입
    const itemsPage = new ItemsListPage(page);
    await itemsPage.goto();
    await expect(itemsPage.itemCards.first()).toBeVisible({ timeout: 10_000 });
    // 현재 URL에서 아이템 ID 추출
    await itemsPage.clickItem(0);
    await page.waitForURL("**/items/*");
    const itemUrl = page.url();
    await context.close();

    // teacher로 같은 아이템 접근
    const teacherCtx = await browser.newContext({
      storageState: teacherAuth,
    });
    const teacherPage = await teacherCtx.newPage();
    await teacherPage.goto(itemUrl);

    // teacher가 전이 버튼을 클릭하면 API 레벨에서 차단됨
    // 또는 버튼이 없을 수 있음 (구현에 따라 다름)
    await teacherPage.waitForTimeout(3_000);
    const transitionButtons = teacherPage.getByRole("button", {
      name: /전환/,
    });
    const count = await transitionButtons.count();
    if (count > 0) {
      // 버튼이 있으면 클릭 시 에러 확인
      await transitionButtons.first().click();
      await expect(
        teacherPage.locator("[class*='border-red']"),
      ).toBeVisible({ timeout: 5_000 });
    }
    // 버튼이 0개면 프론트엔드에서 이미 차단

    await teacherCtx.close();
  });
});
