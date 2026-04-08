/**
 * E2E 페이지 객체 모델 - 스킬 관리 페이지
 * Route: /skills
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class SkillsListPage extends BasePage {
  /** 페이지 heading */
  readonly pageHeading: Locator;

  /** 스킬 테이블 행 목록 */
  readonly skillRows: Locator;

  /** 페이지 인디케이터 (예: "1 / 3 페이지") */
  readonly pageIndicator: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.pageHeading = this.heading("스킬 관리");
    this.skillRows = this.page.getByRole("table").getByRole("row");
    this.pageIndicator = this.page.getByText(/\d+ \/ \d+ 페이지/);
  }

  /** /skills 페이지로 이동 */
  async goto(): Promise<void> {
    await this.page.goto("/skills");
  }

  /** 새 스킬 추가 버튼 클릭 */
  async clickNewSkill(): Promise<void> {
    await this.page.getByRole("button", { name: "새 스킬 추가" }).click();
  }

  /** 그래프 보기 링크 클릭 */
  async clickGraphView(): Promise<void> {
    await this.page.getByRole("link", { name: "그래프 보기" }).click();
  }

  /** n번째 행의 수정 버튼 클릭 (0-based index) */
  async editSkill(index: number): Promise<void> {
    await this.skillRows
      .nth(index)
      .getByRole("button", { name: "수정" })
      .click();
  }

  /** n번째 행의 삭제 버튼 클릭 (0-based index) */
  async deleteSkill(index: number): Promise<void> {
    await this.skillRows
      .nth(index)
      .getByRole("button", { name: "삭제" })
      .click();
  }

  /** 삭제 확인 모달에서 확인 클릭 */
  async confirmDelete(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "확인" })
      .click();
  }

  /** 삭제 확인 모달에서 취소 클릭 */
  async cancelDelete(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "취소" })
      .click();
  }

  /** 분류 경로 필터 입력 */
  async filterByTopicPath(path: string): Promise<void> {
    await this.page.getByLabel("분류 경로").fill(path);
  }

  /** Bloom 수준 필터 선택 */
  async filterByBloomLevel(level: string): Promise<void> {
    // "Bloom 수준" 라벨의 부모 div에서 combobox 선택
    const bloomLabel = this.page.getByText("Bloom 수준", { exact: true }).first();
    await bloomLabel.locator("..").getByRole("combobox").selectOption(level);
  }

  /** 다음 페이지로 이동 */
  async goToNextPage(): Promise<void> {
    await this.page.getByRole("button", { name: "다음" }).click();
  }

  /** 이전 페이지로 이동 */
  async goToPrevPage(): Promise<void> {
    await this.page.getByRole("button", { name: "이전" }).click();
  }
}
