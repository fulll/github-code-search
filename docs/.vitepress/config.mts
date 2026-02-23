import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "github-code-search",
    description:
      "Interactive CLI to search GitHub code across an organization — per-repository aggregation, keyboard-driven TUI, markdown/JSON output.",
    base: "/github-code-search/",

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
      // ── Nav ──────────────────────────────────────────────────────────────────
      nav: [
        { text: "Getting Started", link: "/getting-started/" },
        { text: "Usage", link: "/usage/search-syntax" },
        { text: "Reference", link: "/reference/cli-options" },
        { text: "Architecture", link: "/architecture/overview" },
        // Version dropdown — implemented as a plain VitePress nav group.
        // vitepress-plugin-versions was evaluated but not adopted: it requires
        // a non-trivial CI setup for snapshot publishing and adds a runtime
        // dependency for a feature (multi-version docs) that is fully handled
        // by the CI snapshot job in issue #30. The nav item and
        // docs/public/versions.json are updated by that workflow.
        {
          text: "v1 ▾",
          items: [
            { text: "v1 (latest)", link: "/" },
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
  }),
  {
    // ── Mermaid: use the built-in theme without CSS filter hacks.
    // vitepress-plugin-mermaid toggles dark/default automatically based on
    // the VitePress colour scheme — no custom CSS needed.
    mermaid: {
      startOnLoad: false,
      theme: "default",
    },
  },
);
