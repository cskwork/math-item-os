/**
 * 조직 컨텍스트 해석.
 *
 * MVP 단계에서는 단일 조직(`default-org`)만 지원한다.
 * 멀티테넌시 도입 시 `getOrgId()`만 세션/요청 컨텍스트 기반 해석으로 교체하면,
 * 모든 호출부가 자동으로 새 동작을 따른다.
 */
export const DEFAULT_ORG_ID = "default-org";

export function getOrgId(): string {
  return DEFAULT_ORG_ID;
}
