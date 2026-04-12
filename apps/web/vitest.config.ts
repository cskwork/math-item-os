import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    // 기본 environment 는 node. 컴포넌트 테스트는 파일 최상단에
    // `// @vitest-environment jsdom` pragma 로 jsdom 을 선택한다.
    environment: "node",
    globalSetup: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      // node:test 기반 테스트 — vitest와 호환되지 않음
      "src/components/math/katex-content.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // 커버리지 대상: 서버 로직 + 비즈니스 컴포넌트만 포함
      // 프레젠테이션 UI, Next.js 인프라, 라이브러리 래퍼는 E2E에서 검증
      include: [
        "src/server/**/*.ts",
        "src/components/items/**/*.{ts,tsx}",
        "src/components/math/**/*.{ts,tsx}",
        "src/app/(dashboard)/items/new/**/*.ts",
      ],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        "src/server/auth.ts",
        "src/server/trpc.ts",           // tRPC 초기화 — 인프라
        "src/server/routers/_app.ts",    // 라우터 배선만 — 로직 없음
        "src/server/services/generation.service.ts", // 복잡한 비동기 오케스트레이터 — 통합 테스트 대상
        "src/test-setup.ts",
        "src/components/items/item-card.tsx",
        "src/components/math/formula-editor.tsx",
        "src/components/math/katex-renderer.tsx",
        ".next/**",
      ],
      // Floor — plugin-react 추가 후 .tsx 포함 실측 기준: lines 22.1, statements 21.43,
      // branches 18.29, functions 13.92. (이전 42%는 .tsx 미계측 인공치)
      thresholds: {
        lines: 90,
        statements: 88,
        functions: 88,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
