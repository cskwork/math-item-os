import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");

test.describe("검수 상세 시트", () => {
  test.use({ storageState: adminAuth });

  test("검수 행 클릭 시 상세 시트 열림", async ({ page }) => {
    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "검수 대기열" })).toBeVisible({ timeout: 20_000 });

    // 테이블이 로드될 때까지 대기
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    // 첫 번째 행 클릭
    await firstRow.click();

    // Sheet가 열리고 "문항 상세" 타이틀이 보여야 함
    await expect(page.getByRole("heading", { name: "문항 상세" })).toBeVisible({ timeout: 10_000 });
  });

  test("시트에 문항 정보 표시", async ({ page }) => {
    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "검수 대기열" })).toBeVisible({ timeout: 20_000 });

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // 시트 내 주요 정보 섹션 확인
    await expect(page.getByRole("heading", { name: "문항 상세" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("기본 정보")).toBeVisible();
    await expect(page.getByText("학교급/학년")).toBeVisible();
    await expect(page.getByText("문항 유형")).toBeVisible();
  });

  test("시트 닫기", async ({ page }) => {
    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "검수 대기열" })).toBeVisible({ timeout: 20_000 });

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page.getByRole("heading", { name: "문항 상세" })).toBeVisible({ timeout: 10_000 });

    // Sheet 닫기 버튼 클릭 (shadcn Sheet의 X 버튼)
    await page.getByRole("button", { name: "Close" }).click();

    // Sheet가 닫혔는지 확인
    await expect(page.getByRole("heading", { name: "문항 상세" })).toBeHidden();
  });
});
