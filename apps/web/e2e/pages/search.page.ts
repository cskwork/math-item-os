/**
 * E2E 페이지 객체 모델 - 문항 검색 페이지
 * Route: /search
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class SearchPage extends BasePage {
  /** 페이지 heading */
  readonly pageHeading: Locator;

  /** 검색 입력 필드 (SearchBar) */
  readonly searchInput: Locator;

  /** 검색 결과 카드 목록 */
  readonly resultCards: Locator;

  /** 결과 건수 텍스트 */
  readonly resultCount: Locator;

  /** 결과 없음 상태 영역 */
  readonly noResults: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.pageHeading = this.heading("문항 검색");
    this.searchInput = this.page.getByPlaceholder("검색어를 입력하세요");
    this.resultCards = this.page.getByRole("main").getByRole("button").filter({ hasText: /v\d+/ });
    this.resultCount = this.page.getByText(/총 \d+건/);
    this.noResults = this.page.getByText("검색 결과가 없습니다");
  }

  /** /search 페이지로 이동 */
  async goto(): Promise<void> {
    await this.page.goto("/search");
  }

  /** 검색어 입력 후 제출 */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  /** 관련도 정렬 */
  async sortByRelevance(): Promise<void> {
    await this.page.getByRole("button", { name: "관련도" }).click();
  }

  /** 최신순 정렬 */
  async sortByLatest(): Promise<void> {
    await this.page.getByRole("button", { name: "최신순" }).click();
  }

  /** 난이도 정렬 */
  async sortByDifficulty(): Promise<void> {
    await this.page.getByRole("button", { name: "난이도" }).click();
  }

  /** 학교급 필터 선택 */
  async filterBySchoolLevel(level: string): Promise<void> {
    await this.page.getByLabel("학교급").selectOption(level);
  }

  /** 필터 초기화 */
  async clearFilters(): Promise<void> {
    await this.page.getByRole("button", { name: "필터 초기화" }).click();
  }
}
