/**
 * Playwright configuration — responsive tests only.
 *
 * Run:  bun run docs:test:responsive
 *
 * Tests live in scripts/responsive.spec.ts.
 * They require a running VitePress preview server (bun run docs:preview).
 * In CI the server is started by the responsive.yml workflow.
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "./scripts",
  testMatch: ["responsive.pw.ts"],

  /* Run all (viewport × page) pairs concurrently — they are fully independent */
  fullyParallel: true,

  /* Maximum time for each test */
  timeout: 15_000,

  /* Retry once on CI to tolerate transient timing issues */
  retries: process.env.CI ? 1 : 0,

  /* Fail fast in CI rather than running all permutations */
  maxFailures: process.env.CI ? 5 : 0,

  use: {
    baseURL: BASE_URL,
    /* Disable JS animations — they don't affect layout but speed up page load */
    reducedMotion: "reduce",
  },

  /* Up to 4 workers locally; CI defaults to 2 (GitHub-hosted runners are 2-core) */
  workers: process.env.CI ? 2 : 4,

  projects: [
    {
      /* Chromium covers the widest range of rendering behaviours */
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /*
   * webServer is not configured here — docs must be built and the preview
   * server started separately before running these tests.
   * See the docs:test:responsive script and .github/workflows/responsive.yml.
   */
});
