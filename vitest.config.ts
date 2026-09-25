import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: ["src/web/*/lib/**/*.ts", "src/web/shell/registry.ts", "src/redirect.ts", "src/headers.ts"],
      // Spec §10: 80% on the pure math. DOM modules are Playwright's job.
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
