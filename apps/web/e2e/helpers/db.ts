/**
 * E2E 테스트용 Prisma 데이터베이스 헬퍼
 * - 테스트 사용자 시딩 및 세션 생성
 *
 * NOTE: Next.js 런타임 외부에서 실행되므로
 * @math-item-os/db 대신 @prisma/client를 직접 사용
 */

import { PrismaClient } from "@math-item-os/db";
import {
  TEST_USERS,
  DEFAULT_ORG_ID,
  DEFAULT_ORG_NAME,
  DEFAULT_ORG_SLUG,
  SESSION_EXPIRES_DAYS,
} from "./test-data";

const prisma = new PrismaClient();

/**
 * 세션 만료 일시 계산
 */
function getSessionExpires(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_EXPIRES_DAYS);
  return expires;
}

/**
 * 조직 ID를 라우터의 DEFAULT_ORG_ID와 일치시킨다.
 * 시드 데이터는 cuid ID로 생성되지만, tRPC 라우터는 "default-org"를 사용.
 * 불일치 시 raw SQL로 조직 ID와 모든 FK 참조를 일괄 갱신한다.
 */
async function ensureOrganization(): Promise<void> {
  const existing = await prisma.organization.findFirst({
    where: { slug: DEFAULT_ORG_SLUG },
  });

  if (!existing) {
    await prisma.organization.create({
      data: {
        id: DEFAULT_ORG_ID,
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
      },
    });
    return;
  }

  // 이미 올바른 ID면 스킵
  if (existing.id === DEFAULT_ORG_ID) return;

  // 조직 ID와 모든 FK 참조를 일괄 갱신
  // 1) 새 조직 생성 -> 2) FK 참조 갱신 -> 3) 구 조직 삭제
  const oldId = existing.id;
  const tables = [
    "items",
    "skills",
    "prerequisite_edges",
    "standards",
    "misconceptions",
    "templates",
    "assignments",
    "recommendation_events",
  ];

  await prisma.$transaction(async (tx) => {
    // 새 조직 생성
    await tx.$executeRawUnsafe(
      `INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
       SELECT $1, "name", "slug" || '-migrated', "createdAt", "updatedAt"
       FROM "organizations" WHERE "id" = $2`,
      DEFAULT_ORG_ID,
      oldId,
    );
    // FK 참조 갱신
    for (const table of tables) {
      await tx.$executeRawUnsafe(
        `UPDATE "${table}" SET "orgId" = $1 WHERE "orgId" = $2`,
        DEFAULT_ORG_ID,
        oldId,
      );
    }
    // 구 조직 삭제
    await tx.$executeRawUnsafe(
      `DELETE FROM "organizations" WHERE "id" = $1`,
      oldId,
    );
    // 새 조직 slug 복원
    await tx.$executeRawUnsafe(
      `UPDATE "organizations" SET "slug" = $1 WHERE "id" = $2`,
      DEFAULT_ORG_SLUG,
      DEFAULT_ORG_ID,
    );
  });
}

/**
 * 3명의 테스트 사용자(admin, reviewer, teacher) upsert 후
 * 각 사용자에 대해 결정적 세션 토큰으로 세션 생성
 */
export async function seedTestUsers(): Promise<void> {
  await ensureOrganization();

  const expires = getSessionExpires();

  for (const user of Object.values(TEST_USERS)) {
    // 사용자 upsert
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // 기존 세션 삭제 후 재생성 (토큰 기반 upsert)
    await prisma.session.upsert({
      where: { sessionToken: user.sessionToken },
      update: {
        expires,
      },
      create: {
        sessionToken: user.sessionToken,
        userId: user.id,
        expires,
      },
    });
  }
}

/**
 * Prisma 연결 종료
 */
export async function cleanup(): Promise<void> {
  await prisma.$disconnect();
}
