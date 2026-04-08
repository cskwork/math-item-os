// tRPC 클라이언트 + React Query 통합
// SSE subscription 지원을 위한 splitLink 설정
"use client";

import { createTRPCReact } from "@trpc/react-query";
import {
  splitLink,
  httpBatchLink,
  unstable_httpSubscriptionLink,
} from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";

// React Query hooks (useQuery, useMutation 등)
export const trpc = createTRPCReact<AppRouter>();

// tRPC 클라이언트 설정
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: unstable_httpSubscriptionLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
        false: httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      }),
    ],
  });
}
