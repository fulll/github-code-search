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
github-code-search.ts    # CLI entry point (Commander subcommands: query, upgrade)
build.ts                 # Build script (compiles the standalone binary)
src/
  types.ts               # Shared TypeScript types
  api.ts                 # GitHub REST API client
  aggregate.ts           # Result grouping and filtering logic
  aggregate.test.ts      # Unit tests for aggregate.ts
  render.ts              # Façade: re-exports sub-modules + TUI renderGroups/renderHelpOverlay
  render.test.ts         # Unit tests for render.ts (rows, filter, selection, rendering)
  render/
    highlight.ts         # Syntax highlighting (language detection, token rules, highlightFragment)
    highlight.test.ts    # Unit tests for highlight.ts (per-language tokenizer coverage)
    filter.ts            # Filter helpers (FilterStats, buildFilterStats)
    rows.ts              # Row navigation (buildRows, rowTerminalLines, isCursorVisible)
    summary.ts           # Stats labels (buildSummary, buildSummaryFull, buildSelectionSummary)
    selection.ts         # Selection mutations (applySelectAll, applySelectNone)
  output.ts              # Text (markdown) and JSON output formatters
  output.test.ts         # Unit tests for output.ts
  tui.ts                 # Interactive keyboard-driven UI (navigation, filter mode, help overlay)
  upgrade.ts             # Auto-upgrade logic (fetch latest release, replace binary)
  upgrade.test.ts        # Unit tests for upgrade.ts
dist/                    # Compiled binary (git-ignored)
```

## Running tests

```bash
bun test
```

Tests are co-located with their source files and cover the pure functions in `aggregate.ts`, `output.ts`, `render.ts`, `render/highlight.ts`, and `upgrade.ts`.

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

## Reporting bugs

Please open an issue and include:

- The exact command you ran (with `GITHUB_TOKEN` redacted).
- The output you observed vs. what you expected.
- The full `github-code-search --version` output (contains commit SHA, OS, and architecture).
- Your Bun version (`bun --version`) if running from source.
