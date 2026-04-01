# Output formats

`github-code-search` can produce two output formats — **Markdown** (default) and **JSON** — controlled by `--format`. Both formats are available in interactive and non-interactive modes.

## `--format markdown` (default)

Produces a human-readable Markdown document with clickable GitHub links.

```bash
github-code-search "useFeatureFlag" --org fulll --format markdown --no-interactive
```

```text
# Results for "useFeatureFlag"

3 repos · 4 files selected

- **fulll/auth-service** (2 matches)
  - [ ] [src/middlewares/featureFlags.ts:2:19](...): `useFeatureFlag`
  - [ ] [tests/unit/featureFlags.test.ts:1:8](...): `useFeatureFlag`
- **fulll/billing-api** (1 match)
  - [ ] [src/flags.ts:3:14](...): `useFeatureFlag`
- **fulll/frontend-app** (1 match)
  - [ ] [src/hooks/useFeatureFlag.ts:1:1](...): `useFeatureFlag`
```

::: details replay command

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive
```

:::

Each extract link points directly to the matching line on GitHub. When the GitHub API returns the exact matched token, it is appended inline after the link — for example:

```text
  - [ ] [src/foo.ts:3:5](https://github.com/org/repo/blob/main/src/foo.ts#L3): `useFeatureFlag`
```

## Query title

Every output — in both Markdown and JSON formats, and for both `repo-only` and `repo-and-matches` output types — is prefixed with a `# Results for` heading that identifies the search query. When active qualifiers are present, they are appended after a `·` separator:

```text
# Results for "useFeatureFlag" · including archived · excluding templates
```

In [regex mode](/usage/search-syntax#regex-mode), the pattern is shown in backticks:

```text
# Results for `/useFeatureFlag/i`
```

## `--format json`

Produces a machine-readable JSON payload — useful for scripting, dashboards, or feeding into another tool.

```bash
github-code-search "useFeatureFlag" --org fulll --format json --no-interactive
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
          "url": "https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts",
          "line": 2,
          "col": 19,
          "matchedText": "useFeatureFlag"
        }
      ]
    }
  ],
  "replayCommand": "# Replay:\ngithub-code-search \"useFeatureFlag\" --org fulll --format json --no-interactive"
}
```

::: tip
`--format json` works in interactive mode too — pressing `Enter` outputs the JSON payload.
:::

## `--output-type`

The `--output-type` flag controls how much detail is included in the output, regardless of format:

| Value              | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| `repo-and-matches` | _(default)_ — includes each matching file and its code extract |
| `repo-only`        | Lists only the repository names, without individual extracts   |

### Example — repo-only Markdown

```bash
github-code-search "useFeatureFlag" --org fulll \
  --output-type repo-only --no-interactive
```

```text
# Results for "useFeatureFlag"

fulll/auth-service
fulll/billing-api
fulll/frontend-app
```

::: details replay command

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive --output-type repo-only
```

:::

### Example — repo-only JSON

```bash
github-code-search "useFeatureFlag" --org fulll \
  --format json --output-type repo-only --no-interactive
```

```json
{
  "query": "useFeatureFlag",
  "org": "fulll",
  "selection": { "repos": 3, "matches": 5 },
  "results": [
    { "repo": "fulll/auth-service" },
    { "repo": "fulll/billing-api" },
    { "repo": "fulll/frontend-app" }
  ],
  "replayCommand": "# Replay:\ngithub-code-search \"useFeatureFlag\" --org fulll --format json --no-interactive --output-type repo-only"
}
```

::: tip `repo-only` is ideal for CI steps that only need a list of affected repositories — for example, to trigger downstream pipelines.
:::

## Summary line

The header and output summary distinguish two levels of granularity:

| Label       | Meaning                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **files**   | Number of unique file paths across all repos (`src/config.ts` in 3 repos counts as **1 file**) |
| **matches** | Total `(repo, file)` pairs — the usual per-repo extract count                                  |

```text
49 repos · 112 files · 234 matches
```

The `matches` segment is hidden when it equals `files` (i.e. every file appears in exactly one repo). It appears automatically as soon as a file path is shared across multiple repos.

When a partial selection is active:

```text
49 repos (47 selected) · 112 files (109 selected) · 234 matches (231 selected)
```
