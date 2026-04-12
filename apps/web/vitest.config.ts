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
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        "src/**/*.config.*",
        "src/app/**/{layout,loading,error,not-found}.tsx",
        ".next/**",
      ],
      // Floor — plugin-react 추가 후 .tsx 포함 실측 기준: lines 22.1, statements 21.43,
      // branches 18.29, functions 13.92. (이전 42%는 .tsx 미계측 인공치)
      thresholds: {
        lines: 21,
        statements: 20,
        functions: 13,
        branches: 17,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
