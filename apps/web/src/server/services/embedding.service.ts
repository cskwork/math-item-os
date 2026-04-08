// 임베딩 동기화 서비스
// 문항 생성/수정 시 pgvector 임베딩을 저장하고, 벡터 유사도 검색을 제공한다.
// Python math-ai 서비스의 /similarity/embed 엔드포인트를 호출한다.
import { prisma } from "@math-item-os/db";

// -------------------------------------------------
// 환경 변수
// -------------------------------------------------

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** 임베딩 API 타임아웃 (밀리초) */
const EMBEDDING_TIMEOUT_MS = 10_000;

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

/** 단건 임베딩 API 응답 */
interface EmbedResponse {
  readonly embedding: number[];
}

/** 배치 임베딩 API 응답 */
interface EmbedBatchResponse {
  readonly embeddings: (number[] | null)[];
}

/** 임베딩 텍스트 생성을 위한 문항 데이터 */
interface EmbeddingTextInput {
  readonly bodyLatex: string;
  readonly skills?: ReadonlyArray<{ readonly skill: { readonly title: string } }>;
  readonly misconceptions?: ReadonlyArray<{
    readonly misconception: { readonly title: string };
  }>;
}

/** 벡터 유사도 검색 결과 행 */
export interface SimilarItemRow {
  readonly itemId: string;
  readonly distance: number;
}

/** raw SQL 쿼리 결과 행 (pgvector 유사도 검색) */
interface RawSimilarRow {
  readonly itemId: string;
  readonly distance: number | string;
}

// -------------------------------------------------
// 1. 임베딩 텍스트 생성
// -------------------------------------------------

/**
 * 문항의 bodyLatex, 스킬 제목, 오개념 제목을 하나의 문자열로 결합한다.
 * 형식: `{bodyLatex} [skills: {skill1}, {skill2}] [misconceptions: {mc1}, {mc2}]`
 */
export function buildEmbeddingText(item: EmbeddingTextInput): string {
  const skillTitles = (item.skills ?? []).map((s) => s.skill.title);
  const misconceptionTitles = (item.misconceptions ?? []).map(
    (m) => m.misconception.title,
  );

  const parts: string[] = [item.bodyLatex];

  if (skillTitles.length > 0) {
    parts.push(`[skills: ${skillTitles.join(", ")}]`);
  }

  if (misconceptionTitles.length > 0) {
    parts.push(`[misconceptions: ${misconceptionTitles.join(", ")}]`);
  }

  return parts.join(" ");
}

// -------------------------------------------------
// 2. 단건 임베딩 생성
// -------------------------------------------------

/**
 * math-ai 서비스에 텍스트를 보내 임베딩 벡터를 생성한다.
 * 실패 시 null을 반환한다 (예외를 던지지 않음).
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${MATH_AI_SERVICE_URL}/similarity/embed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as EmbedResponse;
    return data.embedding ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// -------------------------------------------------
// 3. 배치 임베딩 생성
// -------------------------------------------------

/**
 * 여러 텍스트의 임베딩을 한 번의 API 호출로 생성한다.
 * 실패 시 모든 요소가 null인 배열을 반환한다.
 */
export async function generateEmbeddingBatch(
  texts: string[],
): Promise<(number[] | null)[]> {
  if (texts.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${MATH_AI_SERVICE_URL}/similarity/embed-batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return texts.map(() => null);
    }

    const data = (await response.json()) as EmbedBatchResponse;
    return data.embeddings ?? texts.map(() => null);
  } catch {
    return texts.map(() => null);
  } finally {
    clearTimeout(timeoutId);
  }
}

// -------------------------------------------------
// 4. 문항 임베딩 동기화 (fire-and-forget)
// -------------------------------------------------

/**
 * 문항의 관련 데이터를 조회하여 임베딩을 생성하고 DB에 저장한다.
 * fire-and-forget: 오류가 발생해도 호출자에 전파하지 않는다.
 */
export async function syncItemEmbedding(itemId: string): Promise<void> {
  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        skills: { include: { skill: { select: { title: true } } } },
        misconceptions: {
          include: { misconception: { select: { title: true } } },
        },
      },
    });

    if (item == null) {
      return;
    }

    const text = buildEmbeddingText(item);
    const embedding = await generateEmbedding(text);

    if (embedding == null) {
      return;
    }

    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE items SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      itemId,
    );
  } catch {
    // fire-and-forget: 오류를 조용히 무시한다
  }
}

// -------------------------------------------------
// 5. 벡터 유사도 검색
// -------------------------------------------------

/**
 * pgvector 코사인 거리 연산자를 사용하여 유사한 문항을 검색한다.
 * 동일 조직의 approved 상태 문항만 반환한다.
 */
export async function findSimilarByVector(
  embedding: number[],
  orgId: string,
  limit: number,
  excludeItemId?: string,
): Promise<SimilarItemRow[]> {
  const vectorStr = `[${embedding.join(",")}]`;
  const excludeId = excludeItemId ?? "";

  const rows = await prisma.$queryRawUnsafe<RawSimilarRow[]>(
    `SELECT id as "itemId", (embedding <=> $1::vector) as distance
     FROM items
     WHERE "orgId" = $2
       AND status = 'approved'
       AND id != $3
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    orgId,
    excludeId,
    limit,
  );

  return rows.map((row: RawSimilarRow) => ({
    itemId: row.itemId,
    distance: Number(row.distance),
  }));
}
