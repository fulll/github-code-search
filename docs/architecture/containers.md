# Containers (C4 L2)

This diagram zooms into `github-code-search` to show its internal processes and
the boundaries between them. Each box represents one of the main source files and
its primary responsibility. Arrows show the call direction at runtime.

```mermaid
C4Container
  title Containers — github-code-search

  Person(user, "Developer", "Runs the CLI from a terminal or CI pipeline")
  System_Ext(github, "GitHub REST API", "/search/code · /orgs/{org}/teams · /orgs/{org}/teams/{slug}/repos")

  System_Boundary(tool, "github-code-search") {
    Container(cli, "CLI parser", "TypeScript / Commander", "Parses subcommands and flags, orchestrates the full flow — github-code-search.ts")
    Container(api, "API client", "TypeScript", "Authenticates with GitHub, paginates results, retries on rate limit — src/api.ts + src/api-utils.ts")
    Container(tui, "TUI", "TypeScript / raw TTY", "Reads keyboard input, renders the interactive result browser — src/tui.ts")
    Container(output, "Output renderer", "TypeScript", "Formats selected results as markdown or JSON — src/output.ts")
    Container(upgrade, "Upgrader", "TypeScript", "Fetches the latest release and replaces the running binary in-place — src/upgrade.ts")
    Container(cache, "Team cache", "TypeScript / disk", "Caches the org team list to avoid redundant API calls — src/cache.ts")
  }

  Rel(user, cli, "Invokes", "argv / stdin")
  Rel(cli, api, "Calls to search and list teams")
  Rel(api, github, "HTTPS")
  Rel(api, cache, "Reads/writes team list")
  Rel(cli, tui, "Renders if interactive")
  Rel(tui, output, "Triggers on confirm")
  Rel(output, user, "Prints to stdout")
  Rel(cli, upgrade, "Triggers on upgrade subcommand")
  Rel(upgrade, github, "Fetches latest release assets", "HTTPS")
```

## Container descriptions

| Container           | Source file(s)                    | Responsibility                                                                                                                                                                                                                     |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI parser**      | `github-code-search.ts`           | Entry point. Registers the `query` and `upgrade` Commander subcommands, resolves option defaults, and orchestrates the full search-display-output flow.                                                                            |
| **API client**      | `src/api.ts` · `src/api-utils.ts` | The only layer allowed to make network calls. Handles authentication, pagination (`paginatedFetch`), exponential-backoff retry (`fetchWithRetry`), and team/repository listing.                                                    |
| **TUI**             | `src/tui.ts`                      | The only layer allowed to read raw stdin and write directly to the TTY. Manages the keyboard event loop, cursor position, filter mode, help overlay, and selection state. Disabled when `CI=true` or `--no-interactive` is passed. |
| **Output renderer** | `src/output.ts`                   | Pure formatter. Converts the selected `RepoGroup[]` into a markdown document (`--format markdown`) or a JSON array (`--output-type json`). No I/O.                                                                                 |
| **Upgrader**        | `src/upgrade.ts`                  | Checks the latest GitHub release tag, downloads the matching binary asset, and atomically replaces the running executable.                                                                                                         |
| **Team cache**      | `src/cache.ts`                    | Persists the org team list to disk (`~/.cache/github-code-search/` on Linux, `~/Library/Caches/` on macOS) to avoid hitting the `read:org` rate limit on every run.                                                                |

## Data flow — interactive query

1. **CLI parser** receives `query` subcommand → calls **API client**.
2. **API client** queries `/search/code`, paginates, and returns `CodeMatch[]`.
3. **CLI parser** calls pure functions (`aggregate.ts`, `group.ts`) to filter and group results.
4. **TUI** receives `RepoGroup[]`, renders the browser, and waits for user input.
5. On `Enter`, **TUI** returns the selection → **CLI parser** calls **Output renderer**.
6. **Output renderer** prints markdown or JSON to stdout.
