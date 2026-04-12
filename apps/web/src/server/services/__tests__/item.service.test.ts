// item.service 단위 테스트 (실제 Prisma + 외부 I/O 모킹)
// 실 DB(mathitem_test)에 시드를 넣고 createItem/updateItem/getItemById/listItems를 검증한다.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";

// ─────────────────────────────────────────────
// 환경 변수 (Prisma import 전에 설정해야 한다)
// ─────────────────────────────────────────────
const TEST_DB_URL =
  "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
process.env.TEST_DATABASE_URL ??= TEST_DB_URL;
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;
process.env.DIRECT_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;

// ─────────────────────────────────────────────
// 외부 I/O 모킹
// - convertLatex: math-ai HTTP 호출 회피
// - meilisearch: 인덱싱 회피
// ─────────────────────────────────────────────
vi.mock("../conversion.service", () => ({
  convertLatex: vi.fn(async (latex: string) => ({
    mathml: `<math>${latex}</math>`,
    sympy: `Eq(${latex})`,
    html: `<span>${latex}</span>`,
    errors: [],
  })),
}));

vi.mock("../meilisearch.service", () => ({
  indexItem: vi.fn(async () => undefined),
  deleteItemFromIndex: vi.fn(async () => undefined),
  toMeilisearchDocument: vi.fn(),
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  createItem,
  updateItem,
  getItemById,
  listItems,
  type CreateItemInput,
} from "../item.service";

// ─────────────────────────────────────────────
// 시드 데이터 (다른 에이전트와 충돌 방지를 위해 test-item-* 접두사 사용)
// ─────────────────────────────────────────────
const PREFIX = "test-item-svc";
const ORG_ID = `${PREFIX}-org`;
const OTHER_ORG_ID = `${PREFIX}-other-org`;
const USER_ID = `${PREFIX}-user`;
const SKILL_ID = `${PREFIX}-skill`;

const baseInput: CreateItemInput = {
  bodyLatex: "x + 1 = 2",
  answer: { value: "1", format: "exact_value" },
  schoolLevel: "middle",
  grade: 7,
  itemType: "short_answer",
  answerFormat: "exact_value",
  difficultyAuthor: 3,
};

// 매 테스트 사이 정리할 items의 ID 모음
const createdItemIds = new Set<string>();

async function cleanupAll(): Promise<void> {
  // 자식 → 부모 순서로 삭제
  if (createdItemIds.size > 0) {
    const ids = [...createdItemIds];
    await prisma.auditLog.deleteMany({ where: { recordId: { in: ids } } });
    await prisma.itemSkill.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.itemStandard.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.itemMisconception.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.difficultyProfile.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.itemVersion.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.item.deleteMany({ where: { id: { in: ids } } });
    createdItemIds.clear();
  }
  await prisma.auditLog.deleteMany({ where: { orgId: { in: [ORG_ID, OTHER_ORG_ID] } } });
}

beforeAll(async () => {
  // 조직/사용자/스킬 시드
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Test Org", slug: `${PREFIX}-slug` },
    update: {},
  });
  await prisma.organization.upsert({
    where: { id: OTHER_ORG_ID },
    create: { id: OTHER_ORG_ID, name: "Other Org", slug: `${PREFIX}-other-slug` },
    update: {},
  });
  await prisma.skill.upsert({
    where: { id: SKILL_ID },
    create: {
      id: SKILL_ID,
      orgId: ORG_ID,
      code: `${PREFIX}-code`,
      title: "테스트 스킬",
      topicPath: "test.skill",
    },
    update: {},
  });
});

beforeEach(async () => {
  await cleanupAll();
});

afterEach(async () => {
  await cleanupAll();
});

