import { defineConfig } from "vitepress";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import versionsData from "../public/versions.json";
import pkg from "../../package.json";

const latestVersion: string = pkg.version;
const latestBlogSlug = `release-v${latestVersion.replace(/\./g, "-")}`;

// ─── Semantic version helpers for blog sidebar sort ───────────────────────────
function parseBlogVersion(filename: string): number[] {
  // "release-v1-2-3.md" → [1, 2, 3]
  return filename
    .replace(/^release-v/, "")
    .replace(/\.md$/, "")
    .split("-")
    .map(Number);
}

function compareVersionArrays(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Blog sidebar — built dynamically from docs/blog/*.md files ────────────────
// Files are sorted newest-first using semantic version comparison so that
// multi-digit components (e.g. v1.10.0) sort correctly before v1.9.0.
// The index.md is excluded from the per-post list since it is the section root.
function buildBlogSidebarItems(): { text: string; link: string }[] {
  // Fix: use import.meta.url instead of __dirname which may be undefined in ESM
  const blogDir = fileURLToPath(new URL("../blog", import.meta.url));
  let files: string[] = [];
  try {
    files = readdirSync(blogDir)
      .filter((f) => f.endsWith(".md") && f !== "index.md")
      .toSorted((a, b) => compareVersionArrays(parseBlogVersion(a), parseBlogVersion(b)));
  } catch {
    // blog dir may not exist during the very first build
  }
  return files.map((f) => {
    const slug = f.replace(/\.md$/, "");
    // slug: release-v1-0-0 → display: v1.0.0
    const label = slug.replace(/^release-/, "").replace(/-/g, ".");
    return { text: label, link: `/blog/${slug}` };
  });
}

// ── Versioning convention ────────────────────────────────────────────────────
// • main branch  → always publishes the "latest" docs at /github-code-search/
// • Major release tag (vX.0.0) → CI takes a snapshot:
//     1. Builds with VITEPRESS_BASE=/github-code-search/vX/
//     2. Publishes to gh-pages under /vX/
//     3. Prepends the new entry to docs/public/versions.json on main
//     4. The next main deploy re-builds this config and picks up the new entry
//        → the nav dropdown (generated from versionsData below) shows the new version
// Patch and minor releases (vX.Y.Z, Y>0 or Z>0) update main docs in-place only.
// See .github/workflows/docs.yml for the full snapshot job.

export default defineConfig({
  title: "github-code-search",
  description:
    "Interactive CLI to search GitHub code across an organization — per-repository aggregation, keyboard-driven TUI, markdown/JSON output.",
  // VITEPRESS_BASE is injected by the snapshot CI job for versioned builds.
  // Falls back to the canonical base for regular deploys.
  base: (process.env.VITEPRESS_BASE ?? "/github-code-search/") as `/${string}/`,

  // ── Theme ──────────────────────────────────────────────────────────────────
  // "force-auto" = respect prefers-color-scheme by default; user can still toggle
  appearance: "force-auto",

  // ── Head ───────────────────────────────────────────────────────────────────
  head: [
    // Favicons — fulll brand assets
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/github-code-search/favicon.svg",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "72x72",
        href: "/github-code-search/favicon-72.png",
      },
    ],
    [
      "link",
      {
        rel: "apple-touch-icon",
        sizes: "114x114",
        href: "/github-code-search/apple-touch-icon.png",
      },
    ],
    // fulll violet as browser theme colour
    ["meta", { name: "theme-color", content: "#9933FF" }],
    // ── Open Graph ──────────────────────────────────────────────────────────
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "github-code-search" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Interactive CLI to search GitHub code across your org — per-repository aggregation, keyboard-driven TUI, markdown/JSON output.",
      },
    ],
    [
      "meta",
      {
        property: "og:image",
        content: "https://fulll.github.io/github-code-search/social-preview.png",
      },
    ],
    [
      "meta",
      {
        property: "og:url",
        content: "https://fulll.github.io/github-code-search/",
      },
    ],
    // ── Twitter Card ────────────────────────────────────────────────────────
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "github-code-search" }],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Interactive CLI to search GitHub code across your org — per-repository aggregation, keyboard-driven TUI, markdown/JSON output.",
      },
    ],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://fulll.github.io/github-code-search/social-preview.png",
      },
    ],
  ],

  // ── Vite ─────────────────────────────────────────────────────────────────
  vite: {
    define: {
      // Consumed by docs/.vitepress/theme/VersionBadge.vue — auto-updates on docs:build
      __LATEST_VERSION__: JSON.stringify(latestVersion),
      __LATEST_BLOG_SLUG__: JSON.stringify(latestBlogSlug),
    },
    plugins: [
      {
        name: "vitepress-generate-og",
        // Convert social-preview.svg → social-preview.png (1200 px) during docs:build
        async buildStart() {
          const { Resvg } = await import("@resvg/resvg-js");
          const { readFileSync, writeFileSync } = await import("node:fs");
          const svgPath = fileURLToPath(new URL("../public/social-preview.svg", import.meta.url));
          const pngPath = fileURLToPath(new URL("../public/social-preview.png", import.meta.url));
          const svg = readFileSync(svgPath, "utf-8");
          const resvg = new Resvg(svg, {
            fitTo: { mode: "width", value: 1200 },
          });
          writeFileSync(pngPath, resvg.render().asPng());
        },
      },
    ],
    // ── Chunk splitting ──────────────────────────────────────────────────────
    // Mermaid alone is >900 kB minified; split it + the d3 sub-tree into
    // dedicated async chunks to eliminate the Rollup 500 kB warning and
    // improve long-term caching. No generic vendor catch-all — VitePress
    // internals (mark.js etc.) need Rollup's default resolution.
    build: {
      // Mermaid (bundled with d3) is legitimately large (~2.4 MB minified).
      // 2500 kB threshold avoids the Rollup warning without masking real bloat
      // on other chunks (next largest is katex at ~260 kB).
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Mermaid + d3 must be co-located (circular dependency between them).
            if (
              id.includes("node_modules/mermaid") ||
              id.includes("node_modules/vitepress-plugin-mermaid") ||
              id.includes("node_modules/d3") ||
              id.includes("node_modules/dagre-d3-es") ||
              id.includes("node_modules/internmap") ||
              id.includes("node_modules/robust-predicates")
            )
              return "mermaid";
          },
        },
      },
    },
  },

  themeConfig: {
    // ── Logo (top-left, next to title) ───────────────────────────────────────
    logo: "/logo.svg",

    // ── Nav ──────────────────────────────────────────────────────────────────
    nav: [
      {
        text: "Getting Started",
        link: "/getting-started/",
        activeMatch: "^/getting-started/",
      },
      { text: "Usage", link: "/usage/search-syntax", activeMatch: "^/usage/" },
      {
        text: "What's New",
        link: "/blog/",
        activeMatch: "^/blog/",
      },
      {
        text: "Reference",
        link: "/reference/cli-options",
        activeMatch: "^/reference/",
      },
      {
        text: "Architecture",
        link: "/architecture/overview",
        activeMatch: "^/architecture/",
      },
      // Version dropdown — items are read from docs/public/versions.json.
      // The CI snapshot job prepends a new entry to that file on every major release;
      // the next main deploy re-builds this config and picks up the change automatically.
      // (vitepress-plugin-versions was evaluated but not adopted — see issue #30.)
      {
        text: `${versionsData[0].text} ▾`,
        items: [
          ...versionsData.map((v: { text: string; link: string }) => ({
            text: v.text,
            link: v.link,
          })),
          {
            text: "Releases",
            link: "https://github.com/fulll/github-code-search/releases",
          },
        ],
      },
    ],

    // ── Sidebar ───────────────────────────────────────────────────────────────
    sidebar: {
      "/getting-started/": [
        {
          text: "Getting Started",
          items: [
            { text: "Prerequisites", link: "/getting-started/" },
            { text: "Installation", link: "/getting-started/installation" },
            {
              text: "Your first search",
              link: "/getting-started/first-search",
            },
          ],
        },
      ],
      "/usage/": [
        {
          text: "Usage",
          items: [
            { text: "Search syntax", link: "/usage/search-syntax" },
            { text: "Interactive mode", link: "/usage/interactive-mode" },
            {
              text: "Non-interactive mode",
              link: "/usage/non-interactive-mode",
            },
            { text: "Output formats", link: "/usage/output-formats" },
            { text: "Filtering", link: "/usage/filtering" },
            { text: "Team grouping", link: "/usage/team-grouping" },
            { text: "Upgrade", link: "/usage/upgrade" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "CLI options", link: "/reference/cli-options" },
            {
              text: "Keyboard shortcuts",
              link: "/reference/keyboard-shortcuts",
            },
            {
              text: "GitHub API limits",
              link: "/reference/github-api-limits",
            },
            { text: "Environment variables", link: "/reference/environment" },
          ],
        },
      ],
      "/blog/": [
        {
          text: "What's New",
          items: [{ text: "All releases", link: "/blog/" }, ...buildBlogSidebarItems()],
        },
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            {
              text: "System context (C4 L1)",
              link: "/architecture/overview",
            },
            { text: "Containers (C4 L2)", link: "/architecture/containers" },
            { text: "Components (C4 L3)", link: "/architecture/components" },
          ],
        },
      ],
    },

    // ── Search (local, Minisearch — no external service) ──────────────────────
    search: {
      provider: "local",
    },

    // ── Social ────────────────────────────────────────────────────────────────
    socialLinks: [{ icon: "github", link: "https://github.com/fulll/github-code-search" }],

    // ── Edit link ─────────────────────────────────────────────────────────────
    editLink: {
      pattern: "https://github.com/fulll/github-code-search/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    // ── Footer ────────────────────────────────────────────────────────────────
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © fulll",
    },
  },

  // ── Markdown ──────────────────────────────────────────────────────────────
  markdown: {
    theme: {
      // github-light-high-contrast fixes WCAG AA contrast for Shiki tokens
      // (github-light has #D73A49 4.24:1, #6A737D 4.46:1, #22863A 4.28:1 — all below 4.5:1)
      light: "github-light-high-contrast",
      dark: "github-dark",
    },
  },

  // ── Sitemap ───────────────────────────────────────────────────────────────
  // VITEPRESS_HOSTNAME overrides the default for local/CI a11y audits:
  //   VITEPRESS_HOSTNAME=http://localhost:4173 vitepress build docs
  // → sitemap.xml contains localhost URLs that pa11y-ci can reach directly.
  sitemap: {
    hostname:
      (process.env.VITEPRESS_HOSTNAME ?? "https://fulll.github.io") + "/github-code-search/",
  },
});
