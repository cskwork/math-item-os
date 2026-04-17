import { describe, it, expect } from "vitest";
import { DEFAULT_ORG_ID, getOrgId } from "../org-context";

describe("org-context", () => {
  it("exposes the MVP default org id constant", () => {
    expect(DEFAULT_ORG_ID).toBe("default-org");
  });

  it("getOrgId() returns the default org id in MVP mode", () => {
    expect(getOrgId()).toBe(DEFAULT_ORG_ID);
  });

  it("getOrgId() returns a non-empty string", () => {
    const orgId = getOrgId();
    expect(typeof orgId).toBe("string");
    expect(orgId.length).toBeGreaterThan(0);
  });
});
