import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  config: null as any,
  session: null as any,
  upsert: vi.fn(),
  findUnique: vi.fn(),
  uiSignIn: vi.fn(),
  buttonProps: null as any,
}));
vi.mock("next-auth", () => ({ default: (config: any) => {
  state.config = config;
  return { handlers: {}, auth: async () => state.session, signIn: vi.fn(), signOut: vi.fn() };
} }));
vi.mock("next-auth/providers/google", () => ({ default: { id: "google" } }));
vi.mock("next-auth/providers/credentials", () => ({ default: (options: any) => ({ id: "credentials", ...options }) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@math-item-os/db", () => ({ prisma: { user: { upsert: state.upsert, findUnique: state.findUnique } } }));
vi.mock("next-auth/react", () => ({ signIn: state.uiSignIn }));
vi.mock("@/components/ui/button", () => ({ Button: (props: any) => {
  state.buttonProps = props;
  return createElement("button", props);
} }));

const authSource = readFileSync(new URL("../auth.ts", import.meta.url), "utf8");
// Reuse the existing public development fixtures without copying their values.
const devEmail = authSource.match(/const DEV_EMAIL = "([^"]+)"/)![1];
const devPassword = authSource.match(/const DEV_PASSWORD = "([^"]+)"/)![1];
async function load(mode: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", mode);
  await import("../auth");
  return state.config;
}
beforeEach(() => {
  state.upsert.mockReset();
  state.findUnique.mockReset();
  state.findUnique.mockResolvedValue({ role: "admin" });
  state.uiSignIn.mockReset();
  state.buttonProps = null;
  state.session = null;
  state.upsert.mockResolvedValue({ id: "fixture-user", email: devEmail, name: "Dev User", role: "admin" });
});
afterEach(() => vi.unstubAllEnvs());

it("keeps valid development fixture login and admin demo role", async () => {
  const config = await load("development");
  const result = await config.providers[1].authorize({ email: devEmail, password: devPassword });
  expect(result?.id).toBe("fixture-user");
  expect(result?.role).toBe("admin");
  expect(state.upsert.mock.calls.length).toBe(1);
});
it("rejects invalid development credentials before database access", async () => {
  const config = await load("development");
  const result = await config.providers[1].authorize({ email: devEmail, password: "invalid-fixture" });
  expect(result === null).toBe(true);
  expect(state.upsert.mock.calls.length).toBe(0);
});
for (const mode of ["production", "test", undefined]) {
  it(`rejects fixture credentials before database access in ${mode ?? "missing NODE_ENV"}`, async () => {
    const config = await load(mode);
    const result = await config.providers[1].authorize({ email: devEmail, password: devPassword });
    expect(result === null).toBe(true);
    expect(state.upsert.mock.calls.length).toBe(0);
  });
}
it("invalidates an existing fixture-account JWT in production", async () => {
  const config = await load("production");
  const result = await config.callbacks.jwt({ token: { email: devEmail, id: "fixture-user", role: "admin" } });
  expect(result === null).toBe(true);
});
it("blocks fixture identity on a nondevelopment sign-in callback", async () => {
  const config = await load("production");
  const result = await config.callbacks.jwt({ token: {}, user: { email: devEmail, id: "fixture-user", role: "admin" } });
  expect(result === null).toBe(true);
});
it("clears the revoked fixture cookie through the actual Auth.js session action", async () => {
  const config = await load("production");
  const authDirectory = realpathSync(new URL("../../../node_modules/next-auth", import.meta.url));
  const actionUrl = pathToFileURL(path.resolve(authDirectory, "../@auth/core/lib/actions/session.js")).href;
  const { session } = await import(/* @vite-ignore */ actionUrl);
  let cleaned = 0;
  let encoded = 0;
  const result = await session({
    session: { strategy: "jwt", maxAge: 60 },
    jwt: {
      decode: async () => ({ email: devEmail, id: "fixture-user", role: "admin" }),
      encode: async () => { encoded++; return "synthetic-token"; },
    },
    callbacks: config.callbacks,
    cookies: { sessionToken: { name: "synthetic-session" } },
    events: { session: async () => {} },
    logger: { error: (error: unknown) => { throw error; } },
  }, {
    value: "synthetic-cookie",
    clean: () => { cleaned++; return [{ name: "synthetic-session", value: "" }]; },
    chunk: (value: string) => [{ name: "synthetic-session", value }],
  }, []);
  expect(result.body === null).toBe(true);
  expect(cleaned).toBe(1);
  expect(encoded).toBe(0);
  expect(state.upsert.mock.calls.length).toBe(0);
});
it("keeps fixture JWT usable in development", async () => {
  const config = await load("development");
  const token = { email: devEmail, id: "fixture-user", role: "admin" };
  expect((await config.callbacks.jwt({ token })) === token).toBe(true);
});
it("preserves Google provider and normal OAuth role/session callbacks", async () => {
  const config = await load("production");
  expect(config.providers[0].id).toBe("google");
  state.findUnique.mockResolvedValue({ role: "teacher" });
  const token = await config.callbacks.jwt({ token: { email: "user@example.invalid" }, user: { id: "oauth-user", role: "teacher", email: "user@example.invalid" } });
  expect(token.id).toBe("oauth-user");
  expect(token.role).toBe("teacher");
  const session = config.callbacks.session({ session: { user: {} }, token });
  expect(session.user.id).toBe("oauth-user");
  expect(session.user.role).toBe("teacher");
});
it("keeps actual tRPC protected/admin/reviewer role boundaries", async () => {
  await load("production");
  const { createTRPCRouter, protectedProcedure, adminProcedure, reviewerProcedure } = await import("../trpc");
  const router = createTRPCRouter({
    read: protectedProcedure.query(() => "read"),
    administer: adminProcedure.mutation(() => "admin"),
    review: reviewerProcedure.query(() => "review"),
  });
  const caller = (role?: string) => router.createCaller({ prisma: {} as any, session: role ? { user: { id: "oauth-user", role }, expires: "2099-01-01" } as any : null, user: null });
  await expect(caller().read()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(caller("teacher").administer()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller("teacher").review()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller("reviewer").review()).resolves.toBe("review");
  await expect(caller("reviewer").administer()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller("admin").administer()).resolves.toBe("admin");
});
it("rejects revoked fixture sessions at the actual protected tRPC boundary", async () => {
  const config = await load("production");
  const token = await config.callbacks.jwt({ token: { email: devEmail, id: "fixture-user", role: "admin" } });
  state.session = token ? { user: { id: token.id, role: token.role } } : null;
  const { createTRPCContext, createTRPCRouter, adminProcedure } = await import("../trpc");
  const router = createTRPCRouter({ administer: adminProcedure.mutation(() => "admin") });
  await expect(router.createCaller(await createTRPCContext()).administer()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
for (const mode of ["development", "production"]) {
  it(`renders only the intended login controls in ${mode}`, async () => {
    await load(mode);
    const { default: Page } = await import("../../app/auth/signin/page");
    const html = renderToStaticMarkup(createElement(Page));
    expect(html.includes(devPassword)).toBe(mode === "development");
    expect(html.includes("개발용 계정")).toBe(mode === "development");
    expect(html.includes("Google 로그인")).toBe(mode === "production");
    expect(html.includes("<form")).toBe(mode === "development");
    if (mode === "production") {
      await state.buttonProps.onClick();
      expect(state.uiSignIn.mock.calls.length).toBe(1);
      expect(state.uiSignIn.mock.calls[0][0]).toBe("google");
      expect(state.uiSignIn.mock.calls[0][1].callbackUrl).toBe("/items");
    }
  });
}

async function refreshSession(config: any, token: any) {
  const authDirectory = realpathSync(new URL("../../../node_modules/next-auth", import.meta.url));
  const actionUrl = pathToFileURL(path.resolve(authDirectory, "../@auth/core/lib/actions/session.js")).href;
  const { session } = await import(/* @vite-ignore */ actionUrl);
  let cleaned = 0;
  let encoded = 0;
  const result = await session({
    session: { strategy: "jwt", maxAge: 60 },
    jwt: {
      decode: async () => ({ ...token }),
      encode: async () => { encoded++; return "synthetic-token"; },
    },
    callbacks: config.callbacks,
    cookies: { sessionToken: { name: "synthetic-session" } },
    events: { session: async () => {} },
    logger: { error: (error: unknown) => { throw error; } },
  }, {
    value: "synthetic-cookie",
    clean: () => { cleaned++; return [{ name: "synthetic-session", value: "" }]; },
    chunk: (value: string) => [{ name: "synthetic-session", value }],
  }, []);
  return { body: result.body, cleaned, encoded };
}
async function privilegedCaller(session: any) {
  state.session = session;
  const { createTRPCContext, createTRPCRouter, protectedProcedure, adminProcedure, reviewerProcedure } = await import("../trpc");
  const router = createTRPCRouter({
    read: protectedProcedure.query(() => "read"),
    administer: adminProcedure.mutation(() => "admin"),
    review: reviewerProcedure.query(() => "review"),
  });
  return router.createCaller(await createTRPCContext());
}
describe("current database roles and identity revocation", () => {
  it("uses the persisted OAuth user ID and database role on sign-in", async () => {
    const config = await load("production");
    state.findUnique.mockResolvedValue({ role: "teacher" });
    const result = await config.callbacks.jwt({
      token: { sub: "different-provider-subject" },
      user: { id: "persisted-user", email: "user@example.invalid", role: "admin" },
    });
    expect(state.findUnique).toHaveBeenCalledWith({ where: { id: "persisted-user" }, select: { role: true } });
    expect(result.role).toBe("teacher");
  });
  it("uses token.id rather than a provider subject when refreshing", async () => {
    const config = await load("production");
    await refreshSession(config, { id: "persisted-user", sub: "provider-subject", role: "admin" });
    expect(state.findUnique).toHaveBeenCalledWith({ where: { id: "persisted-user" }, select: { role: true } });
  });
  for (const id of [undefined, "", 42]) {
    it(`rejects an absent or invalid persisted identity (${String(id)}) before database access`, async () => {
      const config = await load("production");
      const result = await refreshSession(config, { id, sub: "provider-subject", role: "admin" });
      expect(result.body === null).toBe(true);
      expect(result.cleaned).toBe(1);
      expect(result.encoded).toBe(0);
      expect(state.findUnique.mock.calls.length).toBe(0);
    });
  }
  for (const role of ["teacher", "reviewer", "admin"]) {
    it(`applies the current ${role} role through Auth.js and the actual tRPC guards`, async () => {
      const config = await load("production");
      state.findUnique.mockResolvedValue({ role });
      const result = await refreshSession(config, { id: "persisted-user", email: "user@example.invalid", role: "admin" });
      expect(result.body.user.role).toBe(role);
      expect(result.encoded).toBe(1);
      expect(result.cleaned).toBe(0);
      const caller = await privilegedCaller(result.body);
      await expect(caller.read()).resolves.toBe("read");
      if (role === "admin") await expect(caller.administer()).resolves.toBe("admin");
      else await expect(caller.administer()).rejects.toMatchObject({ code: "FORBIDDEN" });
      if (role === "teacher") await expect(caller.review()).rejects.toMatchObject({ code: "FORBIDDEN" });
      else await expect(caller.review()).resolves.toBe("review");
    });
  }
  for (const failure of ["deleted", "database-error"]) {
    it(`clears stale admin cookies and rejects protected routes after ${failure}`, async () => {
      const config = await load("production");
      if (failure === "deleted") state.findUnique.mockResolvedValue(null);
      else state.findUnique.mockRejectedValue(new Error("synthetic database outage"));
      const result = await refreshSession(config, { id: "persisted-user", email: "user@example.invalid", role: "admin" });
      expect(result.body === null).toBe(true);
      expect(result.cleaned).toBe(1);
      expect(result.encoded).toBe(0);
      const caller = await privilegedCaller(result.body);
      await expect(caller.read()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(caller.administer()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(caller.review()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  }
  it("keeps persisted development fixture login and refresh behavior", async () => {
    const config = await load("development");
    const user = await config.providers[1].authorize({ email: devEmail, password: devPassword });
    const token = await config.callbacks.jwt({ token: { email: devEmail }, user });
    expect(state.findUnique).toHaveBeenCalledWith({ where: { id: "fixture-user" }, select: { role: true } });
    const result = await refreshSession(config, token);
    expect(result.body.user.id).toBe("fixture-user");
    expect(result.body.user.role).toBe("admin");
  });
});
