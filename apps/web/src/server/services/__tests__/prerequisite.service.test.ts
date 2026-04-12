// prerequisite.service 단위 테스트
// - 실제 테스트 DB에 PrerequisiteEdge를 생성/탐색
// - 자기 참조, 중복, 순환 감지를 검증
// - 그래프 순회 (descendants/ancestors) 검증
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import {
  createPrerequisiteEdge,
  getPrerequisiteGraph,
} from "../prerequisite.service";

// ─────────────────────────────────────────────
// 시드 식별자 (충돌 방지 prefix)
// ─────────────────────────────────────────────

const ORG_ID = "test-prereq-org";
const USER_ID = "test-prereq-user";

const SKILL_A = "test-prereq-skill-a";
const SKILL_B = "test-prereq-skill-b";
const SKILL_C = "test-prereq-skill-c";
const SKILL_D = "test-prereq-skill-d";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for prerequisite.service tests");
  }

  // Org
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Prereq Test Org", slug: "test-prereq-org" },
    update: {},
  });

  // 4개 스킬: A → B → C, 추가로 D (독립)
  for (const [id, code, title, topic] of [
    [SKILL_A, "TEST-PRQ-A", "Skill A", "math.prereq.a"],
    [SKILL_B, "TEST-PRQ-B", "Skill B", "math.prereq.b"],
    [SKILL_C, "TEST-PRQ-C", "Skill C", "math.prereq.c"],
    [SKILL_D, "TEST-PRQ-D", "Skill D", "math.prereq.d"],
  ] as const) {
    await prisma.skill.upsert({
      where: { id },
      create: { id, orgId: ORG_ID, code, title, topicPath: topic },
      update: {},
    });
  }

  // 기존 엣지/감사 로그 정리 (이전 실행 잔여물)
  await prisma.prerequisiteEdge.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.auditLog.deleteMany({
    where: { orgId: ORG_ID, tableName: "prerequisite_edges" },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { orgId: ORG_ID, tableName: "prerequisite_edges" },
  });
  await prisma.prerequisiteEdge.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.skill.deleteMany({
    where: { id: { startsWith: "test-prereq-" } },
  });
  await prisma.organization.deleteMany({ where: { id: ORG_ID } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────
// 1. createPrerequisiteEdge - 정상 경로
// ─────────────────────────────────────────────

describe("createPrerequisiteEdge - happy path", () => {
  it("엣지를 생성하고 DB에 저장한다 (감사 로그 포함)", async () => {
    const result = await createPrerequisiteEdge(
      { fromSkillId: SKILL_A, toSkillId: SKILL_B, strength: "strong" },
      USER_ID,
      ORG_ID,
    );

    expect(result.edge.fromSkillId).toBe(SKILL_A);
    expect(result.edge.toSkillId).toBe(SKILL_B);
    expect(result.edge.strength).toBe("strong");

    // DB 검증
    const dbEdge = await prisma.prerequisiteEdge.findUnique({
      where: {
        orgId_fromSkillId_toSkillId: {
          orgId: ORG_ID,
          fromSkillId: SKILL_A,
          toSkillId: SKILL_B,
        },
      },
    });
    expect(dbEdge).not.toBeNull();

    // 감사 로그 검증
    const audit = await prisma.auditLog.findFirst({
      where: {
        orgId: ORG_ID,
        tableName: "prerequisite_edges",
        recordId: result.edge.id,
        action: "create",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.performedBy).toBe(USER_ID);
  });
});

// ─────────────────────────────────────────────
// 2. createPrerequisiteEdge - 검증 실패
// ─────────────────────────────────────────────

describe("createPrerequisiteEdge - validations", () => {
  it("자기 참조 시 SELF_REFERENCE 에러를 던진다", async () => {
    await expect(
      createPrerequisiteEdge(
        { fromSkillId: SKILL_A, toSkillId: SKILL_A, strength: "strong" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "SELF_REFERENCE",
    });
  });

  it("순환을 만드는 엣지는 CYCLE_DETECTED 에러를 던진다", async () => {
    // 사전 조건: A → B 는 happy path 테스트에서 생성됨
    // B → C 추가
    await createPrerequisiteEdge(
      { fromSkillId: SKILL_B, toSkillId: SKILL_C, strength: "strong" },
      USER_ID,
      ORG_ID,
    );

    // 이제 A → B → C 가 존재. C → A 를 추가하면 순환 발생.
    await expect(
      createPrerequisiteEdge(
        { fromSkillId: SKILL_C, toSkillId: SKILL_A, strength: "strong" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "CYCLE_DETECTED",
    });

    // 직접 순환도 차단: B → A 추가 시 순환
    await expect(
      createPrerequisiteEdge(
        { fromSkillId: SKILL_B, toSkillId: SKILL_A, strength: "strong" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

// ─────────────────────────────────────────────
// 3. getPrerequisiteGraph - 전이 탐색
// ─────────────────────────────────────────────

describe("getPrerequisiteGraph - traversal", () => {
  it("descendants 방향으로 전이 후손을 모두 반환한다", async () => {
    // A → B → C 가 존재해야 함 (이전 테스트가 생성)
    const graph = await getPrerequisiteGraph(
      { skillId: SKILL_A, depth: 5, direction: "descendants" },
      ORG_ID,
    );

    const nodeIds = graph.nodes.map((n) => n.skill.id).sort();
    // A (root), B (1단계), C (2단계 후손)
    expect(nodeIds).toContain(SKILL_A);
    expect(nodeIds).toContain(SKILL_B);
    expect(nodeIds).toContain(SKILL_C);

    // 엣지: A→B, B→C (탐색된 노드 간)
    const edgePairs = graph.edges
      .map((e) => `${e.from}->${e.to}`)
      .sort();
    expect(edgePairs).toContain(`${SKILL_A}->${SKILL_B}`);
    expect(edgePairs).toContain(`${SKILL_B}->${SKILL_C}`);
  });

  it("ancestors 방향으로 C의 조상 (A, B)을 반환한다", async () => {
    const graph = await getPrerequisiteGraph(
      { skillId: SKILL_C, depth: 5, direction: "ancestors" },
      ORG_ID,
    );

    const nodeIds = graph.nodes.map((n) => n.skill.id);
    expect(nodeIds).toContain(SKILL_A);
    expect(nodeIds).toContain(SKILL_B);
    expect(nodeIds).toContain(SKILL_C);
  });
});