afterAll(async () => {
  // 시드 자체는 정리
  await prisma.skill.deleteMany({ where: { id: SKILL_ID } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG_ID, OTHER_ORG_ID] } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe("createItem", () => {
  it("happy path: 문항을 생성하고 ItemVersion/DifficultyProfile/AuditLog까지 함께 만든다", async () => {
    const result = await createItem(
      { ...baseInput, skillIds: [SKILL_ID] },
      USER_ID,
      ORG_ID,
    );

    expect(result.item).not.toBeNull();
    const itemId = result.item!.id;
    createdItemIds.add(itemId);

    // 본체 필드
    expect(result.item!.orgId).toBe(ORG_ID);
    expect(result.item!.bodyLatex).toBe(baseInput.bodyLatex);
    expect(result.item!.currentVersion).toBe(1);
    expect(result.item!.bodySympy).toContain("Eq");

    // 버전 이력
    const versions = await prisma.itemVersion.findMany({ where: { itemId } });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);

    // 난이도 프로필
    const profile = await prisma.difficultyProfile.findUnique({
      where: { itemId },
    });
    expect(profile?.authorDifficulty).toBe(3);

    // 스킬 연결 (첫 번째가 primary)
    const links = await prisma.itemSkill.findMany({ where: { itemId } });
    expect(links).toHaveLength(1);
    expect(links[0]!.isPrimary).toBe(true);

    // 감사 로그
    const logs = await prisma.auditLog.findMany({
      where: { recordId: itemId, action: "create" },
    });
    expect(logs).toHaveLength(1);
  });

  it("difficultyAuthor가 없으면 DifficultyProfile을 만들지 않는다", async () => {
    const { difficultyAuthor: _omit, ...withoutDifficulty } = baseInput;
    const result = await createItem(withoutDifficulty, USER_ID, ORG_ID);
    const itemId = result.item!.id;
    createdItemIds.add(itemId);

    const profile = await prisma.difficultyProfile.findUnique({
      where: { itemId },
    });
    expect(profile).toBeNull();
  });
});

describe("updateItem", () => {
  it("error path: 존재하지 않는 ID로 수정 시 NOT_FOUND", async () => {
    await expect(
      updateItem(
        { id: `${PREFIX}-nonexistent`, bodyLatex: "y = 0" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("happy path: bodyLatex 변경 시 currentVersion이 증가하고 새 ItemVersion이 추가된다", async () => {
    const created = await createItem(baseInput, USER_ID, ORG_ID);
    const itemId = created.item!.id;
    createdItemIds.add(itemId);

    const updated = await updateItem(
      {
        id: itemId,
        bodyLatex: "2x = 4",
        changeSummary: "본문 변경",
      },
      USER_ID,
      ORG_ID,
    );

    expect(updated.item!.currentVersion).toBe(2);
    expect(updated.item!.bodyLatex).toBe("2x = 4");
    expect(updated.version.version).toBe(2);
    expect(updated.version.changeSummary).toBe("본문 변경");

    const versions = await prisma.itemVersion.findMany({
      where: { itemId },
      orderBy: { version: "asc" },
    });
    expect(versions).toHaveLength(2);
  });

  it("edge case: 다른 조직의 문항을 수정하면 FORBIDDEN", async () => {
    const created = await createItem(baseInput, USER_ID, ORG_ID);
    const itemId = created.item!.id;
    createdItemIds.add(itemId);

    await expect(
      updateItem({ id: itemId, bodyLatex: "z = 1" }, USER_ID, OTHER_ORG_ID),
    ).rejects.toThrowError(/조직/);
  });
});

describe("getItemById & listItems", () => {
  it("listItems: 같은 조직의 문항만 페이지네이션하여 반환한다", async () => {
    // 동일 조직 2개, 다른 조직 1개 생성
    const a = await createItem(baseInput, USER_ID, ORG_ID);
    const b = await createItem({ ...baseInput, bodyLatex: "y = 0" }, USER_ID, ORG_ID);
    const c = await createItem(baseInput, USER_ID, OTHER_ORG_ID);
    createdItemIds.add(a.item!.id);
    createdItemIds.add(b.item!.id);
    createdItemIds.add(c.item!.id);

    const list = await listItems({ page: 1, limit: 10 }, ORG_ID);
    const ids = list.items.map((i) => i.id);
    expect(ids).toContain(a.item!.id);
    expect(ids).toContain(b.item!.id);
    expect(ids).not.toContain(c.item!.id);
    expect(list.total).toBeGreaterThanOrEqual(2);
  });
});
