/**
 * Lighthouse CI — eco-design performance budgets
 *
 * Measures the homepage on each docs PR to prevent performance regressions
 * that translate directly into unnecessary CPU / network / energy use.
 *
 * Budgets are intentionally lenient for the INITIAL page load because
 * VitePress hydrates lazily. The values below reflect the current measured
 * baseline; tighten them as the site improves.
 *
 * Run locally (docs must be built first via docs:build:a11y):
 *   bun run docs:build:a11y && bun run docs:lhci
 */

/** @type {import('@lhci/cli').LhciConfig} */
module.exports = {
  // LHCI expects a `ci` wrapper when loading via --config.
  // Without it, `collect`/`assert`/`upload` sections are silently ignored.
  ci: {
    collect: {
      // VitePress preview server — uses the locally-installed binary (no npx).
      startServerCommand: "./node_modules/.bin/vitepress preview docs --port 4173",
      startServerReadyPattern: "http://localhost:4173",
      url: [
        "http://localhost:4173/github-code-search/",
        "http://localhost:4173/github-code-search/getting-started/",
      ],
      numberOfRuns: 2,
      settings: { preset: "desktop" },
    },

    assert: {
      assertions: {
        // ── Lighthouse category scores ──────────────────────────────────────
        // Baseline: all four categories currently score 100.
        // Tolerate 99 (one rounding point) to avoid flakiness.
        // Any drop below 99 is flagged as an error to catch regressions.
        "categories:performance": ["error", { minScore: 0.97 }],
        "categories:accessibility": ["error", { minScore: 0.99 }],
        "categories:best-practices": ["error", { minScore: 0.99 }],
        "categories:seo": ["error", { minScore: 0.99 }],

        // ── Eco-design: transfer weight budget ──────────────────────────────
        // Homepage should stay well below 1.5 MB total (mermaid chunks are
        // async and not loaded on the homepage — only VitePress + theme JS).
        "total-byte-weight": ["error", { maxNumericValue: 1500 * 1024 }],

        // ── Eco-design: limit number of HTTP requests ────────────────────────
        // Fewer round-trips → less server energy + faster for user.
        "resource-summary:document:count": ["warn", { maxNumericValue: 1 }],
        "resource-summary:script:count": ["warn", { maxNumericValue: 10 }],
        "resource-summary:stylesheet:count": ["warn", { maxNumericValue: 5 }],
        // Google Fonts loads 2 CSS + N woff2 files; GitHub avatar/OG image add more.
        // Measured baseline: 6 on homepage. Cap at 8 to leave margin.
        "resource-summary:third-party:count": ["warn", { maxNumericValue: 8 }],

        // ── Core Web Vitals ─────────────────────────────────────────────────
        // LCP ≤ 2.5 s → good user experience + signals efficient rendering
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        // CLS < 0.1 → no layout shifts caused by late-loading fonts or images
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        // TBT ≤ 200 ms → main thread is not monopolised by JS parsing
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],

        // ── Render-blocking resources ───────────────────────────────────────
        // Flags resources that delay first paint (e.g. sync <script> tags).
        // Google Fonts is loaded via @import in CSS — preconnect reduces cost.
        "render-blocking-resources": ["warn", { maxLength: 0 }],

        // ── Disable checks irrelevant to a statically-hosted site ───────────
        "uses-http2": "off", // gh-pages uses HTTP/2 but Lighthouse can't verify in preview
        "uses-long-cache-ttl": "off", // cache headers set by gh-pages CDN, not by us
      },
    },

    upload: {
      // Store reports as GitHub Actions artifacts (see lighthouse.yml).
      // No external LHCI server needed.
      target: "temporary-public-storage",
    },
  },
};
