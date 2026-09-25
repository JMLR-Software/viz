import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/test/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:8787" },
  webServer: {
    command: "pnpm build:web && wrangler dev --port 8787",
    url: "http://localhost:8787/data/shots/index.json",
    // Never reuse a running server: a leftover dev server serves a stale public/js bundle.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
