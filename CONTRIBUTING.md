# Contributing to github-code-search

Thank you for taking the time to contribute! This document describes how to set up a development environment, run tests, and submit changes.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.4.4 (CI uses the version pinned in `.bun-version`)
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
  group.ts               # groupByTeamPrefix, applyTeamPick, rebuildTeamSections, flattenTeamSections
  group.test.ts          # Unit tests for group.ts
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
    team-pick.ts         # Pick-mode candidate bar renderer (renderTeamPickHeader) — pure, no I/O
    team-pick.test.ts    # Unit tests for team-pick.ts
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

TypeScript tests are co-located with their source files and cover the pure functions in `aggregate.ts`, `completions.ts`, `group.ts`, `output.ts`, `render.ts`, `render/highlight.ts`, `render/team-pick.ts`, and `upgrade.ts`.

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
- Run `bun run typecheck` (`bun check`) — strict TypeScript checking of application code, tests and supporting TypeScript scripts.
- Run `bun run format:check` (`bun fmt --check .`) — auto-fix locally with `bun run format` (`bun fmt .`).

Formatting options live in `[fmt]` in `bunfig.toml`, retaining the 100-column print
width. No standalone formatter or linter is installed. `bun run lint` remains a
compatibility alias for type checking: `bun check` is not a linter, and the previous
oxlint correctness/suspicious rules are intentionally no longer enforced. Vue
templates are validated by the documentation build, not by `bun check`.

## Submitting a pull request

1. Fork the repository and create a branch: `git checkout -b my-feature`.
2. Make your changes, add or update tests.
3. Ensure `bun test`, `bun run typecheck`, `bun run format:check`, `bun run knip` and `bun run build.ts` pass.
4. Open a pull request against `main` with a clear description of the motivation and changes.

If your PR touches docs (`docs/**`), also verify:

```bash
bun run docs:build           # no dead links, no build errors
bun run docs:build:a11y
bun run docs:preview -- --port 4173 &
bun run docs:a11y            # 0 axe-core WCAG 2.2 AA automated violations
bun run docs:test:a11y       # audit failure-path fixtures and theme semantics
bun run docs:test:responsive # 20/20 Playwright responsive tests green
```

Install the local test browser once with `bun run playwright install chromium`,
or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing Chrome executable.
The accessibility workflow uses `/usr/bin/google-chrome-stable` on Ubuntu, with
no browser download. `PLAYWRIGHT_BASE_URL` overrides the preview origin;
`VITEPRESS_BASE` selects the documentation base path, including versioned builds.
The build and audit must use the same base path.

Inspect `a11y-report.json` for affected nodes, rule help links, scan errors and
incomplete findings; `a11y-report.md` summarizes every page. Any violation or
operational error fails the command. Do not copy obsolete HTML_CodeSniffer
exceptions into axe or disable rules to make CI pass. Manual keyboard,
screen-reader and interaction checks remain necessary. See the
[audit guide](docs/reference/accessibility.md) for coverage and benchmark details.

## AI agent tooling

This project ships a two-layer system to guide AI coding agents (GitHub Copilot, Claude, etc.):

### Instructions (`.github/instructions/`)

Step-by-step workflow files applied automatically by Copilot based on the task type.
Each file covers **one task type** — ordered numbered steps, PR conventions, validation checklist.

| File                                | Applied to       | When                             |
| ----------------------------------- | ---------------- | -------------------------------- |
| `bug-fixing.instructions.md`        | All files (`**`) | Fixing a bug                     |
| `implement-feature.instructions.md` | All files (`**`) | Implementing a new feature       |
| `refactoring.instructions.md`       | All files (`**`) | Refactoring existing code        |
| `release.instructions.md`           | All files (`**`) | Cutting a release                |
| `documentation.instructions.md`     | `docs/**` only   | Writing or editing documentation |

### Skills (`.github/skills/`)

Deep domain-knowledge files — **read these for reference**, not for step-by-step guidance.
Skills provide patterns, checklists, architectural details and examples that are too large for instruction files.

| File                | Domain                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| `bug-fixing.md`     | Extended symptom→module table, test-first patterns, minimal fix rules  |
| `feature.md`        | Layer map, type-first design, CLI options, render sub-module extension |
| `refactoring.md`    | Architectural invariants, safe rename playbook, knip output guide      |
| `release.md`        | Semver guide, CD pipeline mechanics, blog post format, CHANGELOG rules |
| `documentation.md`  | VitePress theme API, CSS variables, WCAG patterns, responsive patterns |
| `github-actions.md` | CI workflows, pinned actions, browser reuse and accessibility reports  |

**How they fit together:** instruction files say _what steps to follow_; skill files say _what to know deeply_. Instructions reference their companion skill via a `> Skill reference:` note at the top.

## Reporting bugs

Please open an issue and include:

- The exact command you ran (with `GITHUB_TOKEN` redacted).
- The output you observed vs. what you expected.
- The full `github-code-search --version` output (contains commit SHA, OS, and architecture).
- Your Bun version (`bun --version`) if running from source.
