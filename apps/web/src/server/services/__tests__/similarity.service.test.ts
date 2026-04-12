// similarity.service 단위 테스트
// 순수 함수(시그널 계산기)는 즉시 검증하고,
// findSimilarItems는 실제 Prisma + embedding.service 모킹으로 검증한다.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// ─────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────
const TEST_DB_URL =
  "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
process.env.TEST_DATABASE_URL ??= TEST_DB_URL;
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;
process.env.DIRECT_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;

// ─────────────────────────────────────────────
// embedding.service 모킹: math-ai HTTP 호출 회피
// ─────────────────────────────────────────────
const findSimilarByVectorMock = vi.fn();
const generateEmbeddingMock = vi.fn();

vi.mock("../embedding.service", () => ({
  buildEmbeddingText: (input: { bodyLatex: string }) => input.bodyLatex,
  generateEmbedding: (text: string) => generateEmbeddingMock(text),
  findSimilarByVector: (
    embedding: number[],
    orgId: string,
    limit: number,
    excludeId?: string,
  ) => findSimilarByVectorMock(embedding, orgId, limit, excludeId),
}));

import { prisma } from "@math-item-os/db";
import {
  computeSkillMatch,
  computeFormulaStructure,
  computeDifficultyProximity,
  computeMisconceptionProfile,
  computeTextSemantic,
  buildExplanation,
  findSimilarItems,
} from "../similarity.service";

// ─────────────────────────────────────────────
// 시드 (다른 에이전트와 충돌 방지: test-sim-* 접두사)
// ─────────────────────────────────────────────
const PREFIX = "test-sim-svc";
const ORG_ID = `${PREFIX}-org`;
const SKILL_A = `${PREFIX}-skill-a`;
const SKILL_B = `${PREFIX}-skill-b`;

const sourceItemId = `${PREFIX}-item-source`;
const candidateItemId = `${PREFIX}-item-candidate`;

async function cleanup(): Promise<void> {
  const itemIds = [sourceItemId, candidateItemId];
  await prisma.auditLog.deleteMany({ where: { recordId: { in: itemIds } } });
  await prisma.itemSkill.deleteMany({ where: { itemId: { in: itemIds } } });
  await prisma.itemVersion.deleteMany({ where: { itemId: { in: itemIds } } });
  await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
}

