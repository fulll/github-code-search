import { defineConfig } from "vitepress";
import versionsData from "../public/versions.json";

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
  ],

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
          items: [
            { text: "All releases", link: "/blog/" },
            { text: "v1.0.0", link: "/blog/release-v1-0-0" },
          ],
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
      light: "github-light",
      dark: "github-dark",
    },
  },
});
