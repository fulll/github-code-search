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
    // ── Eco-design: Google Fonts — non-blocking load ────────────────────────
    // 1. preconnect: establishes DNS+TCP+TLS early (eliminates ~200 ms RTT)
    // 2. preload as="style": fetches the CSS at high priority without blocking render
    // 3. media="print" + onload: loads as print (non-blocking), switches to "all"
    //    once downloaded — the classic "loadCSS" pattern
    // The @import in custom.css is removed; the <link> below replaces it.
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "preload",
        href: "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
        as: "style",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
        media: "print",
        onload: "this.media='all'",
      },
    ],
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
    // Four async chunk groups — all loaded lazily via vitepress-mermaid-renderer,
    // so none affect initial page load. Target: keep every chunk under 500 kB.
    //
    // Approximate minified sizes (actual, measured):
    //   mermaid        ~1 769 kB  (mermaid core + d3, circular-dep locked together)
    //   mermaid-graph    ~442 kB  (cytoscape core)
    //   mermaid-layout   ~201 kB  (cytoscape-fcose + cytoscape-cose-bilkent)
    //   mermaid-utils    ~163 kB  (lodash-es, khroma, dayjs, roughjs, …)
    //   katex            ~261 kB  (own chunk, handled by vitepress-mermaid-renderer)
    //
    // mermaid+d3 is the one inescapable large chunk (~1 769 kB). The 1 800 kB
    // limit silences the Rollup warning for that known bundle without masking
    // real bloat in any other chunk (next largest is mermaid-graph at ~442 kB).
    build: {
      chunkSizeWarningLimit: 1800,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // cytoscape-fcose + cytoscape-cose-bilkent: layout algorithm extensions
            // (~200 kB combined). Must be checked before the bare "cytoscape" catch.
            if (
              id.includes("node_modules/cytoscape-fcose") ||
              id.includes("node_modules/cytoscape-cose-bilkent")
            )
              return "mermaid-layout";

            // cytoscape core only (~440 kB minified).
            // The layout extensions above import from core but not vice-versa.
            if (id.includes("node_modules/cytoscape")) return "mermaid-graph";

            // Pure utility libraries consumed by mermaid — no circular deps
            // back into mermaid or d3, safe to split.
            if (
              id.includes("node_modules/lodash-es") ||
              id.includes("node_modules/khroma") ||
              id.includes("node_modules/dayjs") ||
              id.includes("node_modules/roughjs") ||
              id.includes("node_modules/dompurify") ||
              id.includes("node_modules/stylis") ||
              id.includes("node_modules/ts-dedent") ||
              id.includes("node_modules/uuid") ||
              id.includes("node_modules/marked") ||
              id.includes("node_modules/@braintree/sanitize-url") ||
              id.includes("node_modules/@iconify")
            )
              return "mermaid-utils";

            // Mermaid core + d3 sub-tree must stay co-located: they share
            // circular dependencies that Rollup cannot untangle further.
            if (
              id.includes("node_modules/mermaid") ||
              id.includes("node_modules/vitepress-mermaid-renderer") ||
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
    logo: { src: "/logo.svg", width: 24, height: 24 },

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
        text: versionsData[0].text,
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
