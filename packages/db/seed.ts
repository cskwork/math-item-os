// 시드 데이터 메인 오케스트레이터
// 실행: pnpm --filter db db:seed
// 멱등: upsert 사용으로 중복 실행 안전
import { PrismaClient } from "@prisma/client";
import { seedOrganization } from "./seed/org.js";
import { seedSkills } from "./seed/skills.js";
import { seedStandards } from "./seed/standards.js";
import { seedMisconceptions } from "./seed/misconceptions.js";
import { seedEdges } from "./seed/edges.js";
import { seedItems } from "./seed/items.js";
import { seedEmbeddings } from "./seed/embeddings.js";
import { seedTemplates } from "./seed/templates.js";
import { seedAssignments } from "./seed/assignments.js";
import { seedITCertSkills } from "./seed/it-cert-skills.js";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("=== 시드 데이터 생성 시작 ===\n");

  // 1단계: 조직
  console.log("[1/9] 조직 생성...");
  const org = await seedOrganization(prisma);

  // 2단계: 스킬 (50개)
  console.log("\n[2/9] 스킬 생성 (50개)...");
  const skillIds = await seedSkills(prisma, org.id);

  // 3단계: 성취기준 (30개)
  console.log("\n[3/9] 성취기준 생성 (30개)...");
  const standardIds = await seedStandards(prisma, org.id);

  // 4단계: 오개념 (20개)
  console.log("\n[4/9] 오개념 생성 (20개)...");
  const misconceptionIds = await seedMisconceptions(prisma, org.id, skillIds);

  // 5단계: 선수학습 간선 (80개)
  console.log("\n[5/9] 선수학습 간선 생성 (80개)...");
  await seedEdges(prisma, org.id, skillIds);

  // 6단계: 문항 + 정션 + 난이도 프로필 (100개)
  console.log("\n[6/9] 문항 생성 (100개) + 정션 테이블 + 난이도 프로필...");
  await seedItems(prisma, org.id, skillIds, standardIds, misconceptionIds);

  // 7단계: 임베딩 벡터 생성 (math-ai 서비스 필요)
  console.log("\n[7/9] 임베딩 벡터 생성...");
  await seedEmbeddings(prisma);

  // 8단계: 예시 템플릿 (변형 문항 생성용)
  console.log("\n[8/9] 예시 템플릿 생성 (6개)...");
  await seedTemplates(prisma, org.id);

  // 9단계: 학습지 (POC 데모용)
  console.log("\n[9/9] 학습지 생성 (5개)...");
  await seedAssignments(prisma, org.id);

  // 10단계: IT 자격증 스킬 트리 (30개)
  console.log("\n[10/10] IT 자격증 스킬 생성 (30개)...");
  await seedITCertSkills(prisma, org.id);

  console.log("\n=== 시드 데이터 생성 완료 ===");
}

main()
  .catch((error: unknown) => {
    console.error("시드 실행 중 오류 발생:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
