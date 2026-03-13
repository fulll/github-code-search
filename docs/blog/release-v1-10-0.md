---
title: "What's new in v1.10.0"
description: "Native regex support — search with /pattern/flags syntax, automatic API term extraction, top-level alternation and --regex-hint override."
date: 2026-03-13
---

# What's new in github-code-search v1.10.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.10.0>

## Highlights

### Regex query syntax

`github-code-search` now supports **full regex queries** using the `/pattern/flags` notation
— the same syntax accepted by the GitHub web search UI.

```bash
# Any import of axios, regardless of quote style
github-code-search "/from.*['\"\`]axios/" --org my-org

# Axios pinned to any semver-prefix in package.json
github-code-search '/"axios": "[~^]?[0-9]"/ filename:package.json' --org my-org

# Legacy require() calls for a specific module
github-code-search "/require\\(['\"](old-lib)['\"]\\)/" --org my-org

# TODO, FIXME or HACK comments in one query
github-code-search "/TODO|FIXME|HACK/" --org my-org
```

Because the GitHub Code Search API does not support regex natively, the CLI automatically
extracts a representative literal term from the pattern to send to the API, then
**filters the returned results locally** with the full regex. In the vast majority of cases
this is entirely transparent.

### Automatic API term extraction

The extraction algorithm picks the **longest unambiguous literal sequence** from the regex:

- `/require\(['"]axios['"]\)/` → sends `require` to the API
- `/"version": "\d+\.\d+/` → sends `"version": "` to the API
- `/TODO|FIXME|HACK/` → sends `TODO OR FIXME OR HACK` (see below)

If no term of 3+ characters can be extracted, the CLI exits with a clear error and
instructs you to use `--regex-hint`.

### Top-level alternation — no results missed

When the regex pattern contains a **top-level `|`** (not nested inside `(...)` or `[...]`),
the CLI automatically builds an `A OR B OR C` GitHub query so that **every branch is covered**
by the API fetch — not just the first one.

```bash
# Sends: "TODO OR FIXME OR HACK" to the GitHub API
github-code-search "/TODO|FIXME|HACK/" --org my-org
```

### `--regex-hint` — manual API term override

For patterns where the auto-extracted term is too short or too broad, use `--regex-hint`
to specify exactly what the API should search for, while the **full regex is still applied
locally** to filter results:

```bash
github-code-search '/"axios":\s*"[~^]?[0-9]/ filename:package.json' \
  --org my-org \
  --regex-hint '"axios"'
```

`--regex-hint` is also recorded in the **replay command** included in the markdown output,
so the exact same result set can be reproduced without re-triggering the warning.

### Accurate match highlighting

In regex mode the TUI highlights the **actual regex match positions** inside each code
fragment — not the approximate positions returned by the GitHub API for the literal search
term. Match locations in the output (`:line:col` suffixes and `#L` GitHub anchors) reflect
the true match boundaries.

### Invalid regex is always a hard error

Malformed patterns (e.g. unclosed groups, bad escape sequences) are detected at startup
and produce a clear fatal error before any API call is made:

```text
⚠  Regex mode — Invalid regex /foo(/: Unterminated group
```

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.10.0).
