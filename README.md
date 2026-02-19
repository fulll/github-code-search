# github-code-search

An interactive CLI (powered by [Bun](https://bun.com)) to search GitHub code across an organization, with per-repository result aggregation, keyboard navigation, and fine-grained extract selection.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- A GitHub token with the `repo` scope (for private repos) or `public_repo`

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

## Installation

### Via `curl` (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

The script automatically detects your OS (Linux, macOS) and architecture (x64, arm64) and installs the right pre-compiled binary from the [latest release](https://github.com/fulll/github-code-search/releases/latest) to `/usr/local/bin`.

To install a specific version or to a custom directory:

```bash
INSTALL_DIR=~/.local/bin VERSION=v1.0.6 \
  curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

### From source (requires [Bun](https://bun.sh) ≥ 1.0)

```bash
git clone https://github.com/fulll/github-code-search
cd github-code-search
bun install
bun run build.ts
# → produces dist/github-code-search
```

## Usage

```
github-code-search <query> --org <org> [options]   # default (backward-compat)
github-code-search query <query> --org <org> [options]
github-code-search upgrade
```

### Commands

| Command                     | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `<query>` / `query <query>` | Search GitHub code (default command)                |
| `upgrade`                   | Check for a new release and auto-upgrade the binary |

### Search options

| Option                           | Required | Description                                                                                           |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `--org <org>`                    | ✅       | GitHub organization to search in                                                                      |
| `--exclude-repositories <repos>` | ❌       | Comma-separated list of repos to exclude. **Short form** (without org prefix) accepted: `repoA,repoB` |
| `--exclude-extracts <refs>`      | ❌       | Extracts to exclude. Short format: `repoA:src/foo.ts:0,repoB:lib/bar.ts:1`                            |
| `--no-interactive`               | ❌       | Disable interactive mode (equivalent to `CI=true`)                                                    |
| `--format <format>`              | ❌       | Output format: `markdown` (default) or `json`                                                         |
| `--output-type <type>`           | ❌       | Output type: `repo-and-matches` (default) or `repo-only`                                              |
| `--include-archived`             | ❌       | Include archived repositories in results (default: false)                                             |
| `--group-by-team-prefix <pfxs>`  | ❌       | Comma-separated team-name prefixes to group repos by GitHub team (e.g. `squad-,chapter-`)             |

## Interactive mode

### Why use it?

The interactive mode is the main advantage of this script over the GitHub Code Search web UI:

- **Per-repository aggregation**: results are grouped by repo rather than shown as a flat list.
- **Fold/unfold**: collapse a repo to hide its extracts and focus on others.
- **Fine-grained selection**: pick exactly which repos and extracts you care about.
- **Structured output**: on confirmation, you get a clean list with Markdown links to the selected extracts.
- **Replay command**: a command line is automatically generated to reproduce the exact same selection without the UI (useful for CI or documentation).

### Keyboard shortcuts

| Key            | Action                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `↑` / `↓`      | Navigate between repos and extracts                                                                                                     |
| `←`            | Fold the repo under the cursor                                                                                                          |
| `→`            | Unfold the repo under the cursor                                                                                                        |
| `Space`        | Select / deselect the current repo or extract                                                                                           |
| `a`            | Select **all** (on a repo row: all repos+extracts; on an extract row: all extracts in that repo). Respects the active file-path filter. |
| `n`            | Select **none** (same context rules as `a`). Respects the active file-path filter.                                                      |
| `f`            | Open the **filter bar** — type a path substring to show only matching files                                                             |
| `r`            | **Reset** the active filter and show all repos/extracts again                                                                           |
| `h` / `?`      | Toggle the **help overlay** (shows all key bindings)                                                                                    |
| `Enter`        | Confirm and print selected results (also closes the help overlay)                                                                       |
| `q` / `Ctrl+C` | Quit without printing results                                                                                                           |

#### Filter mode

Press `f` to enter filter mode. A filter bar appears at the top of the results:

```
🔍 Filter: src/  ▌  Enter confirm · Esc cancel
```

Type any path substring (case-insensitive). As you type, the view updates live. Press **Enter** to confirm the filter or **Esc** to cancel without applying it.

When a filter is active, a stats line replaces the input bar:

```
🔍 filter: src/  3 matches in 2 repos shown · 4 hidden in 1 repo  r to reset
```

The `a` and `n` keys operate only on the currently visible (filtered) repos and extracts. Press `r` to clear the filter.

### Selection behaviour

- **Selecting a repo** (via `Space` on the repo row): cascades the selection/deselection to all its extracts.
- **Selecting an extract** individually: if at least one extract remains selected, the parent repo stays selected.

## Interactive session example

```
GitHub Code Search: useFeatureFlag in fulll
3 repos · 4 files
← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  h help  ↵ confirm  q quit

▶ ◉  fulll/billing-api  (3 extracts)
▼ ◉  fulll/auth-service  (2 extracts)          ← unfolded repo
      ◉  src/middlewares/featureFlags.ts
            …const flag = useFeatureFlag('new-onboarding'); if (!flag) return next();…
      ◉  tests/unit/featureFlags.test.ts
            …expect(useFeatureFlag('new-onboarding')).toBe(true);…
▶ ○  fulll/legacy-monolith  (1 extract)         ← deselected repo
▶ ◉  fulll/frontend-app  (5 extracts)
```

**With an active filter** (after pressing `f` and typing `src`):

```
GitHub Code Search: useFeatureFlag in fulll
3 repos · 11 matches
2 repos · 5 matches selected
🔍 filter: src/  2 matches in 1 repo shown · 9 hidden in 2 repos  r to reset
← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  h help  ↵ confirm  q quit

▼ ◉  fulll/auth-service  (2 extracts)
      ◉  src/middlewares/featureFlags.ts
            …const flag = useFeatureFlag('new-onboarding'); if (!flag) return next();…
```

After pressing **Enter**:

3 repos · 6 files · 7 matches selected

- **fulll/auth-service** (2 matches)
  - [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
  - [tests/unit/featureFlags.test.ts:1:8](https://github.com/fulll/auth-service/blob/main/tests/unit/featureFlags.test.ts#L1)
- **fulll/billing-api**
  - [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)
  - [src/routes/invoices.ts:1:1](https://github.com/fulll/billing-api/blob/main/src/routes/invoices.ts#L1)
  - [src/routes/subscriptions.ts:1:1](https://github.com/fulll/billing-api/blob/main/src/routes/subscriptions.ts#L1)
- **fulll/frontend-app**
  - [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)
  - [src/components/Dashboard.tsx:4:3](https://github.com/fulll/frontend-app/blob/main/src/components/Dashboard.tsx#L4)

<details>
<summary>replay command</summary>

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive \
  --exclude-repositories legacy-monolith
```

</details>

## Non-interactive mode (CI)

### Why use it?

Non-interactive mode is useful in three cases:

1. **Continuous integration**: no TTY is available in a GitHub Actions pipeline or similar environment.
2. **Reproducibility**: after an interactive session, the generated replay command lets you re-run the exact same search with the same exclusions, without going through the UI again.
3. **Scripting**: combine the output with other tools (`grep`, `jq`, shell scripts…).

### Enabling non-interactive mode

Three equivalent ways:

```bash
# 1. Via the standard CI environment variable
CI=true github-code-search "useFeatureFlag" --org fulll

# 2. Via the explicit flag
github-code-search "useFeatureFlag" --org fulll --no-interactive

# 3. In a GitHub Actions pipeline (CI=true is set automatically)
- run: github-code-search "useFeatureFlag" --org fulll
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Example CI output

```bash
$ CI=true github-code-search "useFeatureFlag" --org fulll
```

3 repos · 5 matches selected

- **fulll/auth-service**
  - [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
  - [tests/unit/featureFlags.test.ts:1:8](https://github.com/fulll/auth-service/blob/main/tests/unit/featureFlags.test.ts#L1)
- **fulll/billing-api**
  - [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)
  - [src/routes/invoices.ts:1:1](https://github.com/fulll/billing-api/blob/main/src/routes/invoices.ts#L1)
- **fulll/frontend-app**
  - [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)

<details>
<summary>replay command</summary>

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive
```

</details>

## Exclusion options

### `--exclude-repositories`

Excludes entire repos from the results. **The org prefix is optional.**

```bash
# Short form (recommended)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-repositories legacy-monolith,archived-app

# Long form (also accepted)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-repositories fulll/legacy-monolith,fulll/archived-app
```

### `--exclude-extracts`

Excludes individual extracts. The format is `repoName:path/to/file:matchIndex`.  
**The org prefix is optional.** The index corresponds to the position of the extract in the API results for that file.

```bash
# Exclude extract 0 of src/flags.ts in billing-api
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts billing-api:src/flags.ts:0

# Exclude multiple extracts
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts billing-api:src/flags.ts:0,auth-service:tests/unit/featureFlags.test.ts:1

# Long form (also accepted)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts fulll/billing-api:src/flags.ts:0
```

## Full example: typical workflow

**1. Initial interactive session to explore results:**

```bash
github-code-search "useFeatureFlag" --org fulll
```

> You navigate, deselect `legacy-monolith`, deselect the test extract in `auth-service`, then press Enter.

**2. Output + replay command:**

2 repos · 3 matches selected

- **fulll/auth-service**
  - [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
- **fulll/billing-api**
  - [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)
  - [src/routes/invoices.ts:1:1](https://github.com/fulll/billing-api/blob/main/src/routes/invoices.ts#L1)
- **fulll/frontend-app**
  - [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)

<details>
<summary>replay command</summary>

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive \
  --exclude-repositories legacy-monolith \
  --exclude-extracts auth-service:tests/unit/featureFlags.test.ts:0
```

</details>

**3. Replay without UI (CI, scripting, documentation):**

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive \
  --exclude-repositories legacy-monolith \
  --exclude-extracts auth-service:tests/unit/featureFlags.test.ts:0
```

## File count in the summary line

The header and output summary distinguish two levels of granularity:

| Label       | Meaning                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| **files**   | Number of _unique file paths_ across all repos (e.g. `src/config.ts` present in 3 repos counts as **1 file**) |
| **matches** | Total `(repo, file)` pairs — i.e. the usual per-repo extract count                                            |

```
49 repos · 112 files · 234 matches
```

The `matches` segment is hidden when it equals `files` (i.e. every file appears in exactly one repo, which is the common case). It appears automatically as soon as a file path is shared across repos.

When a partial selection is active, both counts show their selected values:

```
49 repos (47 selected) · 112 files (109 selected) · 234 matches (231 selected)
```

## --group-by-team-prefix

Group result repositories by their GitHub team membership, using one or more
team-name prefixes:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-,chapter-
```

The option accepts a **comma-separated list of prefixes**. The tool fetches all
org teams matching any of those prefixes, maps each repo to its teams, then
applies the following grouping algorithm:

1. **First prefix** (`squad-`)
   - Repos belonging to **exactly 1** squad-\* team → one section per team, sorted alphabetically.
   - Repos belonging to **2** squad-* teams → one section per team *combination\*, sorted alphabetically.
   - Repos belonging to **3+** squad-\* teams → same, in ascending combination-size order.
2. **Next prefix** (`chapter-`) — applied to repos that were **not** assigned in the previous step, using the same rules.
3. Repos matching **no prefix** are collected into an `other` section at the end.

### Example output (non-interactive / markdown)

```
4 repos · 5 files · 6 matches selected

## squad-backend

- **fulll/billing-api** (3 matches)
  - [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)

## squad-frontend

- **fulll/auth-service** (2 matches)
  - [src/middlewares/featureFlags.ts:2:19](...)

## squad-frontend + squad-mobile

- **fulll/frontend-app** (1 match)
  - [src/hooks/useFeatureFlag.ts:1:1](...)

## other

- **fulll/legacy-monolith** (1 match)
  - [src/legacy.js:5:1](...)
```

### TUI with sections

In interactive mode each team section appears as a separator line between the
corresponding repo rows:

```
── squad-frontend
▶ ◉  fulll/auth-service  (2 matches)
── squad-mobile
▶ ◉  fulll/frontend-app  (1 match)
── other
▶ ◉  fulll/legacy-monolith  (1 match)
```

Navigation (↑ / ↓) automatically skips section header rows.

### Required token scope

Fetching team membership requires the token to have the **`read:org`** (or
`admin:org`) scope in addition to `repo` / `public_repo`.

## Known limitations

- The GitHub Code Search API is capped at **1,000 results** per query and **10 requests/minute** without authentication (30/min with a token).
- Results may differ slightly between calls due to GitHub's indexing.
- An extract's index (`--exclude-extracts`) is relative to the order returned by the API: it may change if GitHub re-indexes the repository between calls. For greater stability, prefer whole-repository exclusions (`--exclude-repositories`) when possible.

## JSON output

Pass `--format json` (or `-format json` in CI mode) to get machine-readable output:

```bash
CI=true github-code-search "useFeatureFlag" --org fulll --format json
```

```json
{
  "query": "useFeatureFlag",
  "org": "fulll",
  "selection": { "repos": 1, "matches": 1 },
  "results": [
    {
      "repo": "fulll/auth-service",
      "matches": [
        {
          "path": "src/middlewares/featureFlags.ts",
          "url": "https://github.com/...",
          "line": 2,
          "col": 19
        }
      ]
    }
  ],
  "replayCommand": "# Replay:\ngithub-code-search \"useFeatureFlag\" --org fulll --no-interactive"
}
```

The interactive mode also respects `--format json`: pressing **Enter** will output the JSON payload.
