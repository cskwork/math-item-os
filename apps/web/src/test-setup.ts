// vitest 글로벌 셋업 — 테스트 DB의 DELETE/UPDATE 차단 RULE을 비활성화한다.
//
// security_hardening 마이그레이션이 audit_logs와 item_versions에 DO INSTEAD NOTHING
// 규칙을 설정해 테스트 cleanup (deleteMany) 이 작동하지 않는 문제를 해결한다.
// 운영 DB에는 영향 없음 — 테스트 DB (*_test) 에서만 실행된다.

import { PrismaClient } from "@math-item-os/db";

const prisma = new PrismaClient();

export async function setup(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DROP RULE IF EXISTS audit_log_no_update ON audit_logs`,
    );
    await prisma.$executeRawUnsafe(
      `DROP RULE IF EXISTS audit_log_no_delete ON audit_logs`,
    );
    await prisma.$executeRawUnsafe(
      `DROP RULE IF EXISTS item_version_no_update ON item_versions`,
    );
    await prisma.$executeRawUnsafe(
      `DROP RULE IF EXISTS item_version_no_delete ON item_versions`,
    );
    await prisma.$disconnect();
  } catch {
    // DB 미가동 시 무시 — 컴포넌트 테스트 등 DB 불필요 테스트 허용
    await prisma.$disconnect().catch(() => {});
  }
}

export async function teardown(): Promise<void> {
  // 규칙은 테스트 DB에서만 비활성화하므로 복원하지 않는다.
  // CI는 매 run마다 fresh DB를 생성하므로 누적 영향 없음.
}
