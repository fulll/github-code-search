# Components (C4 L3)

This diagram zooms into the **pure-function core** — the modules that contain all
business logic with no side effects. Every component here is fully unit-tested and
takes in data structures defined in `src/types.ts`; none of them perform I/O.

The CLI parser (`github-code-search.ts`) and the TUI (`src/tui.ts`) call these
components after fetching raw data from the API.

```mermaid
C4Component
  title Components — pure-function core

  Container_Boundary(core, "Pure-function core") {
    Component(aggregate, "Filter & aggregation", "src/aggregate.ts", "applyFiltersAndExclusions() — applies --exclude-repositories and --exclude-extracts, normalises org-prefixed names")
    Component(group, "Team grouping", "src/group.ts", "groupByTeamPrefix() / flattenTeamSections() — groups RepoGroups by team prefix, falls back to flat list")
    Component(rows, "Row builder", "src/render/rows.ts", "buildRows() — converts RepoGroups into terminal Row[], computes visibility and cursor position")
    Component(summary, "Summary builder", "src/render/summary.ts", "buildSummary() / buildSummaryFull() / buildSelectionSummary() — header and footer lines rendered in the TUI")
    Component(filter, "Filter stats", "src/render/filter.ts", "buildFilterStats() — counts visible vs total rows for the status bar")
    Component(selection, "Selection helpers", "src/render/selection.ts", "applySelectAll() / applySelectNone() — bulk selection mutations on Row[]")
    Component(highlight, "Syntax highlighter", "src/render/highlight.ts", "highlight() — detects language from filename, applies token-level ANSI colouring")
    Component(outputFn, "Output formatter", "src/output.ts", "buildOutput() — serialises selected RepoGroup[] to markdown or JSON")
  }

  Container(tui, "TUI", "src/tui.ts", "Calls render components on every redraw")
  Container(cli, "CLI parser", "github-code-search.ts", "Calls aggregate + group, then TUI or output directly")

  Rel(cli, aggregate, "Filters raw CodeMatch[]")
  Rel(cli, group, "Groups into TeamSection[]")
  Rel(cli, outputFn, "Formats selection (non-interactive mode)")
  Rel(tui, rows, "Builds terminal rows")
  Rel(tui, summary, "Builds header / footer lines")
  Rel(tui, filter, "Builds filter status bar")
  Rel(tui, selection, "Applies select-all / none")
  Rel(tui, highlight, "Highlights code extracts")
  Rel(tui, outputFn, "Formats selection on Enter")
```

## Component descriptions

| Component                | Source file               | Key exports                                                                                                                                                                 |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Filter & aggregation** | `src/aggregate.ts`        | `applyFiltersAndExclusions()` — filters `CodeMatch[]` by repository and extract exclusion lists; normalises both `repoName` and `org/repoName` forms.                       |
| **Team grouping**        | `src/group.ts`            | `groupByTeamPrefix()` — groups `RepoGroup[]` into `TeamSection[]` keyed by team slug; `flattenTeamSections()` — converts back to a flat list for the TUI row builder.       |
| **Row builder**          | `src/render/rows.ts`      | `buildRows()` — converts `RepoGroup[]` into `Row[]` with expanded/collapsed state; `rowTerminalLines()` — measures wrapped height; `isCursorVisible()` — viewport clipping. |
| **Summary builder**      | `src/render/summary.ts`   | `buildSummary()` — compact header line; `buildSummaryFull()` — detailed counts; `buildSelectionSummary()` — "N files selected" footer.                                      |
| **Filter stats**         | `src/render/filter.ts`    | `buildFilterStats()` — produces the `FilterStats` object (visible count, total count, active filter string) used by the TUI status bar.                                     |
| **Selection helpers**    | `src/render/selection.ts` | `applySelectAll()` — marks all visible rows as selected; `applySelectNone()` — deselects all.                                                                               |
| **Syntax highlighter**   | `src/render/highlight.ts` | `highlight()` — maps file extension to a language token ruleset and applies ANSI escape sequences. Falls back to plain text for unknown extensions.                         |
| **Output formatter**     | `src/output.ts`           | `buildOutput()` — entry point for both `--format markdown` and `--output-type json` serialisation of the confirmed selection.                                               |

## Design principles

- **No I/O.** Every component in this layer is a pure function: given the same inputs it always returns the same outputs. This makes them straightforward to test with Bun's built-in test runner.
- **Single responsibility.** Each component owns exactly one concern (rows, summary, selection, …). The TUI composes them at render time rather than duplicating logic.
- **`types.ts` as the contract.** All components share the interfaces defined in `src/types.ts` (`TextMatchSegment`, `TextMatch`, `CodeMatch`, `RepoGroup`, `Row`, `TeamSection`, `OutputFormat`, `OutputType`). Changes to these types require updating all components.
- **`render.ts` as façade.** External consumers import from `src/render.ts`, which re-exports all symbols from the `src/render/` sub-modules plus the top-level `renderGroups()` and `renderHelpOverlay()` functions.
