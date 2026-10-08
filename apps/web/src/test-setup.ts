// Containment guard: only an explicitly disposable local PostgreSQL test DB.
// Rule removal remains a temporary cleanup workaround; see the separate review
// proposal for preserving immutability throughout integration tests.
import { resolveDisposableTestDatabaseUrl } from "./test-database-guard";

export async function setup(): Promise<void> {
  // Validate before importing a client: @math-item-os/db constructs a singleton
  // as an import side effect, so it must not be used by this setup.
  const url = resolveDisposableTestDatabaseUrl(process.env);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
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
  } finally {
    // Connection and DDL failures are test failures; never silently continue.
    await prisma.$disconnect();
  }
}

export async function teardown(): Promise<void> {
  // The acknowledged disposable database must be destroyed by its owner.
  // This containment patch does not restore the removed rules.
}
