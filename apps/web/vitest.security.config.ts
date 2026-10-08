// DB/provider 없이 인증 및 기존 RBAC 경계를 검증하는 독립 실행 설정.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  cacheDir: path.resolve(__dirname, ".cache/security-vitest"),
  plugins: [react()],
  test: {
    environment: "node",
    include: [
      "src/server/__tests__/auth-security.test.ts",
      "src/server/middleware/__tests__/rbac.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
