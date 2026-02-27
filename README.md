# github-code-search

<img src="docs/public/logo.svg" alt="github-code-search logo" width="80" align="right">

[![Docs](https://img.shields.io/badge/docs-fulll.github.io%2Fgithub--code--search-blue)](https://fulll.github.io/github-code-search/)
[![Latest release](https://img.shields.io/github/v/release/fulll/github-code-search)](https://github.com/fulll/github-code-search/releases/latest)

Interactive CLI to search GitHub code across an organization — per-repository aggregation,
keyboard-driven TUI, fine-grained extract selection, markdown/JSON output.

→ **Full documentation: https://fulll.github.io/github-code-search/**

![Demo](demo/demo.gif)

## Quick start

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
github-code-search query "TODO" --org my-org
```

## Features

- **Org-wide search** — queries all repositories in a GitHub organization in one command, with automatic pagination up to 1 000 results
- **Per-repository aggregation** — results grouped by repo, not as a flat list; fold/unfold each repo to focus on what matters
- **Keyboard-driven TUI** — navigate with arrow keys, toggle selections, filter by file path, confirm with Enter — without leaving the terminal
- **Fine-grained selection** — pick exactly the repos and extracts you want; deselected items are recorded as exclusions in the replay command
- **Structured output** — clean Markdown lists with GitHub links, or machine-readable JSON — ready to paste into docs, issues or scripts
- **Team-prefix grouping** — group results by team prefix (e.g. `platform/`, `data/`) using `--group-by-team-prefix`
- **Replay command** — every session produces a one-liner you can run in CI to reproduce the exact same selection without the UI
- **Syntax highlighting** — code fragments rendered with language-aware coloring (TypeScript, Python, Go, Rust, YAML, JSON and more)

## Use cases

**Audit a dependency across the org**

```bash
github-code-search query "from 'lodash'" --org my-org
```

Instantly see every repo still importing lodash, select the ones to migrate, and get a Markdown checklist to paste in your migration issue.

**Hunt down TODOs before a release**

```bash
github-code-search query "TODO" --org my-org --exclude-repositories sandbox,archived-repo
```

Surfaces all in-code TODOs, lets you triage interactively, and outputs a linked list for your release notes.

**Verify a breaking-change rollout**

```bash
github-code-search query "oldApiClient" --org my-org --output-type repo-only --format json
```

Use JSON output in a CI script to assert that no repository still references the deprecated client after your migration deadline.

**Security sweep — find hardcoded secret patterns**

```bash
github-code-search query "process.env.SECRET" --org my-org
```

Cross-repo scan for risky patterns; export results to Markdown to attach to a security audit report.

**Onboarding — understand how an internal library is used**

```bash
github-code-search query "useFeatureFlag" --org my-org --group-by-team-prefix platform/
```

Get a team-scoped view of every usage site before refactoring a shared hook or utility.

## Why not `gh search code`?

The official [`gh` CLI](https://cli.github.com/) does support `gh search code`, but it returns a **flat paginated list** — one result per line, no grouping, no interactive selection, no structured output.

|                                            | `gh search code` | `github-code-search` |
| ------------------------------------------ | :--------------: | :------------------: |
| Results grouped by repo                    |        ✗         |          ✓           |
| Interactive TUI (navigate, select, filter) |        ✗         |          ✓           |
| Fine-grained extract selection             |        ✗         |          ✓           |
| Markdown / JSON output                     |        ✗         |          ✓           |
| Replay / CI command                        |        ✗         |          ✓           |
| Team-prefix grouping                       |        ✗         |          ✓           |
| Syntax highlighting in terminal            |        ✗         |          ✓           |
| Pagination (up to 1 000 results)           |        ✓         |          ✓           |

`github-code-search` is purpose-built for **org-wide code audits and interactive triage** — not just a search wrapper.