beforeAll(async () => {
  // 일부 테스트 DB 환경에는 vector 컬럼/익스텐션이 없을 수 있으므로 보장
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  await prisma.$executeRawUnsafe(
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'items' AND column_name = 'embedding'
       ) THEN
         ALTER TABLE items ADD COLUMN embedding vector(768);
       END IF;
     END $$`,
  );

  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Sim Test Org", slug: `${PREFIX}-slug` },
    update: {},
  });
  await prisma.skill.upsert({
    where: { id: SKILL_A },
    create: {
      id: SKILL_A,
      orgId: ORG_ID,
      code: `${PREFIX}-a`,
      title: "스킬 A",
      topicPath: "sim.a",
    },
    update: {},
  });
  await prisma.skill.upsert({
    where: { id: SKILL_B },
    create: {
      id: SKILL_B,
      orgId: ORG_ID,
      code: `${PREFIX}-b`,
      title: "스킬 B",
      topicPath: "sim.b",
    },
    update: {},
  });
});

beforeEach(async () => {
  findSimilarByVectorMock.mockReset();
  generateEmbeddingMock.mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.itemSkill.deleteMany({ where: { skillId: { in: [SKILL_A, SKILL_B] } } });
  await prisma.skill.deleteMany({ where: { id: { in: [SKILL_A, SKILL_B] } } });
  await prisma.organization.deleteMany({ where: { id: ORG_ID } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────
// 1. 순수 함수 시그널 계산
// ─────────────────────────────────────────────

describe("similarity 순수 시그널 함수", () => {
  it("computeSkillMatch: 완전 일치 1.0, 부분 일치 Jaccard, 빈 값 0", () => {
    expect(computeSkillMatch(["a", "b"], ["a", "b"])).toBe(1);
    // Jaccard: |{a}| / |{a,b,c}| = 1/3
    expect(computeSkillMatch(["a", "b"], ["a", "c"])).toBeCloseTo(1 / 3);
    expect(computeSkillMatch([], [])).toBe(0);
  });

  it("computeFormulaStructure / computeMisconceptionProfile / computeDifficultyProximity / computeTextSemantic", () => {
    // 수식 구조: 둘 다 null이면 0, 토큰 일치 시 양수
    expect(computeFormulaStructure(null, null)).toBe(0);
    expect(computeFormulaStructure("Eq(x+1, 2)", "Eq(x+1, 2)")).toBeCloseTo(1);

    // 오개념 Jaccard
    expect(computeMisconceptionProfile(["m1"], ["m1"])).toBe(1);
    expect(computeMisconceptionProfile([], [])).toBe(0);

    // 난이도 근접: 동일 → 1, 한쪽 null → 0.5
    expect(computeDifficultyProximity(3, 3)).toBe(1);
    expect(computeDifficultyProximity(3, null)).toBe(0.5);
    expect(computeDifficultyProximity(1, 5)).toBe(0); // 차이 4 / 4 → 0

    // 텍스트 의미: 거리 0 → 1, 거리 1 → 0, 음수 거리(예외 입력) 클램프
    expect(computeTextSemantic(0)).toBe(1);
    expect(computeTextSemantic(1)).toBe(0);
    expect(computeTextSemantic(-0.5)).toBe(1);
  });

  it("buildExplanation: 시그널이 모두 0이면 한국어 안내 문구를 반환한다", () => {
    const explanation = buildExplanation(
      {
        skillMatch: 0,
        formulaStructure: 0,
        prerequisiteDistance: 0,
        textSemantic: 0,
        difficultyProximity: 0,
        misconceptionProfile: 0,
      },
      [],
      [],
    );
    expect(explanation).toContain("감지");
  });
});

// ─────────────────────────────────────────────
// 2. findSimilarItems (실 DB + 모킹된 임베딩 서비스)
// ─────────────────────────────────────────────

describe("findSimilarItems", () => {
  async function seedItem(id: string, opts?: { skill?: string }) {
    await prisma.item.create({
      data: {
        id,
        orgId: ORG_ID,
        bodyLatex: "x + 1 = 2",
        bodySympy: "Eq(x+1, 2)",
        difficultyAuthor: 3,
        schoolLevel: "middle",
        grade: 7,
        itemType: "short_answer",
        answerFormat: "exact_value",
        answer: { value: "1", format: "exact_value" },
        currentVersion: 1,
      },
    });
    if (opts?.skill) {
      await prisma.itemSkill.create({
        data: { itemId: id, skillId: opts.skill, isPrimary: true },
      });
    }
    // raw SQL로 임베딩 컬럼을 기록해 두면 generateEmbedding을 호출하지 않음
    const dummyVec = `[${Array.from({ length: 768 }, () => 0.001).join(",")}]`;
    await prisma.$executeRawUnsafe(
      "UPDATE items SET embedding = $1::vector WHERE id = $2",
      dummyVec,
      id,
    );
  }

  it("happy path: 벡터 후보를 6시그널 점수로 랭킹해 상위 limit개를 반환한다", async () => {
    await seedItem(sourceItemId, { skill: SKILL_A });
    await seedItem(candidateItemId, { skill: SKILL_A });

    findSimilarByVectorMock.mockResolvedValue([
      { itemId: candidateItemId, distance: 0.1 },
    ]);

    const results = await findSimilarItems(sourceItemId, ORG_ID, 5);
    expect(results).toHaveLength(1);
    expect(results[0]!.itemId).toBe(candidateItemId);
    // 스킬이 동일하므로 skillMatch = 1, score > 0
    expect(results[0]!.score).toBeGreaterThan(0);
    expect(results[0]!.signals.skillMatch).toBe(1);
    expect(results[0]!.explanation).toContain("스킬");
  });

  it("error path: 존재하지 않는 sourceItemId면 빈 배열을 반환한다", async () => {
    const results = await findSimilarItems(
      `${PREFIX}-nonexistent`,
      ORG_ID,
      5,
    );
    expect(results).toEqual([]);
    // findSimilarByVector는 호출되지 않아야 함
    expect(findSimilarByVectorMock).not.toHaveBeenCalled();
  });

  it("edge case: 벡터 검색 결과가 비어있으면 빈 배열을 반환한다", async () => {
    await seedItem(sourceItemId, { skill: SKILL_A });
    findSimilarByVectorMock.mockResolvedValue([]);

    const results = await findSimilarItems(sourceItemId, ORG_ID, 5);
    expect(results).toEqual([]);
  });
});
