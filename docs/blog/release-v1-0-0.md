---
title: "What's new in v1.0.0"
description: "Initial public release of github-code-search — interactive TUI, per-repo aggregation, markdown/JSON output."
date: 2025-01-01
---

# What's new in github-code-search v1.0.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.0.0>

## The beginning

`github-code-search` is an interactive CLI for searching GitHub code across an entire organisation.
It wraps the [GitHub Code Search API](https://docs.github.com/en/rest/search/search#search-code)
and adds a keyboard-driven TUI on top, so you can browse results, fold/unfold extracts, and select
the ones you care about before printing structured output.

## Highlights

### Keyboard-driven TUI

Search results are loaded and displayed in an interactive terminal UI.
Navigate with <kbd>↑</kbd> / <kbd>↓</kbd>, fold/unfold extracts with <kbd>→</kbd> / <kbd>←</kbd>,
select results with <kbd>Space</kbd>, and confirm with <kbd>Enter</kbd>.
Press <kbd>?</kbd> to show the full keyboard shortcut reference.

→ [Interactive mode guide](/usage/interactive-mode)

### Per-repository aggregation

All code matches for the same repository are grouped together, with per-file headings.
No more scanning through a flat list of individual matches.

### Markdown and JSON output

Use `--format markdown` (default) for human-readable output, or `--format json` for
machine-readable output suitable for further processing.

Use `--output-type repo-only` to print only repository names (no code extracts).

→ [Output formats guide](/usage/output-formats)

### Filtering

Exclude noisy repositories with `--exclude-repositories` or specific extracts with
`--exclude-extracts`. Both flags accept short (`repoName`) and long (`org/repoName`) forms.

→ [Filtering guide](/usage/filtering)

### Team grouping

Group results by team prefix using `--group-by-team-prefix`. Results are arranged in sections
per team, making it easy to see which squads own the code that matches your search.

→ [Team grouping guide](/usage/team-grouping)

### Non-interactive / CI mode

Use `--no-interactive` (or set `CI=true`) to pipe output directly to downstream tools.
Syntax highlighting and TUI chrome are stripped so the output is clean.

→ [Non-interactive mode guide](/usage/non-interactive-mode)

### Built-in upgrade command

```bash
github-code-search upgrade
```

Checks for a newer binary on GitHub Releases and replaces the running binary in-place.
No package manager required.

→ [Upgrade guide](/usage/upgrade)
