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

### Find hardcoded secrets (audit use case)

```bash
github-code-search "password= language:TypeScript NOT filename:test" --org fulll
```

## API limits

The GitHub Code Search API returns at most **1 000 results** per query. If your query returns more, refine it with qualifiers (especially `language:` or `path:`) to stay below the limit.

See the [GitHub API limits](/reference/github-api-limits) reference for details on rate limits and pagination.

## What's next?

Once you have results, use the [interactive mode](/usage/interactive-mode) to browse and select them, or the [non-interactive mode](/usage/non-interactive-mode) to pipe them into a script.
