# Environment variables

`github-code-search` reads the following environment variables at runtime.

## Reference

| Variable                       | Required | Default              | Description                                                                                                                                                        |
| ------------------------------ | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`                 | ✅       | —                    | GitHub personal access token. Used to authenticate API calls. See [Prerequisites](/getting-started/).                                                              |
| `GCS_DEFAULT_ORG`              | ❌       | —                    | Default value for `--org` when the flag is omitted. An explicit `--org` always takes precedence. See [CLI options](/reference/cli-options).                        |
| `CI`                           | ❌       | `false`              | Set to `true` to disable the interactive TUI and print results directly to stdout. Automatically set by GitHub Actions, GitLab CI, CircleCI and most CI platforms. |
| `GITHUB_CODE_SEARCH_CACHE_DIR` | ❌       | OS-dependent (below) | Override the directory used to cache the team list when `--group-by-team-prefix` is set.                                                                           |

## `GITHUB_TOKEN`

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

Add this to your shell profile (`~/.zshrc`, `~/.bashrc`, `~/.config/fish/config.fish`, …) to persist it across sessions. The required scopes depend on your use case:

| Scope         | When needed                                            |
| ------------- | ------------------------------------------------------ |
| `repo`        | Searching **private** repositories                     |
| `public_repo` | Searching public repositories only                     |
| `read:org`    | Using [`--group-by-team-prefix`](/usage/team-grouping) |

## `GCS_DEFAULT_ORG`

```bash
export GCS_DEFAULT_ORG=my-org
github-code-search "useFeatureFlag"   # --org my-org is implied
```

Useful when you mostly (or only) search a single organization — set it once in your shell profile and omit `--org` on every call. Passing `--org` explicitly always overrides it.

## `CI`

```bash
CI=true github-code-search "useFeatureFlag" --org fulll
```

Equivalent to passing `--no-interactive`. In GitHub Actions this variable is set automatically — no extra configuration needed.

## `GITHUB_CODE_SEARCH_CACHE_DIR`

Overrides the default OS cache directory used to store the team list (24 h TTL). Useful in restricted environments or when you want to share the cache across users.

```bash
GITHUB_CODE_SEARCH_CACHE_DIR=/tmp/gcs-cache \
  github-code-search "useFeatureFlag" --org fulll --group-by-team-prefix squad-
```

### Default cache locations

| OS      | Default path                                                            |
| ------- | ----------------------------------------------------------------------- |
| macOS   | `~/Library/Caches/github-code-search/`                                  |
| Linux   | `$XDG_CACHE_HOME/github-code-search/` or `~/.cache/github-code-search/` |
| Windows | `%LOCALAPPDATA%\github-code-search\`                                    |
