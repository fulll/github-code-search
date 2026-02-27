---
title: "What's new in v1.4.0"
description: "TUI visual overhaul with violet branding, right-aligned match counts, animated demo, community files (SECURITY, Code of Conduct), and README improvements."
date: 2026-02-27
---

# What's new in github-code-search v1.4.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.4.0>

## Highlights

### TUI visual overhaul

The interactive interface has been redesigned to match the project's visual identity:

- **Violet branding** — the cursor highlight, section separators and brand badge now use `bgMagenta` / `magenta` consistently throughout the UI.
- **Brand badge header** — a `github-code-search` badge is displayed at the top of the screen alongside the current query and organisation, giving the TUI an immediately recognisable header.
- **Green checkmarks** — selected items now show a green `✓`; deselected items show a blank space instead of an empty circle, reducing visual clutter.
- **Refined arrows** — repository expand/collapse arrows changed from `▶`/`▼` to `▸`/`▾`, matching the lighter style used in the documentation.
- **Right-aligned match counts** — each repository row pads its match count flush with the right edge of the terminal window, making it easy to scan at a glance.

### Animated demo

A VHS-recorded demo animation (`demo/demo.gif`) now appears directly in the README, letting users see the tool in action before installing anything.

### Community & open-source hygiene

- **`SECURITY.md`** — responsible-disclosure policy with a private contact address and a clear timeline commitment.
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1, the industry-standard code of conduct.
- **`CHANGELOG.md`** — root-level changelog pointing to this blog for per-release details.
- **Social preview** — a `docs/public/social-preview.svg` (1280 × 640) provides a polished GitHub social card.

### README improvements

- **Features section** — eight bullet points summarising what the tool does.
- **Use cases** — five concrete scenarios showing when `github-code-search` saves time.
- **Comparison table** — side-by-side comparison with `gh search code`, highlighting why an interactive TUI matters.

### `package.json` discoverability

Added `repository`, `homepage` and `bugs` fields, plus 18 keywords, so the package is correctly indexed on npmjs.com and pkg.pr.new.

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.4.0).
