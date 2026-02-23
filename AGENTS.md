# github-code-search — Agent instructions

This file provides context for AI coding agents (GitHub Copilot, Claude, Gemini, etc.) working in this repository.

## What this project does

`github-code-search` is an interactive CLI (powered by [Bun](https://bun.sh)) to search GitHub code across an organisation. It aggregates results per repository, displays a keyboard-driven TUI and lets the user select extracts before printing structured markdown or JSON output. A `query` subcommand and an `upgrade` subcommand are exposed via [Commander](https://github.com/tj/commander.js).

## Runtime & toolchain

| Tool           | Version                                                  |
| -------------- | -------------------------------------------------------- |
| **Bun**        | ≥ 1.0 (runtime, bundler, test runner, package manager)   |
| **TypeScript** | via Bun (no separate `tsc` invocation needed at runtime) |
| **oxlint**     | linter (`bun run lint`)                                  |
| **oxfmt**      | formatter (`bun run format`)                             |
| **knip**       | dead-code detector (`bun run knip`)                      |

There is **no Node.js / npm** involved. Always use `bun` commands.

## Bootstrap

```bash
bun install          # install dependencies (reads bunfig.toml + package.json)
```

`bunfig.toml` sets `smol = true` (lighter install). No additional setup step is needed.

## Build commands

```bash
bun run build.ts                            # compile a self-contained binary → dist/github-code-search
bun run build.ts --target=bun-darwin-arm64  # cross-compile (see CONTRIBUTING.md for all targets)
```

The build script (`build.ts`) injects the git commit SHA, target OS and architecture into the binary. The produced binary has no runtime dependency and can be distributed as a single file.

## Running tests

```bash
bun test            # run the whole test suite
bun test --watch    # re-run on file changes (development)
```

All tests use Bun's built-in test runner (`@jest/globals`-compatible API: `describe`, `it`, `expect`). No additional testing library is needed. The setup file is `src/test-setup.ts` (referenced in `bunfig.toml`).

## Linting & formatting

```bash
bun run lint          # oxlint — must pass before submitting
bun run format        # oxfmt write (auto-fix)
bun run format:check  # oxfmt check (CI check)
bun run knip          # detect unused exports / files
```

Always run `bun run lint` and `bun run format:check` before considering a change complete.

## Project layout

```
github-code-search.ts    # CLI entry point — Commander subcommands: query, upgrade
build.ts                 # Build script (Bun.build)
bunfig.toml              # Bun configuration (smol install, test preload)
tsconfig.json            # TypeScript configuration
knip.json                # knip (dead-code) configuration

src/
  types.ts               # All shared TypeScript interfaces (TextMatchSegment,
                         #   TextMatch, CodeMatch, RepoGroup, Row, TeamSection,
                         #   OutputFormat, OutputType)
  api.ts                 # GitHub REST API client (search, team fetching)
  api-utils.ts           # Shared retry (fetchWithRetry) and pagination (paginatedFetch)
                         #   helpers used exclusively by api.ts — performs network I/O
  cache.ts               # Disk cache for the team list (getCacheDir, getCacheKey,
                         #   readCache, writeCache) — performs filesystem I/O
  aggregate.ts           # Result grouping & filtering (applyFiltersAndExclusions)
  group.ts               # groupByTeamPrefix — team-prefix grouping logic
  render.ts              # Façade re-exporting sub-modules + top-level
                         #   renderGroups() / renderHelpOverlay()
  tui.ts                 # Interactive keyboard-driven UI (navigation, filter mode,
                         #   help overlay, selection)
  output.ts              # Text (markdown) and JSON output formatters
  upgrade.ts             # Auto-upgrade logic (fetch latest GitHub release, replace binary)

  render/
    highlight.ts         # Syntax highlighting (language detection + token rules)
    filter.ts            # FilterStats + buildFilterStats
    rows.ts              # buildRows, rowTerminalLines, isCursorVisible
    summary.ts           # buildSummary, buildSummaryFull, buildSelectionSummary
    selection.ts         # applySelectAll, applySelectNone

  *.test.ts              # Unit tests co-located with source files
  test-setup.ts          # Global test setup (Bun preload)
```

## Key architectural principles

- **Pure functions first.** All business logic lives in pure, side-effect-free functions (`aggregate.ts`, `group.ts`, `output.ts`, `render/` sub-modules). This makes them straightforward to unit-test.
- **Side effects are isolated.** API calls (`api.ts`, `api-utils.ts`), TTY interaction (`tui.ts`) and CLI parsing (`github-code-search.ts`) are the only side-effectful surfaces. `api-utils.ts` hosts shared retry/pagination helpers that perform network I/O and must not be used outside `api.ts`. `cache.ts` hosts disk-cache helpers that perform filesystem I/O and must not be used outside `api.ts`.
- **`render.ts` is a façade.** It re-exports everything from `render/` and adds two top-level rendering functions. Consumers import from `render.ts`, not directly from sub-modules.
- **`types.ts` is the single source of truth** for all shared interfaces. Any new shared type must go there.
- **No classes** — the codebase uses plain TypeScript interfaces and functions throughout.

## Writing tests

- Test files are named `<module>.test.ts` and sit next to their source file.
- Use `describe` / `it` / `expect` from Bun's test runner.
- Only pure functions need tests; `tui.ts` and `api.ts` are not unit-tested.
  `api-utils.ts` is the exception: its helpers are unit-tested by mocking `globalThis.fetch`.
  `cache.ts` is also tested: it uses the `GITHUB_CODE_SEARCH_CACHE_DIR` env var override to redirect to a temp directory, so tests have no filesystem side effects on the real cache dir.
- When adding a function to an existing module, add the corresponding test case in the existing `<module>.test.ts`.
- When creating a new module that contains pure functions, create a companion `<module>.test.ts`.
- Tests must be self-contained: no network calls, no filesystem side effects.

## Git conventions

### Signed commits (required)

All commits to this repository **must be cryptographically signed**. Unsigned commits will be rejected by branch protection rules.

**For local commits** — configure GPG or SSH signing once:

```bash
# Recommended: sign every commit automatically
git config --global commit.gpgsign true

# Or sign a single commit manually
git commit -S -m "feat: my change"
```

Verify your setup:

```bash
git log --show-signature -1   # should show "Good signature from …"
```

**For agent-created commits** — commits pushed via the GitHub REST API (e.g. by Copilot Coding Agent or any MCP tool) are automatically marked **Verified** by GitHub using its own key. No extra configuration is required for these.

### Branch & commit conventions

| Branch type   | Pattern                        | Example                             |
| ------------- | ------------------------------ | ----------------------------------- |
| Feature       | `feat/<short-description>`     | `feat/json-output-type`             |
| Bug fix       | `fix/<short-description>`      | `fix/exclude-repos-with-org-prefix` |
| Refactoring   | `refactor/<short-description>` | `refactor/extract-filter-module`    |
| Documentation | `docs/<short-description>`     | `docs/25-init-vitepress`            |

Commit messages use **imperative mood**: `Add …`, `Fix …`, `Extract …`, not `Added` or `Fixing`.

For epics spanning multiple PRs, create a long-lived **feature branch** (`feat/<epic-name>`) and merge each sub-issue PR into it. Open a final PR from the feature branch into `main` when the epic is complete.

---

## Development notes

- **TypeScript throughout** — no `.js` files in `src/`.
- Bun executes `.ts` files directly; no transpilation step is needed to run the CLI locally (`bun github-code-search.ts query ...`).
- The `--exclude-repositories` and `--exclude-extracts` options accept both short (`repoName`) and long (`org/repoName`) forms — this normalisation happens in `aggregate.ts`.
- The `--group-by-team-prefix` option requires a `read:org` GitHub token scope; this is documented in `README.md`.
- The `upgrade` subcommand replaces the running binary in-place using `src/upgrade.ts`; be careful with filesystem operations there.
- `picocolors` is the only styling dependency; do not add `chalk` or similar.
- Keep `knip` clean: every exported symbol must be used; every import must resolve.
