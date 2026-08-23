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

Because the GitHub Code Search API does not natively support regex, the CLI automatically extracts a representative literal term from the regex to send to the API, then filters the returned results locally with the full pattern. In most cases this is fully transparent, including patterns that contain literal `"` characters, which the CLI escapes automatically using GitHub's own quote-escaping syntax (see [Searching for a literal quote character](#searching-for-a-literal-quote-character) below).

```bash
# Imports using the axios module (any quote style)
github-code-search "/from.*['\"\`]axios/" --org fulll

# Axios dependency in package.json (any semver prefix) — the double quotes in
# the pattern are preserved and escaped automatically for the GitHub API
github-code-search '/"axios": "[~^]?[0-9]"/ filename:package.json' --org fulll

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
⚠  Regex mode — No meaningful search term could be extracted from the regex pattern. Use --regex-hint <term> to specify the term to send to the GitHub API.
```

This happens when the pattern has no literal characters at all, for example a pure version-number match:

```bash
github-code-search '/[0-9]+\.[0-9]+\.[0-9]+/' --org fulll
```

Use `--regex-hint` to override the API search term while still applying the full regex filter locally:

```bash
github-code-search '/[0-9]+\.[0-9]+\.[0-9]+/ filename:package.json' \
  --org fulll \
  --regex-hint version
```

::: tip Quoting a single word has no filtering effect
Wrapping a single word in double quotes (e.g. `--regex-hint '"axios"'`) does **not** narrow the
GitHub search — GitHub treats a one-word quoted phrase exactly like the bare word. Quotes only
matter for multi-word phrases (`"feature flag"`) or when you need to search for the literal `"`
character itself, see below.
:::

::: warning API coverage
The GitHub Code Search API returns **at most 1,000 results** per query. The regex filter
is applied to those results; results beyond the API cap can never be seen. Refine the
query with qualifiers (`language:`, `path:`, `filename:`) to keep the result set small.
:::

## Searching for a literal quote character

GitHub's query syntax treats `"` as a phrase delimiter, not a literal character. To search for an actual quote character (for example to precisely match a `package.json` dependency line like `"react": "18.2.0"`), escape it for **both** your shell and GitHub:

```bash
github-code-search '"\"react\": \""' --org myorg
```

- The outer single quotes protect the whole argument from your shell.
- The `\"` sequences are GitHub's own escape syntax for a literal quote character inside an exact phrase.

If you instead pass raw, unescaped quotes, two things can happen:

- **An even number of quotes** (e.g. `"react": `) is valid GitHub syntax, but GitHub silently strips the quotes and treats the query as separate terms, so you get broader results than expected, not an error.
- **An odd number of quotes** (e.g. `"react": "`) is rejected by GitHub with an opaque `422 ERROR_TYPE_QUERY_PARSING_FATAL` error. `github-code-search` detects this locally and fails fast with an actionable message before ever calling the API:

```text
Error: Unbalanced double quotes in query: "\"react\": \"". GitHub rejects this with a query
parsing error. To search for a literal quote character, escape it for both your shell and
GitHub, e.g.: github-code-search '"\"react\": \""' --org myorg
```

::: warning Shell escaping consumes backslashes too
Typing `"\"react\": \""` directly (double-quoted at the shell level) does **not** work: your shell resolves `\"` to a literal `"` _before_ the CLI ever sees it, so the program receives the same unbalanced `"react": "` string as if you had typed no backslashes at all. Always wrap the whole argument in **single** quotes so the backslashes reach GitHub unchanged, as in the example above.
:::

## API limits

The GitHub Code Search API returns at most **1,000 results** per query. If your query returns more, refine it with qualifiers (especially `language:` or `path:`) to stay below the limit.

See the [GitHub API limits](/reference/github-api-limits) reference for details on rate limits and pagination.

## What's next?

Once you have results, use the [interactive mode](/usage/interactive-mode) to browse and select them, or the [non-interactive mode](/usage/non-interactive-mode) to pipe them into a script.
