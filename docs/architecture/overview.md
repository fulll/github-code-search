# Level 1: System context

`github-code-search` is a self-contained command-line tool. It mediates between
a developer and the GitHub REST API: the developer types a query, the tool
searches GitHub on their behalf, displays an interactive result browser, and
prints structured output so downstream tooling can consume it.

The diagram below shows the two actors and the single external dependency.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Poppins, Aestetico, Arial, sans-serif", "primaryColor": "#66CCFF", "primaryTextColor": "#000000", "lineColor": "#0000CC", "tertiaryColor": "#FFCC33"}, "themeCSS": ".label,.nodeLabel,.cluster-label > span{font-family:Poppins,Arial,sans-serif;letter-spacing:.2px} .cluster-label > span{font-weight:600;font-size:13px} .edgePath .path{stroke-width:2px}"}}%%
C4Context
  title Level 1: github-code-search — System Context

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

  Person(user, "Developer", "Runs github-code-search<br/>from a terminal or CI pipeline")

  Enterprise_Boundary(fulll, "fulll") {
    System(cli, "github-code-search", "Interactive CLI — aggregates<br/>GitHub code search results,<br/>drives a TUI, outputs<br/>markdown or JSON")
  }

  System_Ext(github, "GitHub REST API", "Code search<br/>· org team listing<br/>· team repo listing")

  Rel(user, cli, "Runs query,<br/>navigates TUI", "stdin / stdout")
  UpdateRelStyle(user, cli, $offsetX="10", $offsetY="-55")

  Rel(cli, github, "Searches code,<br/>lists teams & repos", "HTTPS")
  UpdateRelStyle(cli, github, $offsetX="10", $offsetY="-30")

  UpdateElementStyle(user, $bgColor="#66CCFF", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(cli, $bgColor="#FFCC33", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(github, $bgColor="#FF9933", $borderColor="#0000CC", $fontColor="#000000")
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
