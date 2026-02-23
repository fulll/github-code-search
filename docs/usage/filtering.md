# Filtering

`github-code-search` provides three pre-query filtering options so you can exclude noise before results ever appear in the TUI or output.

## `--exclude-repositories`

Excludes entire repositories from the results. The org prefix is optional.

```bash
# Short form (recommended)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-repositories legacy-monolith,archived-app

# Long form (also accepted)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-repositories fulll/legacy-monolith,fulll/archived-app
```

Pass a comma-separated list. There is no limit on the number of repos you can exclude.

::: tip
The short form (without the org prefix) is recommended — it is easier to read and works regardless of organisation name.
:::

## `--exclude-extracts`

Excludes individual code extracts. The format is `repoName:path/to/file:matchIndex`.

```bash
# Exclude the first extract (index 0) of src/flags.ts in billing-api
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts billing-api:src/flags.ts:0

# Exclude multiple extracts
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts billing-api:src/flags.ts:0,auth-service:tests/unit/featureFlags.test.ts:1

# Long form (also accepted)
github-code-search "useFeatureFlag" --org fulll \
  --exclude-extracts fulll/billing-api:src/flags.ts:0
```

The index is **zero-based** and corresponds to the position of the file in the GitHub API result list for that repository — not the position of the match within the file itself. Each `(repo, file)` pair is one extract with a unique index.

::: warning
An extract's index is relative to the GitHub API response for that repo. It may change if GitHub re-indexes the repository between calls. For greater stability, prefer `--exclude-repositories` when the entire repository should be excluded.
:::

### How to find the index

In the TUI, the extract rows are listed in API order: the first file shown for a repo has index 0, the second has index 1, and so on. In non-interactive mode, extracts are printed in the same order.

The **replay command** printed at the end of an interactive session automatically includes the correct `--exclude-extracts` values for any extracts you deselected — you don't need to figure out indices manually.

## `--include-archived`

By default, archived repositories are excluded from results. Pass `--include-archived` to include them:

```bash
github-code-search "useFeatureFlag" --org fulll --include-archived
```

::: info
Archived repos are silently filtered out in the aggregation step before the TUI is shown. This flag overrides that behaviour.
:::

## Combining filters

All three flags can be combined freely:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --include-archived \
  --exclude-repositories legacy-monolith \
  --exclude-extracts billing-api:src/flags.ts:0
```

## In-TUI filtering (file path filter)

In addition to pre-query exclusions, the [interactive mode](/usage/interactive-mode) offers a live **path filter** (press `f`) to narrow the displayed extracts by file path substring without permanently excluding anything.

Use the path filter for **exploration** (no side effects), and `--exclude-extracts` / `--exclude-repositories` for **reproducible** exclusions in replay commands.
