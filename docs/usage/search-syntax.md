# Search syntax

`github-code-search` automatically injects an `org:<org>` qualifier from `--org` and otherwise passes the rest of your query unchanged to the [GitHub Code Search API](https://docs.github.com/en/search-github/searching-on-github/searching-code). Any syntax that works in the GitHub search bar also works here.

## Basic query

```bash
github-code-search "useFeatureFlag" --org fulll
```

Searches for the literal string `useFeatureFlag` across all repositories in the `fulll` organisation.

## Qualifiers

GitHub code search supports a set of qualifiers you can combine with your keyword:

| Qualifier             | Description                                                      | Example                              |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `language:<lang>`     | Filter by programming language                                   | `useFeatureFlag language:TypeScript` |
| `path:<pattern>`      | Restrict to files whose path matches the glob or substring       | `config path:src/config`             |
| `filename:<name>`     | Match files by name (supports wildcards)                         | `SECRET filename:.env`               |
| `extension:<ext>`     | Match files by extension                                         | `connect extension:ts`               |
| `repo:<owner>/<repo>` | Restrict to a single repository (less useful here — use `--org`) | `connect repo:fulll/billing-api`     |
| `NOT <term>`          | Exclude a keyword                                                | `connect NOT deprecated`             |
| `"exact phrase"`      | Exact multi-word match                                           | `"feature flag"`                     |

::: tip
Qualifiers can be combined freely:  
`"feature flag" language:TypeScript path:src/`
:::

## Practical examples

### Find all usages of a function

```bash
github-code-search "useFeatureFlag" --org fulll
```

### Restrict to TypeScript files

```bash
github-code-search "useFeatureFlag language:TypeScript" --org fulll
```

### Search in a specific directory

```bash
github-code-search "SENTRY_DSN path:config" --org fulll
```

### Search for a file by name

```bash
github-code-search "filename:docker-compose.yml" --org fulll
```

### Exclude test files

```bash
github-code-search "useFeatureFlag NOT filename:test NOT filename:spec" --org fulll
```

### Restrict to specific repositories

Although `--org` already limits the search to your organisation, you can further narrow results to one or more specific repositories using `repo:` qualifiers in the query string:

```bash
github-code-search "useFeatureFlag repo:fulll/billing-api repo:fulll/auth-service" --org fulll
```

`--org` is still required for the API call even when `repo:` qualifiers are present. The `org:<org>` qualifier is injected automatically alongside your query.

### Find hardcoded secrets (audit use case)

```bash
github-code-search "password= language:TypeScript NOT filename:test" --org fulll
```

## Regex queries

`github-code-search` supports regex syntax using the `/pattern/flags` notation, just like the GitHub web UI.

Because the GitHub Code Search API does not natively support regex, the CLI automatically extracts a representative literal term from the regex to send to the API, then filters the returned results locally with the full pattern. In most cases this is fully transparent.

```bash
# Imports using the axios module (any quote style)
github-code-search "/from.*['\"\`]axios/" --org fulll

# Axios dependency in package.json (any semver prefix)
github-code-search '"axios": "[~^]?[0-9]" filename:package.json' --org fulll

# Old library require() calls
github-code-search "/require\\(['\"](old-lib)['\"]\\)/" --org fulll

# Any of TODO, FIXME or HACK comments
github-code-search "/TODO|FIXME|HACK/" --org fulll
```

::: tip Top-level alternation
When the regex contains a **top-level `|`** (e.g. `TODO|FIXME|HACK`), the CLI sends
an `A OR B OR C` query to the GitHub API so that **all branches are covered** — no results are missed.
:::

### When auto-extraction is not precise enough

If the extracted term is very short (fewer than 3 characters), the CLI will exit with a warning and ask you to provide a manual hint:

```text
⚠  Regex mode — could not extract a term longer than 2 chars from /[~^]?[0-9]/
   Provide a manual hint with --regex-hint <term>.
```

Use `--regex-hint` to override the API search term while still applying the full regex filter locally:

```bash
github-code-search '/"axios":\s*"[~^]?[0-9]/ filename:package.json' \
  --org fulll \
  --regex-hint '"axios"'
```

::: warning API coverage
The GitHub Code Search API returns **at most 1,000 results** per query. The regex filter
is applied to those results; results beyond the API cap can never be seen. Refine the
query with qualifiers (`language:`, `path:`, `filename:`) to keep the result set small.
:::

## API limits

The GitHub Code Search API returns at most **1,000 results** per query. If your query returns more, refine it with qualifiers (especially `language:` or `path:`) to stay below the limit.

See the [GitHub API limits](/reference/github-api-limits) reference for details on rate limits and pagination.

## What's next?

Once you have results, use the [interactive mode](/usage/interactive-mode) to browse and select them, or the [non-interactive mode](/usage/non-interactive-mode) to pipe them into a script.
