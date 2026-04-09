// 시드 데이터: 학습지 5개 + 문항 배치
// 목적별(진단/보충/시험대비/심화) 샘플 학습지를 생성하고 기존 문항을 배치
import type { PrismaClient, AssignmentPurpose } from "@prisma/client";
import { randomBytes } from "crypto";

interface AssignmentDef {
  readonly title: string;
  readonly purpose: AssignmentPurpose;
  readonly isPublished: boolean;
  readonly itemCodes: readonly string[];
  readonly points: readonly number[];
}

const ASSIGNMENTS: readonly AssignmentDef[] = [
  {
    title: "중1 정수와 유리수 진단평가",
    purpose: "diagnosis",
    isPublished: true,
    itemCodes: ["ITEM-001", "ITEM-002", "ITEM-003", "ITEM-004", "ITEM-005", "ITEM-006", "ITEM-007", "ITEM-008", "ITEM-009", "ITEM-015"],
    points: [5, 5, 10, 10, 10, 10, 10, 15, 15, 10],
  },
  {
    title: "음수 연산 보충학습",
    purpose: "remediation",
    isPublished: true,
    itemCodes: ["ITEM-001", "ITEM-002", "ITEM-003", "ITEM-015", "ITEM-019"],
    points: [10, 10, 20, 20, 40],
  },
  {
    title: "중2 문자와 식 시험대비",
    purpose: "pre_exam",
    isPublished: true,
    itemCodes: ["ITEM-021", "ITEM-022", "ITEM-023", "ITEM-024", "ITEM-025", "ITEM-026", "ITEM-035", "ITEM-037"],
    points: [10, 10, 15, 10, 15, 15, 10, 15],
  },
  {
    title: "인수분해와 이차방정식 심화",
    purpose: "advanced",
    isPublished: true,
    itemCodes: ["ITEM-029", "ITEM-030", "ITEM-031", "ITEM-039", "ITEM-040", "ITEM-049"],
    points: [15, 10, 20, 15, 25, 15],
  },
  {
    title: "함수와 그래프 진단평가 (미공개)",
    purpose: "diagnosis",
    isPublished: false,
    itemCodes: ["ITEM-061", "ITEM-062", "ITEM-063", "ITEM-064", "ITEM-065"],
    points: [20, 20, 20, 20, 20],
  },
];

/** 학습지 5개 시드 (멱등: title 기준 조회) */
export async function seedAssignments(
  prisma: PrismaClient,
  orgId: string,
): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const def of ASSIGNMENTS) {
    const existing = await prisma.assignment.findFirst({
      where: { orgId, title: def.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // 문항 코드 -> ID 매핑
    const items = await prisma.item.findMany({
      where: {
        orgId,
        metadata: { path: ["code"], string_contains: "ITEM-" },
      },
      select: { id: true, metadata: true },
    });

    const codeToId = new Map<string, string>();
    for (const item of items) {
      const code = (item.metadata as Record<string, unknown>)?.code as string;
      if (code) codeToId.set(code, item.id);
    }

    // 매핑 가능한 문항만 필터링
    const validItems = def.itemCodes
      .map((code, i) => ({ code, itemId: codeToId.get(code), points: def.points[i] }))
      .filter((x): x is { code: string; itemId: string; points: number } => x.itemId != null);

    if (validItems.length === 0) {
      console.warn(`  [학습지] "${def.title}" -- 매칭 문항 없음, 건너뜀`);
      skipped++;
      continue;
    }

    const solveToken = def.isPublished
      ? randomBytes(6).toString("hex")
      : null;

    await prisma.assignment.create({
      data: {
        orgId,
        title: def.title,
        purpose: def.purpose,
        isPublished: def.isPublished,
        solveToken,
        items: {
          create: validItems.map((v, i) => ({
            itemId: v.itemId,
            position: i + 1,
            points: v.points,
          })),
        },
      },
    });

    created++;
  }

  console.log(`  [학습지] 생성: ${created}개, 건너뜀: ${skipped}개`);
}
