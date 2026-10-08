/** Local/CI database guard. No URL or credential is included in errors. */
export function resolveDisposableTestDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  if (env.NODE_ENV !== "test" || env.TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("Test setup requires NODE_ENV=test and TEST_DATABASE_DISPOSABLE=1.");
  }
  const candidate = env.TEST_DATABASE_URL;
  if (!candidate) {
    throw new Error("Test setup requires an explicit TEST_DATABASE_URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("TEST_DATABASE_URL is invalid.");
  }
  // The repository's CI and existing test helpers use a *_test PostgreSQL DB.
  // Local-only scope prevents this cleanup workaround from targeting a remote
  // database even if it has a misleading test suffix.
  if (
    !["postgresql:", "postgres:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(parsed.pathname) ||
    (parsed.searchParams.has("schema") && parsed.searchParams.get("schema") !== "public") ||
    [...parsed.searchParams.keys()].some((key) => key !== "schema") ||
    parsed.searchParams.getAll("schema").length > 1 ||
    parsed.hash
  ) {
    throw new Error("Test setup requires a local PostgreSQL *_test database with the public schema.");
  }
  // Other test modules import the ordinary Prisma singleton. They must not
  // silently inherit a different runtime or migration datasource.
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (env[key] !== undefined && env[key] !== candidate) {
      throw new Error("Runtime and migration datasource variables must match TEST_DATABASE_URL.");
    }
  }
  return candidate;
}
