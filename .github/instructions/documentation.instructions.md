---
applyTo: "docs/**"
---

# Documentation — instructions for Copilot coding agent

Follow these conventions when writing or editing pages in the `docs/` directory.

## 1. Tool & rendering pipeline

- **Generator**: [VitePress](https://vitepress.dev/) — pure Markdown/MDX, no Vue components needed.
- **Build**: `bun run docs:build` → static output in `docs/.vitepress/dist/`
- **Dev server**: `bun run docs:dev` → `http://localhost:5173/github-code-search/`
- **Deploy**: GitHub Actions workflow `.github/workflows/docs.yml` → GitHub Pages.

## 2. Brand guidelines

### Typography

| Role                           | Font                                        | Usage                        |
| ------------------------------ | ------------------------------------------- | ---------------------------- |
| Primary (headings, short text) | **Poppins** (Aestetico Informal substitute) | Titles, taglines, callouts   |
| Accompanying (body text)       | **Poppins**                                 | Paragraphs, tables, lists    |
| Monospace                      | VitePress default (`--vp-font-family-mono`) | All code blocks              |
| Bureautic fallback             | **Arial**                                   | Email / Office contexts only |

Poppins is loaded from Google Fonts in `docs/.vitepress/theme/custom.css`. Do not add additional font imports.

### Colour palette

| Name       | Hex       | Role                                                          |
| ---------- | --------- | ------------------------------------------------------------- |
| Violet     | `#9933FF` | Primary — links, buttons, accents (9.1:1 on white ✓ WCAG AAA) |
| Yellow     | `#FFCC33` | Highlight / soft background tints                             |
| Dark blue  | `#0000CC` | Secondary / hover state                                       |
| Light blue | `#66CCFF` | Decorative only — **never for text** (insufficient contrast)  |
| Green      | `#CCFF33` | Decorative only                                               |
| Orange     | `#FF9933` | Decorative / warning callouts                                 |

Only override CSS variables in `docs/.vitepress/theme/custom.css`. Do not hard-code colour values inside Markdown.

### Dark / light mode

`appearance: 'force-auto'` in the VitePress config means the site follows `prefers-color-scheme` by default; the user can toggle manually. All colour tokens have dark-mode variants defined in `custom.css`. Never use `@media (prefers-color-scheme)` directly — rely on the `.dark` class selector that VitePress manages.

## 3. File structure & naming

```
docs/
├── index.md                   # Landing page (layout: home)
├── getting-started/           # Onboarding section
├── usage/                     # Use-case-driven guides
├── reference/                 # Reference tables (CLI, shortcuts, API, env)
└── architecture/              # C4 diagrams (L1 → L3 in Mermaid)
```

- Use **kebab-case** for file names: `team-grouping.md`, not `teamGrouping.md`.
- Every section must have an `index.md` that serves as the landing page for that section.
- All pages must have a `# Title` as the first heading — VitePress uses it for the sidebar and `<title>`.

## 4. Writing style

- Write in **English**.
- Lead each page with a one-sentence description of what the feature does and **when to use it**.
- Prefer **use-case-driven content**: show a realistic CLI example first, explain options after.
- Every code block must declare its language: ` ```bash `, ` ```typescript `, ` ```json `, etc.
- Use admonitions for important caveats:
  ```markdown
  ::: warning GitHub API limit
  Code search is capped at 1 000 results. See [GitHub API limits](/reference/github-api-limits).
  :::
  ```
- Cross-link liberally using root-relative paths: `[GitHub API limits](/reference/github-api-limits)`.

## 5. Mermaid / C4 diagrams

- Use `vitepress-plugin-mermaid` — wrap diagrams in ` ```mermaid ` fenced blocks.
- C4 diagrams use `C4Context`, `C4Container`, `C4Component` diagram types.
- Include a prose introduction **before** every diagram explaining what level it represents.
- Keep diagrams self-contained: label every node and every arrow.
- Do not add inline CSS to Mermaid diagrams — the plugin handles dark/light theming automatically via `mermaid.theme: 'default'` in the config.

## 6. Versioning

- `docs/public/versions.json` tracks published major versions.
  - Format: `[{ "text": "v1 (latest)", "link": "/" }]`
  - A new entry is appended automatically by CI when a `vX.0.0` tag is pushed.
- Do **not** manually edit `versions.json` outside of the release workflow.
- When updating docs for a new major version, update the nav `text` field in `docs/.vitepress/config.mts`.

## 7. Validation checklist

Before opening a PR for any docs change:

```bash
bun run docs:build   # must complete without errors
bun run format:check # oxfmt — no formatting diff
```

- All internal links must resolve (VitePress reports dead links on build).
- No new `bun run knip` violations (docs/\*\* is excluded but `package.json` changes are not).
