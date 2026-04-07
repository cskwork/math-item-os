// tRPC 클라이언트 + React Query 통합
"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";

// React Query hooks (useQuery, useMutation 등)
export const trpc = createTRPCReact<AppRouter>();

// tRPC 클라이언트 설정
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}
