# Documentation skill — github-code-search

Deep reference for writing and maintaining VitePress documentation in this project.
This skill complements `.github/instructions/documentation.instructions.md` (the step-by-step workflow).

---

## VitePress theme architecture

Custom components live in `docs/.vitepress/theme/`:

| File / folder            | Role                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `index.ts`               | Theme entry point — imports components and global CSS                |
| `custom.css`             | All CSS overrides — brand colours, typography, responsive, a11y      |
| `Layout.vue`             | Root layout wrapper (adds `RichFooter`, manages slot injection)      |
| `TerminalDemo.vue`       | Animated terminal on the hero — `aria-hidden="true"` (decorative)   |
| `ComparisonTable.vue`    | Feature comparison table with responsive 3-column layout             |
| `UseCaseTabs.vue`        | WAI-ARIA Tabs pattern (roving tabindex, ArrowLeft/Right/Home/End)   |
| `InstallSection.vue`     | Install command snippets with OS tabs                                |
| `HowItWorks.vue`         | 3-step explainer with responsive card layout                         |
| `TestimonialsSection.vue`| Community testimonials carousel                                      |
| `ProductionCta.vue`      | "Used in production?" CTA banner (`<section aria-labelledby="…">`) |
| `VersionBadge.vue`       | Release badge — reads `version` from `package.json` at build time   |
| `RichFooter.vue`         | Custom footer replacing VitePress default                            |

**Extending a component:**
1. Locate the `.vue` file above.
2. Follow the existing scoped `<style>` conventions (no global selectors inside `<style scoped>`).
3. Add responsive styles inside the component's `<style>` or in `custom.css` if the rule is global.
4. Never import additional NPM packages for styling — only `picocolors` (CLI) and VitePress built-ins.

---

## CSS variable system

Always use VitePress CSS variables — never hard-code colours in component `<style>` blocks:

| Variable              | Meaning                              |
| --------------------- | ------------------------------------ |
| `--vp-c-brand-1`      | Violet `#9933FF` / `#cc88ff` (dark)  |
| `--vp-c-brand-2`      | Hover darkening                      |
| `--vp-c-brand-soft`   | Soft tint for backgrounds            |
| `--vp-c-text-1`       | Primary text (≥ WCAG AA on bg)       |
| `--vp-c-text-2`       | Secondary text (≥ WCAG AA on bg)     |
| `--vp-c-text-3`       | **Do not use for text** — 2.87:1 contrast, fails WCAG AA |
| `--vp-c-divider`      | Border / separator                   |
| `--vp-c-bg-soft`      | Card / inset background              |
| `--vp-font-family-mono` | Monospace (code blocks)            |

Dark mode: VitePress applies a `.dark` class on `<html>`. Use `.dark .selector { … }` — never `@media (prefers-color-scheme: dark)`.

---

## Accessibility (WCAG 2.1 AA)

This project maintains **zero pa11y-ci violations** at WCAG 2.1 AA level.

### Tool

```bash
bun run docs:build:a11y   # build with VITEPRESS_HOSTNAME=http://localhost:4173
bun run docs:preview -- --port 4173 &
bun run docs:a11y         # pa11y-ci via sitemap — must report 0 errors
```

Config: `.pa11yci.json`. F77 (Mermaid duplicate SVG IDs) is ignored — not blocking for AT users.

### Common patterns

| Pattern                                    | Correct implementation                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Landmark regions                           | `<section aria-labelledby="id">` + matching `id` on heading       |
| Icon-only buttons / links                  | `aria-label="Descriptive text"`                                    |
| Decorative images / SVG                    | `aria-hidden="true"` and no `alt` (or `alt=""`)                   |
| External links (open in new tab)           | `aria-label="Label (opens in a new tab)"` or `.sr-only` suffix    |
| Check / cross icons in tables              | `aria-label="Yes"` / `aria-label="No"`                            |
| Table column headers                       | `<th scope="col">` + `<caption class="sr-only">` on `<table>`    |
| Interactive tabs                           | Full WAI-ARIA Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"`, roving `tabindex`, keyboard nav |
| Screen-reader-only text                    | `.sr-only` utility class defined in `custom.css`                  |
| Focus visibility                           | `:focus-visible` ring defined globally in `custom.css`            |

### Contrast minimums (WCAG AA)

- Normal text (< 18pt): **4.5:1**
- Large text (≥ 18pt bold or ≥ 24pt): **3:1**
- UI components and icons: **3:1**

Avoid `var(--vp-c-text-3)` for any visible text — it is ~2.87:1 against default VitePress backgrounds.

---

## Responsive (mobile-first)

This project maintains **zero horizontal overflow** across 4 tested viewports via Playwright.

### Tested viewports

| Label           | Width  | Height |
| --------------- | ------ | ------ |
| Galaxy S21      | 360px  | 800px  |
| iPhone SE       | 375px  | 667px  |
| iPhone 14       | 390px  | 844px  |
| Tablet portrait | 768px  | 1024px |

### Tool

```bash
bun run docs:build
bun run docs:preview -- --port 4173 &
bun run docs:test:responsive   # 20 tests (4 viewports × 5 pages) — must all pass
```

Config: `playwright.config.ts`. Spec: `scripts/responsive.pw.ts`. Screenshots on failure: `test-results/screenshots/` (gitignored).

### VitePress quirks at 768px

VitePress hides its hamburger at `≥768px` and shows desktop nav links — which overflow the viewport at exactly 768px on this project's config. The fix in `custom.css`:

```css
@media (max-width: 960px) {
  .VPNavBarMenu, .VPNavBarExtra { display: none !important; }
  .VPNavBarHamburger { display: flex !important; }
}
@media (min-width: 768px) and (max-width: 960px) {
  .VPNavScreen { display: block !important; }
}
```

### Responsive patterns for components

| Problem                                     | Solution                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| Table columns too wide on mobile            | `table-layout: fixed`, abbreviated headers via `.ct-name-short` / `.ct-name-long` toggle |
| Long feature descriptions push rows wider   | `display: none` on `.ct-feature-desc` at `≤640px`           |
| Terminal/code blocks cause page scroll      | `overflow-x: auto` on the scroll container, `max-width: 100%` on the block |
| Long strings in `<pre>` overflow            | `pre { max-width: 100%; overflow-x: auto; }` in `custom.css` |

Never use `overflow-x: hidden` on the page root — it silently clips content. Apply it only to specific containers where clipping is intentional.

---

## Validation checklist

Before opening a PR for any docs change:

```bash
bun run docs:build           # must complete without errors or dead-link warnings
bun run docs:build:a11y      # build for a11y audit
bun run docs:preview -- --port 4173 &
bun run docs:a11y            # 0 pa11y violations
bun run docs:test:responsive # 20/20 Playwright tests green
bun run format:check         # oxfmt — no formatting diff
```
