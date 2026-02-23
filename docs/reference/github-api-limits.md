# GitHub API limits

This page documents the hard limits of the GitHub Code Search API that affect `github-code-search`. Understanding them helps you craft effective queries and plan your usage.

## Result limits

| Limit                 | Value                  | Notes                                                                          |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| **Max results**       | 1,000 items            | Hard cap — GitHub returns at most 10 pages × 100 items/page for code search    |
| **Max pagination**    | Page 10                | GitHub hard cap for the code search endpoint                                   |
| **Max query length**  | 256 characters         | Queries exceeding this length are rejected by the API                          |
| **Fork repositories** | Excluded by default    | Add `fork:true` to the query string to include forks                           |
| **Min query length**  | ≥ 1 non-qualifier term | A query consisting only of qualifiers (e.g. `language:TypeScript`) is rejected |

::: tip Stay under 1,000 results
If your query matches more than 1,000 files, `github-code-search` will only see the first 1,000. Use qualifiers (`language:`, `path:`, `filename:`) to narrow the results. See [Search syntax](/usage/search-syntax) for examples.
:::

## Rate limits

| Scenario                            | Limit              |
| ----------------------------------- | ------------------ |
| Unauthenticated requests            | 10 requests/minute |
| Authenticated (with `GITHUB_TOKEN`) | 30 requests/minute |

`github-code-search` always authenticates with `GITHUB_TOKEN`. Each paginated search call consumes one request. A query returning 1,000 results requires 10 requests (10 pages × 100 items).

::: warning Rate limit exceeded
If the 30 req/min limit is reached, `github-code-search` surfaces a `GitHub API error 403` or `429`. Wait 60 seconds and retry, or break the query into multiple narrower searches.
:::

## Query syntax constraints

| Constraint                 | Detail                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **No regular expressions** | Code search uses exact string and qualifier matching — regex patterns are not supported |
| **Max boolean operators**  | 5 `AND` / `OR` / `NOT` per query                                                        |
| **`NOT` operator**         | Supported for keyword exclusions (e.g. `useFeatureFlag NOT deprecated`)                 |
| **Qualifier-only queries** | Not allowed — at least one non-qualifier search term is required                        |

::: info `NOT` vs issue/PR search
The `NOT` operator is supported in GitHub Code Search, but its behaviour differs from issue/PR search. For code search, use it to exclude keywords — for example `useFeatureFlag NOT deprecated`, `SECRET NOT filename:test`.
:::

## Pagination behaviour

`github-code-search` automatically fetches all available pages (up to page 10) using the GitHub Code Search REST API with `per_page=100`. Results from all pages are aggregated and deduplicated before being shown in the TUI or printed.

If 1,000 results are returned and the last page is full, there may be additional results that are silently truncated by GitHub. Refine your query to avoid hitting the ceiling.

## Official documentation

- [GitHub REST API — Search code](https://docs.github.com/en/rest/search/search#search-code)
- [Searching code on GitHub](https://docs.github.com/en/search-github/searching-on-github/searching-code)
- [Understanding GitHub code search syntax](https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax)
