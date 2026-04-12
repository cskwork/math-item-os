// metadata-suggest.service 단위 테스트
// - embedding.service의 generateEmbedding/generateEmbeddingBatch는 mock
// - prisma는 실제 테스트 DB 사용 (Skill, Standard, Misconception 시드)
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { prisma } from "@math-item-os/db";

// embedding.service mock - 모듈 import 전에 선언
vi.mock("../embedding.service", () => ({
  generateEmbedding: vi.fn(),
  generateEmbeddingBatch: vi.fn(),
}));

import * as embeddingService from "../embedding.service";
import { suggestMetadata } from "../metadata-suggest.service";

const mockedGenerateEmbedding = vi.mocked(embeddingService.generateEmbedding);
const mockedGenerateEmbeddingBatch = vi.mocked(
  embeddingService.generateEmbeddingBatch,
);

// ─────────────────────────────────────────────
// 시드 식별자 (충돌 방지 prefix)
// ─────────────────────────────────────────────

const ORG_HAPPY = "test-meta-org-happy";
const ORG_EMPTY = "test-meta-org-empty";
const ORG_CACHE = "test-meta-org-cache";
const ORG_RANK = "test-meta-org-rank";

const SKILL_LINEAR = "test-meta-skill-linear";
const SKILL_QUAD = "test-meta-skill-quad";
const STD_HAPPY = "test-meta-std-happy";
const MC_HAPPY = "test-meta-mc-happy";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for metadata-suggest tests");
  }

  // 4개의 테스트 org 생성
  for (const orgId of [ORG_HAPPY, ORG_EMPTY, ORG_CACHE, ORG_RANK]) {
    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: `Meta Test ${orgId}`, slug: orgId },
      update: {},
    });
  }

  // ORG_HAPPY: 스킬 2개 + 성취기준 1개 + 오개념 1개 시드
  await prisma.skill.upsert({
    where: { id: SKILL_LINEAR },
    create: {
      id: SKILL_LINEAR,
      orgId: ORG_HAPPY,
      code: "TEST-LINEAR",
      title: "일차방정식의 풀이",
      description: "일차방정식 ax+b=c 형태의 해 구하기",
      topicPath: "math.equation.linear",
    },
    update: {},
  });
  await prisma.skill.upsert({
    where: { id: SKILL_QUAD },
    create: {
      id: SKILL_QUAD,
      orgId: ORG_HAPPY,
      code: "TEST-QUAD",
      title: "이차방정식의 풀이",
      description: "이차방정식의 해 구하기",
      topicPath: "math.equation.quad",
    },
    update: {},
  });

  await prisma.standard.upsert({
    where: { id: STD_HAPPY },
    create: {
      id: STD_HAPPY,
      orgId: ORG_HAPPY,
      code: "TEST-STD-9-1",
      title: "중1 일차방정식 성취기준",
      schoolLevel: "middle",
      grade: 1,
      topicPath: "math.equation",
    },
    update: {},
  });

  await prisma.misconception.upsert({
    where: { id: MC_HAPPY },
    create: {
      id: MC_HAPPY,
      orgId: ORG_HAPPY,
      code: "TEST-MC-1",
      title: "이항 시 부호 누락",
      typicalError: "x+3=5에서 x=5+3으로 계산",
      relatedSkills: ["TEST-LINEAR"],
    },
    update: {},
  });

  // ORG_RANK: 스킬 2개 (캐시 검증용)
  await prisma.skill.upsert({
    where: { id: "test-meta-skill-rank-a" },
    create: {
      id: "test-meta-skill-rank-a",
      orgId: ORG_RANK,
      code: "TEST-RANK-A",
      title: "Skill A",
      topicPath: "math.test.a",
    },
    update: {},
  });
  await prisma.skill.upsert({
    where: { id: "test-meta-skill-rank-b" },
    create: {
      id: "test-meta-skill-rank-b",
      orgId: ORG_RANK,
      code: "TEST-RANK-B",
      title: "Skill B",
      topicPath: "math.test.b",
    },
    update: {},
  });

  // ORG_CACHE: 스킬 1개 (org 격리 검증용)
  await prisma.skill.upsert({
    where: { id: "test-meta-skill-cache-a" },
    create: {
      id: "test-meta-skill-cache-a",
      orgId: ORG_CACHE,
      code: "TEST-CACHE-A",
      title: "Cache Skill",
      topicPath: "math.test.cache",
    },
    update: {},
  });
});

afterAll(async () => {
  // 시드 정리: prefix 매칭으로 모두 삭제
  await prisma.misconception.deleteMany({
    where: { id: { startsWith: "test-meta-" } },
  });
  await prisma.standard.deleteMany({
    where: { id: { startsWith: "test-meta-" } },
  });
  await prisma.skill.deleteMany({
    where: { id: { startsWith: "test-meta-" } },
  });
  await prisma.organization.deleteMany({
    where: { id: { startsWith: "test-meta-" } },
  });
  await prisma.$disconnect();
});

