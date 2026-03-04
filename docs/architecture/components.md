# Level 3: Components

The pure-function core is split into two focused diagrams: the **CLI data pipeline**
(filter → group → format) and the **TUI render layer** (all display components).
Every component is side-effect-free and fully unit-tested.

## 3a — CLI data pipeline

The three pure functions called by the CLI parser to transform raw API results
into a filtered, grouped, formatted output.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Poppins, Aestetico, Arial, sans-serif", "primaryColor": "#66CCFF", "primaryTextColor": "#000000", "lineColor": "#0000CC", "tertiaryColor": "#FFCC33"}, "themeCSS": ".label,.nodeLabel,.cluster-label > span{font-family:Poppins,Arial,sans-serif;letter-spacing:.2px} .cluster-label > span{font-weight:600;font-size:13px} .edgePath .path{stroke-width:2px}"}}%%
C4Component
  title Level 3a: CLI data pipeline

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")

  Container(cli, "CLI parser", "github-code-search.ts", "Orchestrates filter,<br/>group, output and<br/>shell completions")

  Container_Boundary(core, "Pure-function core — no I/O") {
    Component(aggregate, "Filter & aggregation", "src/aggregate.ts", "aggregate()<br/>exclude repos & extracts")
    Component(group, "Team grouping", "src/group.ts", "groupByTeamPrefix()<br/>flattenTeamSections()")
    Component(outputFn, "Output formatter", "src/output.ts", "buildOutput()<br/>markdown or JSON")
    Component(completions, "Shell completions", "src/completions.ts", "generateCompletion()<br/>detectShell()<br/>getCompletionFilePath()")
  }

  Rel(cli, aggregate, "Filter<br/>CodeMatch[]")
  UpdateRelStyle(cli, aggregate, $offsetX="0", $offsetY="-17")

  Rel(cli, group, "Group into<br/>TeamSection[]")
  UpdateRelStyle(cli, group, $offsetX="-33", $offsetY="-17")

  Rel(cli, outputFn, "Format<br/>(non-interactive)")
  UpdateRelStyle(cli, outputFn, $offsetX="-60", $offsetY="-17")

  Rel(cli, completions, "Generate<br/>script")
  UpdateRelStyle(cli, completions, $offsetX="-90", $offsetY="-17")

  UpdateElementStyle(cli, $bgColor="#FFCC33", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(aggregate, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(group, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(outputFn, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(completions, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
```

## 3b — TUI render layer

The render-layer modules called by the TUI on every redraw. Most live in
`src/render/` and are re-exported through the `src/render.ts` façade;
`src/output.ts` is the output formatter invoked on confirmation and `src/render/filter-match.ts`
provides shared pattern-matching helpers used by several render modules.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "Poppins, Aestetico, Arial, sans-serif", "primaryColor": "#66CCFF", "primaryTextColor": "#000000", "lineColor": "#0000CC", "tertiaryColor": "#FFCC33"}, "themeCSS": ".label,.nodeLabel,.cluster-label > span{font-family:Poppins,Arial,sans-serif;letter-spacing:.2px} .cluster-label > span{font-weight:600;font-size:13px} .edgePath .path{stroke-width:2px}"}}%%
C4Component
  title Level 3b: TUI render layer

  UpdateLayoutConfig($c4ShapeInRow="5", $c4BoundaryInRow="1")

  Container(tui, "TUI", "src/tui.ts", "Calls render functions<br/>on every redraw;<br/>formats output on Enter")

  Container_Boundary(render, "src/render/ — pure functions") {
    Component(rows, "Row builder", "src/render/rows.ts", "buildRows()<br/>rowTerminalLines()<br/>isCursorVisible()")
    Component(summary, "Summary builder", "src/render/summary.ts", "buildSummary()<br/>buildSummaryFull()<br/>buildSelectionSummary()")
    Component(filter, "Filter stats", "src/render/filter.ts", "buildFilterStats()<br/>FilterStats — visible/hidden counts")
    Component(selection, "Selection helpers", "src/render/selection.ts", "applySelectAll()<br/>applySelectNone()")
    Component(highlight, "Syntax highlighter", "src/render/highlight.ts", "highlightFragment()<br/>ANSI token colouring")
    Component(outputFn, "Output formatter", "src/output.ts", "buildOutput()<br/>markdown or JSON")
    Component(filterMatch, "Pattern matchers", "src/render/filter-match.ts", "makeExtractMatcher()<br/>makeRepoMatcher()")
  }

  Rel(tui, rows, "Build terminal<br/>rows")
  UpdateRelStyle(tui, rows, $offsetX="-1", $offsetY="-15")

  Rel(tui, summary, "Build header <br>/ footer")
  UpdateRelStyle(tui, summary, $offsetX="-44", $offsetY="-16")

  Rel(tui, filter, "Build<br/>status bar")
  UpdateRelStyle(tui, filter, $offsetX="-64", $offsetY="-16")

  Rel(tui, selection, "Select all<br/>/ none")
  UpdateRelStyle(tui, selection, $offsetX="-105", $offsetY="-12")

  Rel(tui, highlight, "Highlight<br/>extracts")
  UpdateRelStyle(tui, highlight, $offsetX="-150", $offsetY="-16")

  Rel(tui, outputFn, "Format<br/>on Enter")
  UpdateRelStyle(tui, outputFn, $offsetX="17", $offsetY="160")

  Rel(rows, filterMatch, "Uses pattern<br/>matchers")
  UpdateRelStyle(rows, filterMatch, $offsetX="-5", $offsetY="-5")

  Rel(filter, filterMatch, "Uses pattern<br/>matchers")
  UpdateRelStyle(filter, filterMatch, $offsetX="45", $offsetY="-5")

  Rel(selection, filterMatch, "Uses pattern<br/>matchers")
  UpdateRelStyle(selection, filterMatch, $offsetX="165", $offsetY="-25")

  UpdateElementStyle(tui, $bgColor="#FFCC33", $borderColor="#0000CC", $fontColor="#000000")
  UpdateElementStyle(rows, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(filterMatch, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(summary, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(filter, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(selection, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(highlight, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
  UpdateElementStyle(outputFn, $bgColor="#9933FF", $borderColor="#0000CC", $fontColor="#ffffff")
```

## Component descriptions

| Component                | Source file                  | Key exports                                                                                                                                                                                         |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filter & aggregation** | `src/aggregate.ts`           | `aggregate()` — filters `CodeMatch[]` by repository and extract exclusion lists; normalises both `repoName` and `org/repoName` forms.                                                               |
| **Team grouping**        | `src/group.ts`               | `groupByTeamPrefix()` — groups `RepoGroup[]` into `TeamSection[]` keyed by team slug; `flattenTeamSections()` — converts back to a flat list for the TUI row builder.                               |
| **Shell completions**    | `src/completions.ts`         | `generateCompletion(shell)` — returns the full bash/zsh/fish completion script; `detectShell()` — reads `$SHELL`; `getCompletionFilePath(shell, opts)` — resolves the XDG-aware installation path.  |
| **Row builder**          | `src/render/rows.ts`         | `buildRows()` — converts `RepoGroup[]` into `Row[]` filtered by the active target (path / content / repo); `rowTerminalLines()` — measures wrapped height; `isCursorVisible()` — viewport clipping. |
| **Summary builder**      | `src/render/summary.ts`      | `buildSummary()` — compact header line; `buildSummaryFull()` — detailed counts; `buildSelectionSummary()` — "N files selected" footer.                                                              |
| **Filter stats**         | `src/render/filter.ts`       | `buildFilterStats()` — produces the `FilterStats` object (visible repos, files, matches) used by the TUI filter bar live counter.                                                                   |
| **Pattern matchers**     | `src/render/filter-match.ts` | `makeExtractMatcher()` — builds a case-insensitive substring or RegExp test function for path or content targets; `makeRepoMatcher()` — wraps the same logic for repo-name matching.                |
| **Selection helpers**    | `src/render/selection.ts`    | `applySelectAll()` — marks all visible rows as selected (respects filter target); `applySelectNone()` — deselects all visible rows.                                                                 |
| **Syntax highlighter**   | `src/render/highlight.ts`    | `highlightFragment()` — maps file extension to a language token ruleset and applies ANSI escape sequences. Falls back to plain text for unknown extensions.                                         |
| **Output formatter**     | `src/output.ts`              | `buildOutput()` — entry point for both `--format markdown` and `--format json` serialisation of the confirmed selection.                                                                            |

## Design principles

- **No I/O.** Every component in this layer is a pure function: given the same inputs it always returns the same outputs. This makes them straightforward to test with Bun's built-in test runner.
- **Single responsibility.** Each component owns exactly one concern (rows, summary, selection, …). The TUI composes them at render time rather than duplicating logic.
- **`types.ts` as the contract.** All components share the interfaces defined in `src/types.ts` (`TextMatchSegment`, `TextMatch`, `CodeMatch`, `RepoGroup`, `Row`, `TeamSection`, `OutputFormat`, `OutputType`, `FilterTarget`). Changes to these types require updating all components.
- **`render.ts` as façade.** External consumers import from `src/render.ts`, which re-exports all symbols from the `src/render/` sub-modules plus the top-level `renderGroups()` and `renderHelpOverlay()` functions.
