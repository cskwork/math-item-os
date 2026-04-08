import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SearchPage } from "../pages/search.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");

test.describe("문항 검색", () => {
  test.use({ storageState: reviewerAuth });

  test("검색 페이지 로드", async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await expect(searchPage.pageHeading).toBeVisible();
  });

  test("검색어 입력 가능", async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await expect(searchPage.pageHeading).toBeVisible();

    // 검색 입력 필드에 입력
    await searchPage.searchInput.fill("방정식");
    await expect(searchPage.searchInput).toHaveValue("방정식");
  });

  test("정렬 버튼 표시 및 클릭", async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await expect(searchPage.pageHeading).toBeVisible();

    // 정렬 버튼 존재 확인
    await expect(
      page.getByRole("button", { name: "관련도" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "최신순" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "난이도" }),
    ).toBeVisible();

    // 최신순 클릭
    await searchPage.sortByLatest();
  });
});
