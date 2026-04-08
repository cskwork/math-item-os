import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewerAuth = path.join(__dirname, "../.auth/reviewer.json");

test.describe("변형 문항 생성 (Anthropic + SSE Subscription)", () => {
  test.use({ storageState: reviewerAuth });

  test("생성 페이지 접근 및 템플릿 목록 표시", async ({ page }) => {
    await page.goto("/admin/generate");
    await expect(page.getByText("변형 문항 생성")).toBeVisible();
    // 시드 데이터의 템플릿이 표시되어야 함
    await expect(
      page.getByText("템플릿 목록").or(page.getByText("템플릿 불러오는 중")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("템플릿 선택 시 생성 설정 패널 표시", async ({ page }) => {
    await page.goto("/admin/generate");
    // 첫 번째 템플릿 클릭
    const firstTemplate = page
      .locator("button")
      .filter({ hasText: /매개변수/ })
      .first();
    await firstTemplate.click({ timeout: 10_000 });

    // 생성 설정 패널 확인
    await expect(page.getByText("생성 설정")).toBeVisible();
    await expect(page.getByLabel("생성 개수")).toBeVisible();
    await expect(page.getByRole("button", { name: "생성 시작" })).toBeVisible();
  });

  test("생성 시작 후 실시간 진행 상태가 표시된다", async ({ page }) => {
    // OAuth 인증 필요 (Claude Code CLI 로그인 상태)
    // CI에서는 스킵 - 로컬 개발 환경에서만 실행
    test.skip(
      !!process.env.CI,
      "CI 환경에서는 OAuth 인증 불가 - 로컬에서 실행하세요",
    );

    await page.goto("/admin/generate");

    // 첫 번째 템플릿 선택
    const firstTemplate = page
      .locator("button")
      .filter({ hasText: /매개변수/ })
      .first();
    await firstTemplate.click({ timeout: 10_000 });

    // 생성 개수를 2로 설정
    const countInput = page.getByRole("spinbutton").first();
    await countInput.fill("2");

    // 생성 시작
    await page.getByRole("button", { name: "생성 시작" }).click();

    // 토스트 메시지 확인
    await expect(page.getByText("생성 요청이 접수되었습니다")).toBeVisible({
      timeout: 5_000,
    });

    // 실시간 진행 상태 표시 확인 (SSE subscription)
    await expect(
      page.getByText("처리 중").or(page.getByText("생성 시작")),
    ).toBeVisible({ timeout: 10_000 });

    // 완료 대기 (Sonnet 호출 + CAS 검증)
    await expect(
      page.getByText("CAS 검증 통과율").or(page.getByText("생성 작업 실패")),
    ).toBeVisible({ timeout: 60_000 });
  });
});
