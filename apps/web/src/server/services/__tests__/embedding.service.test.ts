// embedding.service 단위 테스트
// - fetch는 mock (math-ai 서비스 호출 없이 검증)
// - prisma는 실제 테스트 DB 사용
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@math-item-os/db";
import {
  buildEmbeddingText,
  generateEmbedding,
  generateEmbeddingBatch,
  syncItemEmbedding,
  findSimilarByVector,
} from "../embedding.service";

// ─────────────────────────────────────────────
// 전역 fetch mock
// ─────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─────────────────────────────────────────────
// 테스트 시드 식별자 (충돌 방지 prefix)
// ─────────────────────────────────────────────

const ORG_ID = "test-emb-org";
const ITEM_ID = "test-emb-item-1";

beforeAll(async () => {
  // 환경 변수 가드: 외부에서 설정되어야 함
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set to run embedding.service tests against the real test DB",
    );
  }

  // 테스트 조직 시드 (멱등)
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Embedding Test Org", slug: "test-emb-org" },
    update: {},
  });
});

afterAll(async () => {
  // 시드 정리
  await prisma.item.deleteMany({ where: { id: { startsWith: "test-emb-" } } });
  await prisma.organization.deleteMany({
    where: { id: { startsWith: "test-emb-" } },
  });
  await prisma.$disconnect();
});

beforeEach(() => {
  mockFetch.mockReset();
});

// ─────────────────────────────────────────────
// buildEmbeddingText (순수 함수)
// ─────────────────────────────────────────────

describe("buildEmbeddingText", () => {
  it("스킬과 오개념을 포함한 복합 텍스트를 결합한다", () => {
    const text = buildEmbeddingText({
      bodyLatex: "2x + 3 = 7",
      skills: [{ skill: { title: "일차방정식" } }],
      misconceptions: [{ misconception: { title: "이항 부호 오류" } }],
    });
    expect(text).toBe(
      "2x + 3 = 7 [skills: 일차방정식] [misconceptions: 이항 부호 오류]",
    );
  });

  it("스킬/오개념이 비어있으면 본문만 반환한다", () => {
    const text = buildEmbeddingText({ bodyLatex: "x = 1" });
    expect(text).toBe("x = 1");
  });
});

// ─────────────────────────────────────────────
// generateEmbedding - fetch mock 검증
// ─────────────────────────────────────────────

describe("generateEmbedding", () => {
  it("정상 응답에서 embedding 배열을 반환한다", async () => {
    const fakeVector = Array.from({ length: 8 }, (_, i) => i * 0.1);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: fakeVector }),
    });

    const result = await generateEmbedding("test text");

    expect(result).toEqual(fakeVector);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain("/similarity/embed");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("HTTP 오류 시 null을 반환한다 (예외를 던지지 않음)", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    const result = await generateEmbedding("text");
    expect(result).toBeNull();
  });

  it("네트워크 예외 시 null을 반환한다", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await generateEmbedding("text");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────
// generateEmbeddingBatch
// ─────────────────────────────────────────────

describe("generateEmbeddingBatch", () => {
  it("빈 배열 입력 시 fetch를 호출하지 않고 빈 배열을 반환한다", async () => {
    const result = await generateEmbeddingBatch([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("정상 응답에서 임베딩 배열 리스트를 반환한다", async () => {
    const fake = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: fake }),
    });

    const result = await generateEmbeddingBatch(["a", "b"]);
    expect(result).toEqual(fake);
  });
});

// ─────────────────────────────────────────────
// syncItemEmbedding - 실제 DB에 vector 저장 검증
// ─────────────────────────────────────────────

describe("syncItemEmbedding", () => {
  it("문항 임베딩을 생성하여 items.embedding 컬럼에 저장한다", async () => {
    // 1. 테스트 문항 생성
    await prisma.item.create({
      data: {
        id: ITEM_ID,
        orgId: ORG_ID,
        bodyLatex: "x + 1 = 2",
        answer: { value: "1", format: "exact_value" },
        schoolLevel: "middle",
        grade: 1,
        itemType: "short_answer",
      },
    });

    // 2. fetch mock - 768차원 임베딩 (스키마에 맞추기 위해)
    const fakeVector = Array.from({ length: 768 }, () => 0.1);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: fakeVector }),
    });

    // 3. 동기화 실행
    await syncItemEmbedding(ITEM_ID);

    // 4. raw SQL로 embedding 컬럼이 저장되었는지 확인
    const rows = await prisma.$queryRawUnsafe<
      Array<{ has_embedding: boolean }>
    >(
      `SELECT (embedding IS NOT NULL) AS has_embedding FROM items WHERE id = $1`,
      ITEM_ID,
    );
    expect(rows[0]?.has_embedding).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("findSimilarByVector는 동일 조직의 approved 문항만 반환한다", async () => {
    // 위에서 저장한 ITEM_ID는 status=draft 이므로 결과에 포함되지 않아야 함
    const queryVector = Array.from({ length: 768 }, () => 0.1);
    const results = await findSimilarByVector(queryVector, ORG_ID, 5);

    // draft 상태이므로 결과에 포함되지 않음
    expect(results.find((r) => r.itemId === ITEM_ID)).toBeUndefined();

    // 이제 approved로 변경하면 검색됨
    await prisma.item.update({
      where: { id: ITEM_ID },
      data: { status: "approved" },
    });
    const approvedResults = await findSimilarByVector(queryVector, ORG_ID, 5);
    expect(approvedResults.find((r) => r.itemId === ITEM_ID)).toBeDefined();
  });
});
