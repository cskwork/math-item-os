/**
 * E2E 페이지 객체 모델 - 문항 등록 페이지
 * Route: /items/new
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class ItemCreatePage extends BasePage {
  /** 페이지 heading */
  readonly pageHeading: Locator;

  /** 폼 에러 메시지 영역 */
  readonly errorMessage: Locator;

  /** KaTeX 수식 미리보기 영역 */
  readonly katexPreview: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    this.pageHeading = this.heading("문항 등록");
    this.errorMessage = this.page.locator("[class*='border-red']");
    this.katexPreview = this.page.locator(".katex");
  }

  /** /items/new 페이지로 이동 */
  async goto(): Promise<void> {
    await this.page.goto("/items/new");
  }

  /**
   * 라벨 텍스트 옆의 combobox를 찾아 선택
   * 이 페이지의 select들은 <label>이 아닌 div 텍스트를 사용
   */
  private selectByLabel(labelText: string): Locator {
    return this.page
      .getByText(labelText, { exact: true })
      .locator("..")
      .getByRole("combobox");
  }

  /** 수식 LaTeX 입력 (FormulaEditor textarea) */
  async fillLatex(latex: string): Promise<void> {
    await this.page
      .getByPlaceholder("LaTeX 수식을 입력하세요")
      .fill(latex);
  }

  /** 학교급 선택 */
  async selectSchoolLevel(level: string): Promise<void> {
    await this.selectByLabel("학교급").selectOption(level);
  }

  /** 학년 선택 */
  async selectGrade(grade: string): Promise<void> {
    await this.selectByLabel("학년").selectOption(grade);
  }

  /** 문항 유형 선택 */
  async selectItemType(type: string): Promise<void> {
    await this.selectByLabel("문항 유형").selectOption(type);
  }

  /** 정답 형식 선택 */
  async selectAnswerFormat(format: string): Promise<void> {
    await this.selectByLabel("정답 형식").first().selectOption(format);
  }

  /** 정답 값 입력 */
  async fillAnswer(value: string): Promise<void> {
    await this.page.getByPlaceholder("정답을 입력하세요").fill(value);
  }

  /** 난이도 선택 (라디오 버튼 라벨로 선택) */
  async selectDifficulty(label: string): Promise<void> {
    await this.page.getByRole("radio", { name: label }).click();
  }

  /** 등록 버튼 클릭 */
  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: "등록" }).click();
  }

  /** 취소 버튼/링크 클릭 */
  async cancel(): Promise<void> {
    // 취소는 링크로 구현됨
    await this.page.getByRole("link", { name: "취소" }).first().click();
  }
}
