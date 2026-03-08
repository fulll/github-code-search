# Feature implementation skill — github-code-search

Deep reference for implementing new features in this codebase.
This skill complements `.github/instructions/implement-feature.instructions.md`.

---

## Architectural layer map

```
github-code-search.ts   CLI (Commander) — parsing, program flow, output pipe
│
├── src/api.ts           GitHub REST API — the only allowed network I/O
│   └── src/api-utils.ts Retry + pagination helpers (used only by api.ts)
│   └── src/cache.ts     Disk cache for team list (used only by api.ts)
│
├── src/tui.ts           Interactive TTY — the only allowed stdin/stdout I/O
│
├── src/aggregate.ts     Pure: filter + exclusion logic
├── src/group.ts         Pure: team-prefix grouping
├── src/output.ts        Pure: markdown + JSON renderers
│
├── src/render.ts        Façade — re-exports all render/* + renderGroups/renderHelpOverlay
│   └── src/render/
│       ├── highlight.ts Pure: syntax highlighting per language
│       ├── filter.ts    Pure: FilterStats, buildFilterStats
│       ├── filter-match.ts Pure: makeExtractMatcher, makeRepoMatcher
│       ├── rows.ts      Pure: buildRows, rowTerminalLines, isCursorVisible
│       ├── summary.ts   Pure: buildSummary, buildSummaryFull, buildSelectionSummary
│       └── selection.ts Pure: applySelectAll, applySelectNone
│
└── src/types.ts         Single source of truth for all shared interfaces
```

**Key invariant:** pure functions never import from `api.ts`, `tui.ts`, or `github-code-search.ts`. I/O never leaks into pure layers.

---

## Type-first approach

When a new feature introduces shared data structures, define `src/types.ts` first:

1. Add the new `interface` or `type` to `src/types.ts`.
2. Run `bun run knip` — it will surface all import sites that need updating if you're extending an existing type.
3. Implement pure functions next, then the I/O layer last.

**Extending an existing interface:**
```typescript
// src/types.ts — before
export interface CodeMatch {
  path: string;
  textMatches: TextMatch[];
}

// src/types.ts — after (adding a new optional field is always safe)
export interface CodeMatch {
  path: string;
  textMatches: TextMatch[];
  language?: string;   // new field — optional keeps consumers backward-compatible
}
```

---

## Adding a CLI option

Options are registered in `github-code-search.ts` via Commander:

```typescript
program
  .option("--my-flag <value>", "Description of the flag")
```

Conventions:
- Use `kebab-case` for multi-word flags: `--exclude-repositories`, not `--excludeRepositories`.
- Document new options in `README.md` (the options table + examples section).
- If the option requires a new GitHub token scope, document it in `README.md` and `AGENTS.md`.

---

## Adding a new render sub-module

1. Create `src/render/<name>.ts` — pure functions only, no `process`, no `fs`, no network.
2. Export from `src/render.ts` (the façade):
   ```typescript
   export { myNewFunction } from "./render/<name>.ts";
   ```
3. Consumers import from `src/render.ts`, never directly from `src/render/<name>.ts`.
4. Create `src/render/<name>.test.ts` — co-located tests.

---

## Test patterns for new features

| Module type                   | Test strategy                                                          |
| ----------------------------- | ---------------------------------------------------------------------- |
| Pure function in `src/`       | Co-located `*.test.ts`, full unit coverage, no mocks                  |
| `api-utils.ts` helper         | Mock `globalThis.fetch` — `globalThis.fetch = async () => ...`        |
| `cache.ts` helper             | Set `GITHUB_CODE_SEARCH_CACHE_DIR` env var to `os.tmpdir()` in tests  |
| `completions.ts` helper       | Unset `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `ZDOTDIR` in `beforeEach`  |
| Side-effectful (`api`, `tui`) | Not unit-tested — document manual repro in PR description              |

**Edge cases to always cover:**
- Empty array inputs
- `undefined` / `null` optional fields
- Strings with special characters (slashes, colons, Unicode)
- Boundary values (0, 1, max like 1000 for API pagination)

---

## Validation before PR

```bash
bun test               # all tests green (including new ones)
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no diff
bun run knip           # no unused exports / imports
bun run build.ts       # binary compiles without errors
```

If the feature touches `docs/`:

```bash
bun run docs:build
bun run docs:build:a11y
bun run docs:preview -- --port 4173 &
bun run docs:a11y            # 0 pa11y violations
bun run docs:test:responsive # 20/20 Playwright tests green
```
