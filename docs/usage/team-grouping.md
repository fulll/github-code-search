# Team grouping

`--group-by-team-prefix` organises result repositories by their GitHub team membership. It is especially useful in large organisations with multiple squads or chapters.

## Prerequisites

Fetching team membership requires the **`read:org`** (or `admin:org`) scope on your GitHub token, in addition to `repo` / `public_repo`.

See [Prerequisites](/getting-started/) for how to set up your token.

## Basic usage

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-
```

Pass one or more **comma-separated prefixes**. The tool fetches all org teams whose names start with any of the given prefixes, then groups repositories accordingly.

```bash
# Multiple prefixes
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-,chapter-
```

## Grouping algorithm

The grouping is applied sequentially, one prefix at a time:

1. **First prefix** (`squad-`)
   - Repos belonging to **exactly 1** matching team → one section per team, sorted alphabetically.
   - Repos belonging to **2** matching teams → one section per combination, sorted alphabetically.
   - Repos belonging to **3+** matching teams → same, in ascending combination-size order.
2. **Next prefix** (`chapter-`) — applied to repos **not yet assigned** in the previous step.
3. Repos matching **no prefix** → collected into an `other` section at the end.

## Non-interactive output

```text
4 repos · 5 files · 6 matches selected

## squad-backend

- **fulll/billing-api** (3 matches)
  - [ ] [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)

## squad-frontend

- **fulll/auth-service** (2 matches)
  - [ ] [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)

## squad-frontend + squad-mobile

- **fulll/frontend-app** (1 match)
  - [ ] [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)

## other

- **fulll/legacy-monolith** (1 match)
  - [ ] [src/legacy.js:5:1](https://github.com/fulll/legacy-monolith/blob/main/src/legacy.js#L5)
```

## Interactive mode with sections

In the TUI, team sections appear as separator lines between repository rows:

```text
── squad-frontend
▶ ◉  fulll/auth-service  (2 matches)
── squad-mobile
▶ ◉  fulll/frontend-app  (1 match)
── other
▶ ◉  fulll/legacy-monolith  (1 match)
```

Navigation (`↑` / `↓`) automatically skips section header rows.

## Team list cache

To avoid repeating dozens of API calls on every run, `github-code-search` caches the team list on disk for **24 hours**.

### Cache location

| OS      | Path                                                                    |
| ------- | ----------------------------------------------------------------------- |
| macOS   | `~/Library/Caches/github-code-search/`                                  |
| Linux   | `$XDG_CACHE_HOME/github-code-search/` or `~/.cache/github-code-search/` |
| Windows | `%LOCALAPPDATA%\github-code-search\`                                    |

Override the cache directory with the `GITHUB_CODE_SEARCH_CACHE_DIR` environment variable.

### Bypass the cache

Pass `--no-cache` to force a fresh fetch:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad- --no-cache
```

### Purge the cache

```bash
# macOS
rm -rf ~/Library/Caches/github-code-search

# Linux
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/github-code-search"
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\github-code-search"
```
