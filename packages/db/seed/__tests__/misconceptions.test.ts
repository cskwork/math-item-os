import { describe, it, expect } from "vitest";
import { MISCONCEPTIONS } from "../misconceptions";
import { SKILLS } from "../skills";

describe("misconceptions seed data integrity", () => {
  // Set<string>으로 명시 — SKILLS가 `as const`라 리터럴 유니온으로 추론되면
  // 일반 string인 m.relatedSkills의 코드를 has()로 검사할 수 없음
  const validSkillCodes = new Set<string>(SKILLS.map((s) => s.code));

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
