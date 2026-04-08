/**
 * E2E 페이지 객체 모델 - 문항 목록 페이지
 * Route: /items
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class ItemsListPage extends BasePage {
  /** 페이지 heading */
  readonly pageHeading: Locator;

  /** 문항 카드 목록 (button 요소, 버전 텍스트 포함) */
  readonly itemCards: Locator;

  /** 총 건수 텍스트 (예: "총 100건") */
  readonly totalCountText: Locator;

  /** 페이지 인디케이터 (예: "1 / 5 페이지") */
  readonly pageIndicator: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.pageHeading = this.heading("문항 목록");
    this.itemCards = this.page.getByRole("main").getByRole("button").filter({ hasText: /v\d+/ });
    this.totalCountText = this.page.getByText(/총 \d+건/);
    this.pageIndicator = this.page.getByText(/\d+ \/ \d+ 페이지/);
  }

  /**
   * 라벨 텍스트의 직접 부모에서 combobox를 찾아 반환
   */
  private selectByLabel(labelText: string): Locator {
    return this.page
      .getByText(labelText, { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  /** /items 페이지로 이동 */
  async goto(): Promise<void> {
    await this.page.goto("/items");
  }

  /** 상태 필터 선택 */
  async filterByStatus(status: string): Promise<void> {
    await this.selectByLabel("상태").selectOption(status);
  }

  /** 학교급 필터 선택 */
  async filterBySchoolLevel(level: string): Promise<void> {
    await this.selectByLabel("학교급").selectOption(level);
  }

  /** 문항 유형 필터 선택 */
  async filterByItemType(type: string): Promise<void> {
    await this.selectByLabel("문항 유형").selectOption(type);
  }

  /** 필터 초기화 */
  async resetFilters(): Promise<void> {
    await this.page.getByRole("button", { name: "필터 초기화" }).click();
  }

  /** 정렬 기준 선택 */
  async sortBy(option: string): Promise<void> {
    await this.selectByLabel("정렬 기준").selectOption(option);
  }

  /** 다음 페이지로 이동 */
  async goToNextPage(): Promise<void> {
    await this.page.getByRole("button", { name: "다음" }).click();
  }

  /** 이전 페이지로 이동 */
  async goToPrevPage(): Promise<void> {
    await this.page.getByRole("button", { name: "이전" }).click();
  }

  /** 문항 등록 링크 클릭 */
  async clickNewItem(): Promise<void> {
    await this.page.getByRole("link", { name: "문항 등록" }).click();
  }

  /** n번째 문항 카드 클릭 (0-based index) */
  async clickItem(index: number): Promise<void> {
    await this.itemCards.nth(index).click();
  }
}
