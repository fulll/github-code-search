# Level 2: Containers

The containers are split across two focused diagrams to keep relations readable.
Each arrow has a single, clear crossing-free path.

## 2a — Search & API layer

How the CLI fetches data: invocation → search → cache → GitHub.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Poppins, Aestetico, Arial, sans-serif", "primaryColor": "#66CCFF", "primaryTextColor": "#000000", "lineColor": "#0000CC", "tertiaryColor": "#FFCC33"}, "themeCSS": ".label,.nodeLabel,.cluster-label > span{font-family:Poppins,Arial,sans-serif;letter-spacing:.2px} .cluster-label > span{font-weight:600;font-size:13px} .edgePath .path{stroke-width:2px}"}}%%
C4Container
  title Level 2a: Search & API layer

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

  Person(user, "Developer", "Runs the CLI from<br/>a terminal or CI pipeline")
  System_Ext(github, "GitHub REST API", "/search/code<br/>/orgs/{org}/teams<br/>/orgs/{org}/teams/{slug}/repos")

  System_Boundary(tool, "github-code-search") {
    Container(cli, "CLI parser", "TypeScript / Commander", "Parses subcommands & flags,<br/>orchestrates the full flow<br/>github-code-search.ts")
    Container(api, "API client", "TypeScript", "Auth, pagination, retry<br/>src/api.ts + api-utils.ts")
    Container(cache, "Team cache", "TypeScript / disk", "Caches org team list<br/>src/cache.ts")
  }

  Rel(user, cli, "Invokes", "argv / stdin")
  UpdateRelStyle(user, cli, $offsetX="15", $offsetY="-45")

  Rel(cli, api, "Search &<br/>team listing")
  UpdateRelStyle(cli, api, $offsetX="-35", $offsetY="-25")

  Rel(api, github, "REST calls", "HTTPS")
  UpdateRelStyle(api, github, $offsetX="10", $offsetY="-35")

  Rel(api, cache, "Read / write<br/>team list")
  UpdateRelStyle(api, cache, $offsetX="-30", $offsetY="-25")

  UpdateElementStyle(user, $bgColor="#66CCFF", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(cli, $bgColor="#FFCC33", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(api, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(cache, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(github, $bgColor="#FF9933", $borderColor="#0000CC", $fontColor="#000000")
```

## 2b — Display & output layer

How the CLI drives the TUI for interactive use, produces output, and self-upgrades.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Poppins, Aestetico, Arial, sans-serif", "primaryColor": "#66CCFF", "primaryTextColor": "#000000", "lineColor": "#0000CC", "tertiaryColor": "#FFCC33"}, "themeCSS": ".label,.nodeLabel,.cluster-label > span{font-family:Poppins,Arial,sans-serif;letter-spacing:.2px} .cluster-label > span{font-weight:600;font-size:13px} .edgePath .path{stroke-width:2px}"}}%%
C4Container
  title Level 2b: Display & output layer

  UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")

  Person(user, "Developer", "Reads results<br/>on stdout")
  System_Ext(github, "GitHub REST API", "Releases endpoint<br/>/repos/{owner}/{repo}/releases")

  System_Boundary(tool, "github-code-search") {
    Container(output, "Output renderer", "TypeScript", "Markdown & JSON<br/>formatter — src/output.ts")
    Container(upgrade, "Upgrader", "TypeScript", "Self-replace binary<br/>src/upgrade.ts")
    Container(tui, "TUI", "TypeScript / raw TTY", "Keyboard input,<br/>interactive result browser<br/>src/tui.ts")
    Container(cli, "CLI parser", "TypeScript / Commander", "Orchestrates all flows<br/>github-code-search.ts")
  }

  Rel(user, cli, "Invokes", "argv / stdin")
  UpdateRelStyle(user, cli, $offsetX="-68", $offsetY="-145")

  Rel(cli, upgrade, "upgrade<br/>subcommand")
  UpdateRelStyle(cli, upgrade, $offsetX="10", $offsetY="-5")

  Rel(upgrade, github, "Fetch<br/>latest release", "HTTPS")
  UpdateRelStyle(upgrade, github, $offsetX="10", $offsetY="-35")

  Rel(cli, tui, "Renders if<br/>interactive")
  UpdateRelStyle(cli, tui, $offsetX="-25", $offsetY="-25")

  Rel(tui, output, "Triggers<br/>on confirm")
  UpdateRelStyle(tui, output, $offsetX="10", $offsetY="-5")

  Rel(output, user, "Prints to<br/> stdout")
  UpdateRelStyle(output, user, $offsetX="4", $offsetY="-20")

  UpdateElementStyle(user, $bgColor="#66CCFF", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(cli, $bgColor="#FFCC33", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(upgrade, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(tui, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(output, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(github, $bgColor="#FF9933", $borderColor="#0000CC", $fontColor="#000000")
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
