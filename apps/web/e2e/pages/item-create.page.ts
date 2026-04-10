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
   * 라벨 텍스트로 연결된 select 요소를 반환
   * SelectField 컴포넌트가 htmlFor/id로 label-select를 연결하므로 getByLabel 사용
   */
  private selectByLabel(labelText: string): Locator {
    return this.page.getByLabel(labelText, { exact: true });
  }

  /** 수식 LaTeX 입력 (BlockEditor 소스 모드 textarea) */
  async fillLatex(latex: string): Promise<void> {
    // 소스 모드 토글 버튼 클릭
    const sourceBtn = this.page.getByRole("button", { name: "소스 모드" });
    if (await sourceBtn.isVisible()) {
      await sourceBtn.click();
    }
    // 소스 모드 textarea에 입력
    const textarea = this.page.getByPlaceholder("LaTeX 소스를 직접 입력하세요");
    await textarea.fill(latex);
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
