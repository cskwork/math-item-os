// tRPC HTTP 핸들러 (Next.js App Router)
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path, type }) {
      console.error(
        `[tRPC ${type}] ${path ?? "<no-path>"} failed:`,
        {
          code: error.code,
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        },
      );
    },
  });
}

export { handler as GET, handler as POST };
