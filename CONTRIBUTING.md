# Contributing to github-code-search

Thank you for taking the time to contribute! This document describes how to set up a development environment, run tests, and submit changes.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- A GitHub personal access token with `repo` scope (for integration testing)

## Development setup

```bash
git clone https://github.com/fulll/github-code-search
cd github-code-search
bun install
```

## Project structure

```
github-code-search.ts    # CLI entry point (Commander subcommands: query, upgrade, completions)
build.ts                 # Build script (compiles the standalone binary)
src/
  types.ts               # Shared TypeScript types (TextMatchSegment, CodeMatch, RepoGroup, Row, FilterTarget, …)
  api.ts                 # GitHub REST API client (search, team listing)
  api-utils.ts           # Shared retry (fetchWithRetry) and pagination (paginatedFetch) helpers
  api-utils.test.ts      # Unit tests for api-utils.ts
  api.test.ts            # Unit tests for api.ts
  cache.ts               # Disk cache for the team list (24 h TTL)
  cache.test.ts          # Unit tests for cache.ts
  aggregate.ts           # Result grouping and filtering logic
  aggregate.test.ts      # Unit tests for aggregate.ts
  completions.ts         # Pure shell-completion generators (generateCompletion, detectShell, getCompletionFilePath)
  completions.test.ts    # Unit tests for completions.ts
  render.ts              # Façade: re-exports sub-modules + TUI renderGroups/renderHelpOverlay
  render.test.ts         # Unit tests for render.ts (rows, filter, selection, rendering)
  render/
    highlight.ts         # Syntax highlighting (language detection, token rules, highlightFragment)
    highlight.test.ts    # Unit tests for highlight.ts (per-language tokenizer coverage)
    filter.ts            # Filter stats (FilterStats, buildFilterStats)
    filter-match.ts      # Pure pattern matchers (makeExtractMatcher, makeRepoMatcher)
    filter-match.test.ts # Unit tests for filter-match.ts
    rows.ts              # Row builder (buildRows, rowTerminalLines, isCursorVisible)
    summary.ts           # Stats labels (buildSummary, buildSummaryFull, buildSelectionSummary)
    selection.ts         # Selection mutations (applySelectAll, applySelectNone)
  output.ts              # Text (markdown) and JSON output formatters
  output.test.ts         # Unit tests for output.ts
  tui.ts                 # Interactive keyboard-driven UI (navigation, filter mode, help overlay)
  upgrade.ts             # Auto-upgrade logic (fetch latest release, replace binary) + refreshCompletions()
  upgrade.test.ts        # Unit tests for upgrade.ts
dist/                    # Compiled binary (git-ignored)
install.sh               # Install script (binary download + shell completions installation)
install.test.bats        # Shell-integration tests for install.sh (bats-core)
```

## Running tests

```bash
bun test              # TypeScript unit tests (co-located *.test.ts files)
bun run test:bats     # Shell-integration tests for install.sh (requires bats-core)
```

TypeScript tests are co-located with their source files and cover the pure functions in `aggregate.ts`, `completions.ts`, `output.ts`, `render.ts`, `render/highlight.ts`, and `upgrade.ts`.

Shell-integration tests use [bats-core](https://github.com/bats-core/bats-core). Install it once with:

```bash
brew install bats-core   # macOS
# or: sudo apt-get install -y bats  # Debian/Ubuntu
```

## Building a self-contained binary

Build for the current platform:

```bash
bun run build.ts
# → produces dist/github-code-search  (or dist/github-code-search.exe on Windows)
```

Cross-compile for a specific target:

```bash
bun run build.ts --target=bun-linux-x64
bun run build.ts --target=bun-linux-x64-baseline
bun run build.ts --target=bun-linux-arm64
bun run build.ts --target=bun-darwin-x64
bun run build.ts --target=bun-darwin-arm64
bun run build.ts --target=bun-windows-x64
```

The build script automatically injects the git commit SHA, target OS, and architecture into the binary. Running `github-code-search --version` will show:

```
1.2.3 (a1b2c3d · darwin/arm64)
```

Compiled binaries require no runtime dependencies and can be distributed as a single file.

## Code style

- TypeScript throughout.
- Pure functions wherever possible (makes unit testing straightforward).
- Side-effectful code (CLI parsing, API calls, TTY interaction) is isolated in `github-code-search`, `src/api.ts`, and `src/tui.ts`.
- Run `bun run lint` (oxlint) — must pass with zero errors before submitting.
- Run `bun run format:check` (oxfmt) — auto-fix locally with `bun run format`.

## Submitting a pull request

1. Fork the repository and create a branch: `git checkout -b my-feature`.
2. Make your changes, add or update tests.
3. Ensure `bun test` passes.
4. Open a pull request against `main` with a clear description of the motivation and changes.

If your PR touches docs (`docs/**`), also verify:

```bash
bun run docs:build           # no dead links, no build errors
bun run docs:build:a11y
bun run docs:preview -- --port 4173 &
bun run docs:a11y            # 0 pa11y WCAG 2.1 AA violations
bun run docs:test:responsive # 20/20 Playwright responsive tests green
```

## AI agent tooling

This project ships a two-layer system to guide AI coding agents (GitHub Copilot, Claude, etc.):

### Instructions (`.github/instructions/`)

Step-by-step workflow files applied automatically by Copilot based on the task type.
Each file covers **one task type** — ordered numbered steps, PR conventions, validation checklist.

| File                            | Applied to                      | When                                  |
| ------------------------------- | ------------------------------- | ------------------------------------- |
| `bug-fixing.instructions.md`    | All files (`**`)                | Fixing a bug                          |
| `implement-feature.instructions.md` | All files (`**`)            | Implementing a new feature            |
| `refactoring.instructions.md`   | All files (`**`)                | Refactoring existing code             |
| `release.instructions.md`       | All files (`**`)                | Cutting a release                     |
| `documentation.instructions.md` | `docs/**` only                  | Writing or editing documentation      |

### Skills (`.github/skills/`)

Deep domain-knowledge files — **read these for reference**, not for step-by-step guidance.
Skills provide patterns, checklists, architectural details and examples that are too large for instruction files.

| File                    | Domain                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `bug-fixing.md`         | Extended symptom→module table, test-first patterns, minimal fix rules  |
| `feature.md`            | Layer map, type-first design, CLI options, render sub-module extension  |
| `refactoring.md`        | Architectural invariants, safe rename playbook, knip output guide       |
| `release.md`            | Semver guide, CD pipeline mechanics, blog post format, CHANGELOG rules  |
| `documentation.md`      | VitePress theme API, CSS variables, WCAG patterns, responsive patterns  |

**How they fit together:** instruction files say *what steps to follow*; skill files say *what to know deeply*. Instructions reference their companion skill via a `> Skill reference:` note at the top.

## Reporting bugs

Please open an issue and include:

- The exact command you ran (with `GITHUB_TOKEN` redacted).
- The output you observed vs. what you expected.
- The full `github-code-search --version` output (contains commit SHA, OS, and architecture).
- Your Bun version (`bun --version`) if running from source.
