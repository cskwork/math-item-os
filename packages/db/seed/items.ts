// 시드 데이터: 문항 100개 + 정션 테이블 + 난이도 프로필 시딩
import type { PrismaClient } from "@prisma/client";
import { ITEMS } from "./items-data.js";

/**
 * 문항 100개 시드 (멱등)
 * 각 문항에 대해:
 * 1. item upsert (bodyLatex 기반 unique 대신 orgId+code 조합)
 * 2. item_skills 연결
 * 3. item_standards 연결
 * 4. item_misconceptions 연결
 * 5. difficulty_profile 연결
 *
 * 주의: Prisma에 orgId+code unique 제약이 없으므로 metadata.code로 식별.
 * 먼저 기존 item 조회 후 upsert.
 */
export async function seedItems(
  prisma: PrismaClient,
  orgId: string,
  skillIds: Record<string, string>,
  standardIds: Record<string, string>,
  misconceptionIds: Record<string, string>,
) {
  let created = 0;
  let junctionCount = 0;

  for (const def of ITEMS) {
    // 코드 기반 조회 (metadata에 code 저장)
    const existing = await prisma.item.findFirst({
      where: { orgId, metadata: { path: ["code"], equals: def.code } },
    });

    const itemData = {
      orgId,
      bodyLatex: def.bodyLatex,
      answer: def.answer,
      schoolLevel: "middle" as const,
      grade: def.grade,
      itemType: def.itemType,
      formulaType: def.formulaType,
      answerFormat: def.answerFormat,
      difficultyAuthor: def.difficultyAuthor,
      status: def.status,
      metadata: { code: def.code },
    };

    let itemId: string;
    if (existing) {
      const updated = await prisma.item.update({
        where: { id: existing.id },
        data: itemData,
      });
      itemId = updated.id;
    } else {
      const newItem = await prisma.item.create({ data: itemData });
      itemId = newItem.id;
    }
    created++;

    // ── 정션 테이블: item_skills ──
    for (let i = 0; i < def.skillCodes.length; i++) {
      const skillId = skillIds[def.skillCodes[i]];
      if (!skillId) continue;
      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId, skillId } },
        update: { isPrimary: i === 0, weight: 1.0 },
        create: { itemId, skillId, isPrimary: i === 0, weight: 1.0 },
      });
      junctionCount++;
    }

    // ── 정션 테이블: item_standards ──
    for (const stdCode of def.standardCodes) {
      const standardId = standardIds[stdCode];
      if (!standardId) continue;
      await prisma.itemStandard.upsert({
        where: { itemId_standardId: { itemId, standardId } },
        update: {},
        create: { itemId, standardId },
      });
      junctionCount++;
    }

    // ── 정션 테이블: item_misconceptions ──
    for (const mcCode of def.misconceptionCodes) {
      const misconceptionId = misconceptionIds[mcCode];
      if (!misconceptionId) continue;
      await prisma.itemMisconception.upsert({
        where: { itemId_misconceptionId: { itemId, misconceptionId } },
        update: {},
        create: { itemId, misconceptionId },
      });
      junctionCount++;
    }

    // ── 난이도 프로필 ──
    await prisma.difficultyProfile.upsert({
      where: { itemId },
      update: { authorDifficulty: def.difficultyAuthor },
      create: { itemId, authorDifficulty: def.difficultyAuthor },
    });
  }

  console.log(`  [문항] ${created}개 생성/갱신`);
  console.log(`  [정션] ${junctionCount}개 연결 (스킬+성취기준+오개념)`);
  console.log(`  [난이도 프로필] ${created}개 생성/갱신`);
}
