import { describe, it, expect } from "vitest";
import { MISCONCEPTIONS } from "../misconceptions";
import { SKILLS } from "../skills";

describe("misconceptions seed data integrity", () => {
  const validSkillCodes = new Set(SKILLS.map((s) => s.code));

  it("every relatedSkills code references an existing skill", () => {
    const invalid: string[] = [];
    for (const m of MISCONCEPTIONS) {
      for (const code of m.relatedSkills) {
        if (!validSkillCodes.has(code)) {
          invalid.push(`${m.code} → ${code}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });
});
