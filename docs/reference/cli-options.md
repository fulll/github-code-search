# CLI options

## Commands

```bash
github-code-search [query] --org <org> [options]   # default (backward-compatible)
github-code-search query <query> --org <org> [options]
github-code-search upgrade
```

| Command                     | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `<query>` / `query <query>` | Search GitHub code (default command)                |
| `upgrade`                   | Check for a new release and auto-upgrade the binary |

## Search options

| Option                              | Type                              | Required | Default            | Description                                                                                                                      |
| ----------------------------------- | --------------------------------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `--org <org>`                       | string                            | ✅       | —                  | GitHub organization to search in. Automatically injected as `org:<org>` in the query.                                            |
| `--exclude-repositories <repos>`    | string                            | ❌       | `""`               | Comma-separated list of repositories to exclude. Short form (`repoA,repoB`) or full form (`org/repoA,org/repoB`) both accepted.  |
| `--exclude-extracts <refs>`         | string                            | ❌       | `""`               | Comma-separated extract refs to exclude. Format: `repoName:path/to/file:index`. Short form (without org prefix) accepted.        |
| `--no-interactive`                  | boolean (flag)                    | ❌       | `false`            | Disable interactive mode. Also triggered automatically when `CI=true`.                                                           |
| `--format <format>`                 | `markdown` \| `json`              | ❌       | `markdown`         | Output format. See [Output formats](/usage/output-formats).                                                                      |
| `--output-type <type>`              | `repo-and-matches` \| `repo-only` | ❌       | `repo-and-matches` | Controls output detail level. `repo-only` lists repository names only, without individual extracts.                              |
| `--include-archived`                | boolean (flag)                    | ❌       | `false`            | Include archived repositories in results (excluded by default).                                                                  |
| `--group-by-team-prefix <prefixes>` | string                            | ❌       | `""`               | Comma-separated team-name prefixes for grouping result repos by GitHub team (e.g. `squad-,chapter-`). Requires `read:org` scope. |
| `--no-cache`                        | boolean (flag)                    | ❌       | `false`            | Bypass the 24 h team-list cache and re-fetch teams from GitHub. Only applies when `--group-by-team-prefix` is set.               |

## Global options

| Option            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `-V`, `--version` | Output version, git commit SHA, OS and architecture |
| `-h`, `--help`    | Display help                                        |

## Notes

- `--no-interactive` and `CI=true` are equivalent — either one disables the TUI.
- The `--exclude-repositories` and `--exclude-extracts` options accept both the short form (without org prefix) and the full `org/repo` form.
- `--no-cache` has no effect unless `--group-by-team-prefix` is also set.
- The `upgrade` subcommand does not require `--org` or `GITHUB_TOKEN` (token is used only if already set, to avoid rate limiting).
