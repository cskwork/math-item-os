import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AdminDashboardPage } from "../pages/admin-dashboard.page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminAuth = path.join(__dirname, "../.auth/admin.json");
const teacherAuth = path.join(__dirname, "../.auth/teacher.json");

test.describe("관리자 대시보드", () => {
  test("admin 역할로 대시보드 KPI 확인", async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminAuth });
    const page = await context.newPage();
    const dashboardPage = new AdminDashboardPage(page);
    await dashboardPage.goto();

    // 대시보드 헤딩 또는 KPI 카드 확인 (Turbopack 초기 컴파일 대기)
    await expect(dashboardPage.pageHeading).toBeVisible({ timeout: 20_000 });

    // KPI 데이터 렌더링 확인
    await expect(page.getByText("전체 문항 수")).toBeVisible();
    await expect(page.getByText("검토 대기")).toBeVisible();

    await context.close();
  });

  test("RBAC: teacher는 admin API에 접근 불가", async ({ browser }) => {
    const context = await browser.newContext({ storageState: teacherAuth });
    const page = await context.newPage();

    await page.goto("/admin/dashboard");

    const dashboardPage = new AdminDashboardPage(page);

    // teacher에게는 에러가 표시되거나 KPI 데이터가 로드되지 않아야 함
    // 페이지 렌더링 대기: 에러 상태 또는 KPI 데이터 중 하나가 나타날 때까지 대기
    const errorOrKpi = dashboardPage.errorState.or(page.getByText("전체 문항 수"));
    await errorOrKpi.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});

    const hasError = await dashboardPage.errorState
      .isVisible()
      .catch(() => false);
    const kpiVisible = await page
      .getByText("전체 문항 수")
      .isVisible()
      .catch(() => false);

    expect(hasError || !kpiVisible).toBeTruthy();

    await context.close();
  });
});
