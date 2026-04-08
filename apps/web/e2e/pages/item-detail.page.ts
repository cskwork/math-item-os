/**
 * E2E 페이지 객체 모델 - 문항 상세 페이지
 * Route: /items/[id]
 */

import { type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

/** 문항 상태 한국어 라벨 매핑 */
export const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  reviewed: "검토완료",
  approved: "승인",
  retired: "폐기",
} as const;

export class ItemDetailPage extends BasePage {
  /** 상태 뱃지 */
  readonly statusBadge: Locator;

  /** 버전 뱃지 */
  readonly versionBadge: Locator;

  /** 수정 버튼 */
  readonly editButton: Locator;

  /** 목록으로 돌아가기 링크 */
  readonly backToListLink: Locator;

  /** 스킬 뱃지 목록 */
  readonly skillBadges: Locator;

  /** 교육과정 표준 뱃지 목록 */
  readonly standardBadges: Locator;

  /** 오개념 뱃지 목록 */
  readonly misconceptionBadges: Locator;

  /** KaTeX 렌더링 영역 */
  readonly katexDisplay: Locator;

  /** 버전 히스토리 테이블 행 */
  readonly versionHistory: Locator;

  /** 에러 메시지 영역 */
  readonly errorMessage: Locator;

  constructor(page: import("@playwright/test").Page) {
    super(page);
    // 상태/버전 뱃지는 인라인 텍스트 요소로 렌더링됨
    this.statusBadge = this.page.locator("span").filter({
      hasText: /초안|검토완료|승인|폐기/,
    }).first();
    this.versionBadge = this.page.getByText(/^v\d+$/);
    this.editButton = this.page.getByRole("button", { name: "수정" });
    this.backToListLink = this.page.getByRole("link", { name: "목록" });
    // 메타데이터 뱃지 영역 - 색상 클래스로 구분
    this.skillBadges = this.page.locator("[class*='bg-indigo']");
    this.standardBadges = this.page.locator("[class*='bg-emerald']");
    this.misconceptionBadges = this.page.locator("[class*='bg-amber']");
    this.katexDisplay = this.page.locator(".katex");
    this.versionHistory = this.page.getByRole("table").getByRole("row");
    this.errorMessage = this.page.locator("[class*='border-red']");
  }

  /** /items/{id} 페이지로 이동 */
  async goto(id: string): Promise<void> {
    await this.page.goto(`/items/${id}`);
  }

  /**
   * 상태 전환 버튼 로케이터 반환
   * 패턴: "{라벨}(으)로 전환"
   */
  transitionButton(targetStatus: string): Locator {
    const label = STATUS_LABELS[targetStatus] ?? targetStatus;
    return this.page.getByRole("button", {
      name: new RegExp(`${label}\\(으\\)로 전환`),
    });
  }

  /** 상태 전환 버튼 클릭 */
  async clickTransition(targetStatus: string): Promise<void> {
    await this.transitionButton(targetStatus).click();
  }

  /**
   * InfoRow에서 라벨에 해당하는 값 텍스트 반환
   * 라벨 옆의 값 요소를 찾아 textContent를 반환
   */
  infoRow(label: string): Locator {
    return this.page
      .locator("div", { has: this.page.getByText(label, { exact: true }) })
      .locator("dd, span:last-child, p")
      .first();
  }
}
