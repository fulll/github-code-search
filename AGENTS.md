# github-code-search — Agent instructions

This file provides context for AI coding agents (GitHub Copilot, Claude, Gemini, etc.) working in this repository.

## What this project does

`github-code-search` is an interactive CLI (powered by [Bun](https://bun.sh)) to search GitHub code across an organisation. It aggregates results per repository, displays a keyboard-driven TUI and lets the user select extracts before printing structured markdown or JSON output. A `query` subcommand and an `upgrade` subcommand are exposed via [Commander](https://github.com/tj/commander.js).

## Runtime & toolchain

| Tool           | Version                                                                |
| -------------- | ---------------------------------------------------------------------- |
| **Bun**        | ≥ 1.4.4 (runtime, bundler, tests, packages, formatting, type checking) |
| **TypeScript** | via Bun (no separate `tsc` invocation needed at runtime)               |
| **knip**       | dead-code detector (`bun run knip`)                                    |

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
bun test            # run the whole TypeScript test suite
bun test --watch    # re-run on file changes (development)
bun run test:bats   # run the shell-integration tests for install.sh (requires bats-core)
```

All TypeScript tests use Bun's built-in test runner (`@jest/globals`-compatible API: `describe`, `it`, `expect`). No additional testing library is needed. The setup file is `src/test-setup.ts` (referenced in `bunfig.toml`).

Shell-integration tests use [bats-core](https://github.com/bats-core/bats-core) (`brew install bats-core` or install via your package manager). They cover `install_completions()` from `install.sh` and are located in `install.test.bats`.

## Type checking & formatting

```bash
bun run typecheck     # bun check — strict TypeScript checking
bun run lint          # compatibility alias for typecheck (not a linter)
bun run format        # bun fmt write (auto-fix)
bun run format:check  # bun fmt --check (CI check)
bun run knip          # detect unused exports / files
```

Always run `bun run typecheck` and `bun run format:check` before considering a change complete.

`bun check` reads `tsconfig.json` and checks application code, tests and supporting
TypeScript scripts. It does not check Vue templates or replace general-purpose
lint rules. The former oxlint correctness/suspicious rules are intentionally retired;
do not reintroduce a standalone linter or formatter as part of routine changes.

Formatting options live in `[fmt]` in `bunfig.toml` (100-column print width).
`knip.json` ignores `fmt` and `check` as binaries because knip currently mistakes
these native Bun subcommands for external executables.
All CI/CD and docs workflows read the pinned Bun version from `.bun-version`.
When updating that version, keep the minimum `engines.bun` requirement and current
installation/contributor documentation consistent. Compiled binaries do not need Bun.
No repository custom agent definitions are currently shipped; any future agents
must use the same native tooling and validation commands.

## Documentation accessibility

The docs audit uses `@axe-core/playwright` and the existing Playwright dependency.
Run `bun run docs:build:a11y`, start `bun run docs:preview -- --port 4173` in another
terminal, then run `bun run docs:a11y` and `bun run docs:test:a11y`.
Install local Chromium with `bun run playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` at an installed Chrome executable.
CI uses system Chrome without downloading another browser.

`scripts/a11y.ts` scans every sitemap URL with two workers, explicit WCAG
2.0/2.1/2.2 A/AA tags, and readiness checks for Vue hydration, Mermaid and fonts.
Pure URL validation and Markdown formatting live in `scripts/a11y-utils.ts`.
The generated `a11y-report.json` includes full axe results and operational
errors; `a11y-report.md` is used for the job summary and sticky PR comment.
Violations and operational failures must fail CI. Incomplete results require
manual review, not an automatic compliance claim. Never disable contrast/ARIA
rules or carry over HTML_CodeSniffer exclusions as a shortcut.

Read `.github/skills/documentation.md` for accessible theme patterns and
`.github/skills/github-actions.md` before changing the workflow. The comparison,
measurement caveats and manual-review checklist are in
`docs/reference/accessibility.md`. Repository-local custom agents are not
currently defined; these shared instructions are the agent entry point.

## Project layout

```
github-code-search.ts    # CLI entry point — Commander subcommands: query, upgrade, completions
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
  completions.ts         # Pure shell-completion generators: generateCompletion(),
                         #   detectShell(), getCompletionFilePath() — no I/O
  group.ts               # groupByTeamPrefix, applyTeamPick, rebuildTeamSections,
                         #   flattenTeamSections — team-prefix grouping + pick logic
  regex.ts               # Pure query parser: isRegexQuery(), buildApiQuery()
                         #   Detects /pattern/ syntax, derives safe API term,
                         #   returns RegExp for local client-side filtering — no I/O
  render.ts              # Façade re-exporting sub-modules + top-level
                         #   renderGroups() / renderHelpOverlay()
  scroll-cooldown.ts     # Pure scroll-cooldown state machine (createScrollCooldownState,
                         #   isScrollCooldownActive, updateScrollCooldown) — debounces
                         #   clicks during trackpad momentum scrolling — no I/O
  tui.ts                 # Interactive keyboard- and mouse-driven UI (navigation, filter
                         #   mode, help overlay, selection, SGR mouse tracking)
  output.ts              # Text (markdown) and JSON output formatters
  upgrade.ts             # Auto-upgrade logic (fetch latest GitHub release, replace binary)
                         #   + refreshCompletions() — overwrites existing completion file
  style.ts               # Sole call site for node:util's styleText — dim/bold/italic/
                         #   underline/colors + style(names[], text) composer for combined
                         #   styles — no I/O

  render/
    terminal.ts          # Bun 1.4+ native API wrappers (stringWidth, stripANSI, sliceAnsi)
                         #   sole authorized call site for these APIs
    highlight.ts         # Syntax highlighting (language detection + token rules)
    filter.ts            # FilterStats + buildFilterStats
    filter-match.ts      # Pure pattern matchers — makeExtractMatcher, makeRepoMatcher
    rows.ts              # buildRows, rowTerminalLines, isCursorVisible
    summary.ts           # buildSummary, buildSummaryFull, buildSelectionSummary
    selection.ts         # applySelectAll, applySelectNone
    team-pick.ts         # renderTeamPickHeader — pick-mode candidate bar (pure, no I/O)
    layout-constants.ts  # Shared header-line counts, mouse button codes and
                         #   MOUSE_SCROLL_STEP, hit-test column math — no I/O
    mouse.ts             # Pure SGR mouse-escape-sequence parser: parseMouseEvent() — no I/O
    mouse-hit.ts         # Pure hit-testing: hitTestClick() maps a click (x, y) + scrollOffset
                         #   to a Row and the zone that was clicked — no I/O

  *.test.ts              # Unit tests co-located with source files
  test-setup.ts          # Global test setup (Bun preload)
```

## Key architectural principles

- **Pure functions first.** All business logic lives in pure, side-effect-free functions (`aggregate.ts`, `group.ts`, `output.ts`, `render/` sub-modules). This makes them straightforward to unit-test.
- **Side effects are isolated.** API calls (`api.ts`, `api-utils.ts`), TTY interaction (`tui.ts`) and CLI parsing (`github-code-search.ts`) are the only side-effectful surfaces. `api-utils.ts` hosts shared retry/pagination helpers that perform network I/O and must not be used outside `api.ts`. `cache.ts` hosts disk-cache helpers that perform filesystem I/O and must not be used outside `api.ts`.
- **`render.ts` is a façade.** It re-exports everything from `render/` and adds two top-level rendering functions. Consumers import from `render.ts`, not directly from sub-modules. Exceptions: `render/team-pick.ts`, `render/mouse.ts` and `render/mouse-hit.ts` are pure modules imported **directly** by their sole consumer (`render.ts` for `team-pick.ts`, `tui.ts` for the mouse modules) and are not re-exported publicly (knip would flag unused re-exports otherwise).
- **`render/terminal.ts` is the sole Bun API call site.** All calls to `Bun.stringWidth()`, `Bun.stripANSI()`, and `Bun.sliceAnsi()` must go through the `terminal.ts` wrapper functions (`visibleWidth()`, `stripAnsi()`, `clipToWidth()`, `hasAnsi()`). This centralizes terminal handling logic and makes it easy to verify correct Unicode handling (graphemes, emoji, CJK, ZWJ sequences).
- **`src/style.ts` is the sole call site for `node:util`'s `styleText`.** All ANSI styling across the codebase (`render.ts`, `render/highlight.ts`, `render/summary.ts`, `render/team-pick.ts`, `tui.ts`, `upgrade.ts`, `api.ts`, `github-code-search.ts`) goes through this facade instead of importing `styleText` directly or reintroducing a styling npm package. Multi-style compositions (e.g. bold+yellow) must use the `style(names[], text)` array form, not chained/nested calls — `bold` and `dim` share the same SGR reset code, so naive chaining can produce incorrect output when there is trailing content after a nested style.
- **`types.ts` is the single source of truth** for all shared interfaces. Any new shared type must go there.
- **No classes** — the codebase uses plain TypeScript interfaces and functions throughout.

## Writing tests

- Test files are named `<module>.test.ts` and sit next to their source file.
- Use `describe` / `it` / `expect` from Bun's test runner.
- Only pure functions need tests; `tui.ts` and `api.ts` are not unit-tested.
  `api-utils.ts` is the exception: its helpers are unit-tested by mocking `globalThis.fetch`.
  `cache.ts` is also tested: it uses the `GITHUB_CODE_SEARCH_CACHE_DIR` env var override to redirect to a temp directory, so tests have no filesystem side effects on the real cache dir.
  `completions.ts` is fully unit-tested (`completions.test.ts`). Tests that exercise `getCompletionFilePath()` must unset `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and `ZDOTDIR` in `beforeEach` (and restore them in `afterEach`) to avoid contamination from the CI runner environment.
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

**For agent-created commits** — ensure the agent runs a local `git commit -S` so the local GPG/SSH key is used and the commit bears the developer's own verified signature. This is the **required approach** in this repository.

> ⚠️ **Do NOT use MCP REST API push tools** (`mcp_github_push_files`, `mcp_github_create_or_update_file`) to create commits in this repo.  
> Those tools push files via the GitHub REST API and create commits signed by GitHub's own key — not the developer's personal key. While GitHub marks them as "Verified", they do not carry the developer's identity.  
> **Always commit locally via `git commit -S` (or with `commit.gpgsign = true`)** and push with `git push`.

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

## Release process

### Deciding the version bump

This project follows [Semantic Versioning](https://semver.org/):

| Change type                                | Bump    | Example       |
| ------------------------------------------ | ------- | ------------- |
| Bug fix (no new behaviour, no API change)  | `patch` | 1.2.4 → 1.2.5 |
| New feature, backward-compatible           | `minor` | 1.2.4 → 1.3.0 |
| Breaking change (CLI flag removed/renamed) | `major` | 1.2.4 → 2.0.0 |

### Step-by-step

```bash
# 1. Bump the version in package.json directly
#    Do NOT use `bun pm version` — it creates a git commit AND a git tag
#    automatically, which conflicts with the release workflow below.
sed -i '' 's/"version": ".*"/"version": "X.Y.Z"/' package.json
jq -r .version package.json   # verify

# 2. Create the release branch and commit
git checkout -b release/$(jq -r .version package.json)
git add package.json
git commit -S -m "v$(jq -r .version package.json)"

# 3. Write (or update) the blog post for the release
#    • Required for minor and major releases.
#    • Patch releases: optional — a brief note in the GitHub Release is sufficient.
#    File: docs/blog/release-v<X-Y-Z>.md  (e.g. docs/blog/release-v1-3-0.md)
#    Update docs/blog/index.md table too.

# 4. Tag and push — this triggers the CD pipeline
git tag v$(jq -r .version package.json)
git push origin release/$(jq -r .version package.json) --tags
```

### What the CI does automatically

Pushing a tag `vX.Y.Z` triggers **`cd.yaml`**:

1. Compiles the binary for all six targets (linux-x64, linux-arm64, linux-x64-baseline, darwin-x64, darwin-arm64, windows-x64).
2. Creates a **GitHub Release** with all binaries attached.
   `generate_release_notes: true` — GitHub auto-populates the release body from merged PR titles and commit messages since the previous tag.
3. Legacy platform aliases are also published for backward-compat with pre-v1.2.1 binaries.

Pushing a **major** tag (`vX.0.0`) additionally triggers **`docs.yml` → snapshot job**:

1. Builds a versioned docs snapshot at `/github-code-search/vX/`.
2. Auto-generates `docs/blog/release-vX-0-0.md` stub if it does not exist yet.
3. Prepends the new entry to `docs/public/versions.json` and commits back to `main`.

### Blog post requirement

> **Always ask the user interactively before writing the blog post.**
> Do not invent highlights or descriptions from code alone. Ask at minimum:
>
> - Which changes should be highlighted?
> - Is there a one-line description for the front-matter?
> - Any before/after CLI output examples to include?
>
> Only proceed to write `docs/blog/release-v<X-Y-Z>.md` once you have the user's input.

| Release type | Blog post                                                   | Location                          |
| ------------ | ----------------------------------------------------------- | --------------------------------- |
| **Major**    | Required (written by hand — CI stub automates the skeleton) | `docs/blog/release-vX-0-0.md`     |
| **Minor**    | Required                                                    | `docs/blog/release-vX-Y-0.md`     |
| **Patch**    | Optional                                                    | GitHub Release body is sufficient |

For minor/major releases update `docs/blog/index.md` to add a row in the version table:

```markdown
| [vX.Y.Z](./release-vX-Y-Z) | One-line highlights |
```

---

## Development notes

- **TypeScript throughout** — no `.js` files in `src/`.
- Bun executes `.ts` files directly; no transpilation step is needed to run the CLI locally (`bun github-code-search.ts query ...`).
- The `--exclude-repositories` and `--exclude-extracts` options accept both short (`repoName`) and long (`org/repoName`) forms — this normalisation happens in `aggregate.ts`.
- The `--group-by-team-prefix` option requires a `read:org` GitHub token scope; this is documented in `README.md`.
- The `upgrade` subcommand replaces the running binary in-place using `src/upgrade.ts`; be careful with filesystem operations there.
- After a successful upgrade, `refreshCompletions()` (in `src/upgrade.ts`) silently overwrites the existing completion file if one is already present. It never creates a file from scratch — installation is the user's responsibility (via `install.sh` or the `completions` subcommand).
- The `completions` subcommand (in `github-code-search.ts`) prints the completion script for the detected (or specified) shell to stdout. It is a thin wrapper around `generateCompletion()` in `src/completions.ts`.
- Shell-integration tests for `install.sh` live in `install.test.bats` and require `bats-core`. Run them with `bun run test:bats`. The CI runs them in a dedicated `test-bats` job using `bats-core/bats-action`.
- `src/style.ts` is the sole call site for `node:util`'s `styleText` and the only styling dependency-free abstraction in the codebase; do not import `styleText` directly elsewhere, and do not add `chalk`/`picocolors`/or similar external styling packages.
- Keep `knip` clean: every exported symbol must be used; every import must resolve.
- The `--pick-team` option is repeatable (Commander collect function); each assignment resolves one combined section label to a single team. A warning is emitted on stderr when a label is not found.
- `src/render/team-pick.ts` is a pure module (no I/O) and must be consumed only via the `src/render.ts` façade — it is imported **directly** inside `render.ts` for internal use but is not re-exported publicly (knip would flag it).
- `RepoGroup.pickedFrom` (optional field in `src/types.ts`) tracks the combined label a repo was moved from; future split-mode features will use this to offer re-assignment.
- **Mouse support** uses the terminal's SGR mouse-reporting protocol (`\x1b[?1000h\x1b[?1006h`), enabled in `runInteractive()` (`tui.ts`) next to `process.stdin.setRawMode(true)` and disabled on **every** exit path (normal exit, `q`, Ctrl+C, unhandled error) so a crashed process never leaves the user's terminal stuck in mouse-reporting mode. Escape sequences are parsed by `parseMouseEvent()` (`src/render/mouse.ts`), clicks are mapped to a row/zone by `hitTestClick()` (`src/render/mouse-hit.ts`), and wheel scroll steps use `MOUSE_SCROLL_STEP` (`src/render/layout-constants.ts`). `src/scroll-cooldown.ts` debounces clicks for a short window after a wheel scroll to avoid accidental selection during trackpad momentum scrolling. Documented for users in `docs/reference/keyboard-shortcuts.md` § Mouse support and `docs/usage/interactive-mode.md`.
