// 시드 데이터: 기본 조직
import type { PrismaClient } from "@prisma/client";

/** 기본 조직 생성 (멱등) */
export async function seedOrganization(prisma: PrismaClient) {
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: { name: "기본 조직" },
    create: { name: "기본 조직", slug: "default" },
  });

  console.log(`  [조직] ${org.name} (${org.id})`);
  return org;
}
