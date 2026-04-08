/**
 * E2E 페이지 객체 모델 - 관리자 대시보드 페이지
 * Route: /admin/dashboard
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminDashboardPage extends BasePage {
  /** 페이지 heading */
  readonly pageHeading: Locator;

  /** 상태별 분포 섹션 */
  readonly statusDistribution: Locator;

  /** 평균 난이도 섹션 */
  readonly avgDifficulty: Locator;

  /** 최근 활동 테이블 */
  readonly recentActivityTable: Locator;

  /** 최근 활동 테이블 행 */
  readonly recentActivityRows: Locator;

  /** 로딩 스피너 */
  readonly loadingState: Locator;

  /** 에러 표시 영역 */
  readonly errorState: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.pageHeading = this.heading("품질 지표 대시보드");
    this.statusDistribution = this.page.getByText("상태별 분포");
    this.avgDifficulty = this.page.getByText("평균 난이도");
    this.recentActivityTable = this.page.getByRole("table");
    this.recentActivityRows = this.recentActivityTable.getByRole("row");
    this.loadingState = this.page.getByRole("progressbar");
    this.errorState = this.page.locator("[class*='border-red']");
  }

  /** /admin/dashboard 페이지로 이동 */
  async goto(): Promise<void> {
    await this.page.goto("/admin/dashboard");
  }

  /** 제목으로 KPI 카드 로케이터 반환 (카드 스타일 div) */
  kpiCard(title: string): Locator {
    return this.page.locator("div[class*='rounded']", {
      has: this.page.getByText(title, { exact: true }),
    }).first();
  }

  /** KPI 카드에서 값 텍스트 로케이터 반환 */
  kpiValue(title: string): Locator {
    return this.kpiCard(title).locator("[data-testid='kpi-value'], .text-3xl, .text-2xl").first();
  }
}
