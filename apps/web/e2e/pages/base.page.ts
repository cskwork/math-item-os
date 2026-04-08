/**
 * E2E 페이지 객체 모델 - 기본 클래스
 * 공통 사이드바 네비게이션 및 유틸리티 메서드 제공
 */

import { type Page, type Locator } from "@playwright/test";

/** 사이드바 메뉴 라벨 */
export const SIDEBAR_LABELS = [
  "문항 관리",
  "검색",
  "스킬 그래프",
  "오개념",
  "대시보드",
  "검수 큐",
  "문항 생성",
  "학습지",
  "사용자",
  "감사 로그",
] as const;

export type SidebarLabel = (typeof SIDEBAR_LABELS)[number];

export class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * 사이드바 링크를 클릭하여 해당 페이지로 이동
   */
  async navigateTo(label: string): Promise<void> {
    await this.page.getByRole("link", { name: label }).click();
  }

  /**
   * tRPC 응답 대기 (배치 URL 패턴: /api/trpc/{procedureName})
   */
  async waitForTrpcResponse(procedureName: string): Promise<void> {
    await this.page.waitForResponse((response) =>
      response.url().includes(`/api/trpc/${procedureName}`),
    );
  }

  /**
   * 지정된 텍스트를 포함하는 heading 로케이터 반환
   */
  heading(text: string): Locator {
    return this.page.getByRole("heading", { name: text });
  }
}
