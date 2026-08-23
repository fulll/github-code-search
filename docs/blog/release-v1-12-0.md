---
title: "What's new in v1.12.0"
description: "Mouse-driven TUI (click, double-click, scroll wheel), team re-pick/undo, query-title heading and matched token in output, and regex literal-quote fixes."
date: 2026-08-23
---

# What's new in github-code-search v1.12.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.12.0>

## Highlights

### Mouse support in the interactive TUI

The TUI now responds to the terminal's SGR mouse protocol, alongside every existing keyboard shortcut:

- **Single-click** on any row moves the cursor there (equivalent to `↑` / `↓`).
- **Double-click** on a repo's fold icon (`▸`/`▾`) toggles fold/unfold; double-click on the checkbox zone (columns 4+) toggles selection — on repos and extracts alike.
- **Scroll wheel** moves the viewport by 3 rows at a time.

```
▸ ✓ fulll/auth-service        ← double-click checkbox zone: toggle selection
  ✓ src/flags.ts:3:14         ← double-click: toggle extract selection
```

During trackpad momentum scrolling, the TUI enters a brief "scroll cooldown" so residual clicks from a decelerating scroll gesture don't accidentally toggle a selection. Mouse and keyboard are fully complementary — everything remains reachable from the keyboard alone.

See [Mouse support](/reference/keyboard-shortcuts#mouse-support) for the full zone-by-zone reference.

### Team re-pick mode — reassign or undo a pick

Repos moved by [team pick mode](/usage/team-grouping#team-pick-mode) (marked `◈`) can now be reassigned, or restored back to their original combined section, directly from the TUI. Navigate to a picked repo and press **`t`**:

```
── squad-frontend
▶ ◈  fulll/frontend-app              ← press t here
▶ ◈  fulll/mobile-sdk
```

```
Re-pick: [ squad-frontend ]  squad-mobile  0/u restore  ← → move  ↵ confirm  Esc/t cancel
```

| Key         | Action                                                           |
| ----------- | ---------------------------------------------------------------- |
| `←` / `→`   | Cycle through candidate teams                                    |
| `Enter`     | Confirm and move the repo to the focused team                    |
| `0` / `u`   | Undo the **entire** section pick — restore all its repos at once |
| `Esc` / `t` | Exit re-pick mode without changes                                |

Re-picks are interactive-only adjustments (not encoded in the replay command) — repeat them manually if you rerun the same query non-interactively.

### Query title heading and matched token in output

Every output — Markdown and JSON, `repo-only` and `repo-and-matches` — now opens with a `# Results for` heading identifying the query, plus qualifiers when active:

```text
# Results for "useFeatureFlag" · including archived · excluding templates

3 repos · 4 files selected

- **fulll/auth-service** (2 matches)
  - [ ] [src/middlewares/featureFlags.ts:2:19](...): `useFeatureFlag`
```

The exact matched token is now appended after each extract link in Markdown, and exposed as `matchedText` in JSON output when segment data is available. In [regex queries](/usage/search-syntax#regex-queries), the heading shows the pattern in backticks instead: `` # Results for `/useFeatureFlag/i` ``.

### Regex fixes: literal quotes and safer local filtering

Several regex-mode edge cases are fixed in this release:

- Patterns containing literal `"` characters (e.g. `/"axios": "[~^]?[0-9]"/`) are now escaped automatically using GitHub's own quote-escaping syntax instead of being silently mangled when deriving the API search term.
- Unbalanced double quotes in a plain-text query now **fail fast** locally with an actionable error instead of hitting GitHub's opaque `422 ERROR_TYPE_QUERY_PARSING_FATAL`.
- Local regex filtering now falls back to the full file content when the API-returned fragment isn't enough to evaluate the pattern, fixing false negatives on multi-line matches.

See [Searching for a literal quote character](/usage/search-syntax#searching-for-a-literal-quote-character) for the full escaping rules.

### Bun 1.4 migration

Internally, all ANSI/terminal handling (`stringWidth`, `stripANSI`, `sliceAnsi`) now goes through a single `render/terminal.ts` facade built on Bun 1.4's native APIs, and the TUI now handles live terminal resizes via `SIGWINCH` instead of requiring a restart. No user-facing behavior change, but more robust Unicode (graphemes, emoji, CJK) and layout handling.

---

## Upgrade

```sh
github-code-search upgrade
```