beforeEach(() => {
  mockedGenerateEmbedding.mockReset();
  mockedGenerateEmbeddingBatch.mockReset();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe("suggestMetadata - happy path", () => {
  it("본문 임베딩과 스킬 임베딩의 유사도가 높을 때 스킬/성취기준/오개념을 추천한다", async () => {
    // body 임베딩과 LINEAR 스킬 임베딩을 동일하게 -> 코사인 유사도 1.0
    const matchingVec = [1, 0, 0, 0];
    const orthogonalVec = [0, 1, 0, 0];

    mockedGenerateEmbedding.mockResolvedValue(matchingVec);
    // 두 스킬 - 첫 번째는 매칭, 두 번째는 직교
    mockedGenerateEmbeddingBatch.mockResolvedValue([
      matchingVec,
      orthogonalVec,
    ]);

    const result = await suggestMetadata(
      {
        bodyLatex: "2x + 3 = 7을 풀어라",
        schoolLevel: "middle",
        grade: 1,
        itemType: "short_answer",
        solutionSteps: 3,
      },
      ORG_HAPPY,
    );

    // 스킬: LINEAR만 추천 (similarity >= 0.3 임계값)
    expect(result.skills.length).toBeGreaterThanOrEqual(1);
    const codes = result.skills.map((s) => s.code);
    expect(codes).toContain("TEST-LINEAR");
    // 첫 번째는 가장 높은 유사도 (1.0)
    expect(result.skills[0]!.similarity).toBeCloseTo(1.0, 2);

    // 성취기준: 중학교 1학년 매칭
    expect(result.standards.length).toBeGreaterThanOrEqual(1);
    expect(result.standards.map((s) => s.code)).toContain("TEST-STD-9-1");

    // 오개념: TEST-LINEAR와 연결된 MC
    expect(result.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(result.misconceptions.map((m) => m.code)).toContain("TEST-MC-1");

    // 블룸 수준: short_answer + solutionSteps=3 → 3
    expect(result.bloomLevel).toBe(3);
  });
});

describe("suggestMetadata - 임베딩 실패", () => {
  it("본문 임베딩이 null이면 스킬/오개념은 비고 성취기준/블룸은 정상", async () => {
    mockedGenerateEmbedding.mockResolvedValue(null);
    mockedGenerateEmbeddingBatch.mockResolvedValue([]);

    const result = await suggestMetadata(
      {
        bodyLatex: "",
        schoolLevel: "middle",
        grade: 1,
        itemType: "essay",
      },
      ORG_HAPPY,
    );

    // 스킬 추천 불가
    expect(result.skills).toEqual([]);
    // 오개념도 비어야 함 (스킬 코드가 없으므로)
    expect(result.misconceptions).toEqual([]);
    // 성취기준은 schoolLevel/grade로 직접 조회 → 정상 반환
    expect(result.standards.map((s) => s.code)).toContain("TEST-STD-9-1");
    // essay → 블룸 5
    expect(result.bloomLevel).toBe(5);
  });
});

describe("suggestMetadata - 캐시 동작 (org 단위)", () => {
  it("동일 org 두 번째 호출 시 generateEmbeddingBatch는 재호출되지 않고, 다른 org는 별도 캐시를 사용한다", async () => {
    const vec = [1, 0];
    mockedGenerateEmbedding.mockResolvedValue(vec);
    mockedGenerateEmbeddingBatch.mockResolvedValue([vec, vec]);

    // ORG_RANK 1st call → 캐시 미스, batch 1회 호출
    await suggestMetadata(
      { bodyLatex: "test", schoolLevel: "middle", grade: 1 },
      ORG_RANK,
    );
    expect(mockedGenerateEmbeddingBatch).toHaveBeenCalledTimes(1);

    // ORG_RANK 2nd call → 캐시 히트, batch 호출 횟수 변화 없음
    await suggestMetadata(
      { bodyLatex: "test 2", schoolLevel: "middle", grade: 1 },
      ORG_RANK,
    );
    expect(mockedGenerateEmbedding).toHaveBeenCalledTimes(2);
    expect(mockedGenerateEmbeddingBatch).toHaveBeenCalledTimes(1);

    // ORG_CACHE (다른 org) 호출 → 캐시 미스, batch 1회 추가 호출
    await suggestMetadata(
      { bodyLatex: "test 3", schoolLevel: "middle", grade: 1 },
      ORG_CACHE,
    );
    expect(mockedGenerateEmbeddingBatch).toHaveBeenCalledTimes(2);

    // ORG_RANK 다시 호출 → 여전히 캐시 히트
    await suggestMetadata(
      { bodyLatex: "test 4", schoolLevel: "middle", grade: 1 },
      ORG_RANK,
    );
    expect(mockedGenerateEmbeddingBatch).toHaveBeenCalledTimes(2);
  });
});
