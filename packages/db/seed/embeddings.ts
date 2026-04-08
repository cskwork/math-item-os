// 시드 데이터: 전체 문항 임베딩 벡터 생성
// math-ai 서비스의 /similarity/embed-batch 엔드포인트를 호출하여 pgvector에 저장
// 서비스 미실행 시 건너뜀 (데모/개발 환경 전용)
import type { PrismaClient } from "@prisma/client";

const MATH_AI_URL = process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";
const BATCH_SIZE = 50;
const TIMEOUT_MS = 30_000;

interface ItemWithRelations {
  readonly id: string;
  readonly bodyLatex: string;
  readonly skills: ReadonlyArray<{ readonly skill: { readonly title: string } }>;
  readonly misconceptions: ReadonlyArray<{
    readonly misconception: { readonly title: string };
  }>;
}

interface EmbedBatchResponse {
  readonly success: boolean;
  readonly embeddings: number[][] | null;
  readonly error: string | null;
}

/** 문항 데이터를 임베딩 텍스트로 변환한다 */
function buildEmbeddingText(item: ItemWithRelations): string {
  const parts: string[] = [item.bodyLatex];

  const skillTitles = item.skills.map((s) => s.skill.title);
  if (skillTitles.length > 0) {
    parts.push(`[skills: ${skillTitles.join(", ")}]`);
  }

  const mcTitles = item.misconceptions.map((m) => m.misconception.title);
  if (mcTitles.length > 0) {
    parts.push(`[misconceptions: ${mcTitles.join(", ")}]`);
  }

  return parts.join(" ");
}

/** 배치 임베딩 API를 호출한다 */
async function fetchBatchEmbeddings(
  texts: string[],
): Promise<number[][] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${MATH_AI_URL}/similarity/embed-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`  임베딩 API 응답 오류: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as EmbedBatchResponse;
    if (!data.success || data.embeddings == null) {
      console.warn(`  임베딩 생성 실패: ${data.error}`);
      return null;
    }

    return data.embeddings;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 전체 문항의 임베딩을 생성하여 DB에 저장한다.
 * math-ai 서비스가 실행 중이어야 한다. 미실행 시 건너뜀.
 */
export async function seedEmbeddings(prisma: PrismaClient): Promise<void> {
  // math-ai 서비스 헬스 체크
  try {
    const health = await fetch(`${MATH_AI_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!health.ok) {
      console.warn("  math-ai 서비스 응답 없음 -- 임베딩 생성 건너뜀");
      return;
    }
  } catch {
    console.warn("  math-ai 서비스 미실행 -- 임베딩 생성 건너뜀");
    return;
  }

  // 임베딩 없는 문항 조회
  const items = await prisma.item.findMany({
    select: {
      id: true,
      bodyLatex: true,
      skills: { select: { skill: { select: { title: true } } } },
      misconceptions: {
        select: { misconception: { select: { title: true } } },
      },
    },
  });

  // 이미 임베딩이 있는 문항 제외
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM items WHERE embedding IS NOT NULL`,
  );
  const hasEmbedding = new Set(rows.map((r) => r.id));
  const targets = items.filter((item) => !hasEmbedding.has(item.id));

  if (targets.length === 0) {
    console.log("  모든 문항에 임베딩이 존재합니다 (건너뜀)");
    return;
  }

  console.log(`  임베딩 대상: ${targets.length}개 문항`);

  let total = 0;

  // 배치 단위로 처리
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    const embeddings = await fetchBatchEmbeddings(texts);
    if (embeddings == null) {
      console.warn(`  배치 ${i / BATCH_SIZE + 1} 임베딩 실패 -- 건너뜀`);
      continue;
    }

    // DB에 저장 (개별 업데이트, pgvector 컬럼)
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const embedding = embeddings[j];
      if (embedding == null) continue;

      const vectorStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE items SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        item.id,
      );
      total += 1;
    }

    console.log(
      `  배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length}개 처리 완료`,
    );
  }

  console.log(`  임베딩 생성 완료: ${total}/${targets.length}개`);
}
