import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  imports: 0,
  sharedImports: 0,
  options: [] as any[],
  execute: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("@prisma/client", () => {
  state.imports++;
  return { PrismaClient: class {
    constructor(options: any) { state.options.push(options); }
    $executeRawUnsafe = state.execute;
    $disconnect = state.disconnect;
  } };
});
vi.mock("@math-item-os/db", () => {
  // Model the real package's import-time singleton and re-export.
  state.sharedImports++;
  class PrismaClient {
    constructor(options?: any) { state.options.push(options); }
    $executeRawUnsafe = state.execute;
    $disconnect = state.disconnect;
  }
  return { prisma: new PrismaClient(), PrismaClient };
});

const valid = "postgresql://test-user:synthetic-password@localhost:5432/mathitem_test?schema=public";
function configure(overrides: Record<string, string | undefined> = {}) {
  const env = {
    NODE_ENV: "test", TEST_DATABASE_DISPOSABLE: "1",
    TEST_DATABASE_URL: valid, DATABASE_URL: valid, DIRECT_URL: valid,
    ALLOW_NON_TEST_DB: undefined,
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}
beforeEach(() => {
  vi.resetModules();
  state.imports = 0;
  state.sharedImports = 0;
  state.options = [];
  state.execute.mockReset().mockResolvedValue(0);
  state.disconnect.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

const invalid: Array<[string, Record<string, string | undefined>]> = [
  ["missing explicit datasource", { TEST_DATABASE_URL: undefined }],
  ["missing disposable acknowledgement", { TEST_DATABASE_DISPOSABLE: undefined }],
  ["false acknowledgement", { TEST_DATABASE_DISPOSABLE: "0" }],
  ["production mode", { NODE_ENV: "production" }],
  ["development mode", { NODE_ENV: "development" }],
  ["missing mode", { NODE_ENV: undefined }],
  ["malformed URL", { TEST_DATABASE_URL: "synthetic-invalid-url" }],
  ["production database name", { TEST_DATABASE_URL: valid.replace("mathitem_test", "mathitem") }],
  ["remote database", { TEST_DATABASE_URL: valid.replace("localhost", "production.example.invalid") }],
  ["other engine", { TEST_DATABASE_URL: valid.replace("postgresql:", "mysql:") }],
  ["other schema", { TEST_DATABASE_URL: valid.replace("schema=public", "schema=production") }],
  ["query endpoint override", { TEST_DATABASE_URL: valid + "&host=production.example.invalid" }],
  ["duplicate schema", { TEST_DATABASE_URL: valid + "&schema=production" }],
  ["encoded database path", { TEST_DATABASE_URL: valid.replace("mathitem_test", "production%2Fmathitem_test") }],
  ["URL fragment", { TEST_DATABASE_URL: valid + "#unexpected" }],
  ["ambient runtime production URL", { DATABASE_URL: valid.replace("mathitem_test", "production") }],
  ["ambient migration production URL", { DIRECT_URL: valid.replace("mathitem_test", "production") }],
  ["legacy override cannot bypass guard", { TEST_DATABASE_URL: valid.replace("mathitem_test", "production"), ALLOW_NON_TEST_DB: "1" }],
];
for (const [name, overrides] of invalid) {
  it(`rejects ${name} before any client import, connection or DDL`, async () => {
    configure(overrides);
    const { setup } = await import("./test-setup");
    await expect(setup()).rejects.toThrow();
    expect(state.imports).toBe(0);
    expect(state.sharedImports).toBe(0);
    expect(state.options.length).toBe(0);
    expect(state.execute.mock.calls.length).toBe(0);
    expect(state.disconnect.mock.calls.length).toBe(0);
  });
}
for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
  it(`uses only the explicitly acknowledged ${host} test datasource`, async () => {
    const url = valid.replace("localhost", host);
    configure({ TEST_DATABASE_URL: url, DATABASE_URL: url, DIRECT_URL: url });
    const { setup, teardown } = await import("./test-setup");
    // Importing test setup alone must not instantiate the shared client.
    expect(state.options.length).toBe(0);
    await setup();
    expect(state.sharedImports).toBe(0);
    expect(state.options).toEqual([{ datasources: { db: { url } } }]);
    expect(state.execute.mock.calls.map(([sql]) => sql)).toEqual([
      "DROP RULE IF EXISTS audit_log_no_update ON audit_logs",
      "DROP RULE IF EXISTS audit_log_no_delete ON audit_logs",
      "DROP RULE IF EXISTS item_version_no_update ON item_versions",
      "DROP RULE IF EXISTS item_version_no_delete ON item_versions",
    ]);
    expect(state.disconnect.mock.calls.length).toBe(1);
    await teardown();
    expect(state.execute.mock.calls.length).toBe(4);
  });
}
it("surfaces connection or DDL errors and disconnects instead of continuing", async () => {
  configure();
  state.execute.mockRejectedValueOnce(new Error("synthetic connection or DDL failure"));
  const { setup } = await import("./test-setup");
  await expect(setup()).rejects.toThrow("synthetic connection or DDL failure");
  expect(state.execute.mock.calls.length).toBe(1);
  expect(state.disconnect.mock.calls.length).toBe(1);
});
it("surfaces disconnect failures", async () => {
  configure();
  state.disconnect.mockRejectedValue(new Error("synthetic disconnect failure"));
  const { setup } = await import("./test-setup");
  await expect(setup()).rejects.toThrow("synthetic disconnect failure");
});
it("rejects malformed configuration without echoing its credential", async () => {
  const sentinel = "private-sentinel-value";
  configure({ TEST_DATABASE_URL: `bad:${sentinel}` });
  const { setup } = await import("./test-setup");
  try { await setup(); throw new Error("Expected configuration failure"); }
  catch (error) { expect(String(error).includes(sentinel)).toBe(false); }
  expect(state.execute.mock.calls.length).toBe(0);
});
