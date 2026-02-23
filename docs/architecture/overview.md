# System context (C4 L1)

`github-code-search` is a self-contained command-line tool. It mediates between
a developer and the GitHub REST API: the developer types a query, the tool
searches GitHub on their behalf, displays an interactive result browser, and
prints structured output so downstream tooling can consume it.

The diagram below shows the two actors and the single external dependency.

```mermaid
C4Context
  title System Context — github-code-search

  Person(user, "Developer", "Runs github-code-search from a terminal or CI pipeline")

  System(cli, "github-code-search", "Interactive CLI — aggregates GitHub code search results, drives a keyboard-navigable TUI, and outputs markdown or JSON")

  System_Ext(github, "GitHub REST API", "Code search endpoint (/search/code), organisation team listing (/orgs/{org}/teams) and team repository listing (/orgs/{org}/teams/{slug}/repos)")

  Rel(user, cli, "Runs query, navigates TUI, confirms selection", "stdin / stdout")
  Rel(cli, github, "Searches code, lists org teams and team repos", "HTTPS")
```

## Actors

| Actor               | Description                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Developer**       | The person (or CI job) that invokes the tool. Provides a `GITHUB_TOKEN` and a search query; receives markdown or JSON on stdout.                                                              |
| **GitHub REST API** | The only external system the tool communicates with. The tool uses three endpoints: code search, org team list, and team repo list. All calls are authenticated with a personal access token. |

## Authentication

The tool reads `GITHUB_TOKEN` from the environment. The required OAuth scopes vary by feature:

- **Basic search** — `public_repo` (public) or `repo` (private repos)
- **Team grouping** (`--group-by-team-prefix`) — additionally requires `read:org`

See the [Environment variables](/reference/environment) reference for the full scope table.
