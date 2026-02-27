---
layout: home

hero:
  name: "github-code-search"
  text: "Search GitHub code across your org"
  tagline: Per-repository aggregation · Keyboard-driven TUI · Markdown & JSON output
  image:
    src: /logo.svg
    alt: github-code-search
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/fulll/github-code-search

features:
  - icon:
      src: /icons/search.svg
    title: Org-wide code search
    details: Search across all repositories in a GitHub organisation in a single command. Results are paginated automatically — up to 1,000 items.
  - icon:
      src: /icons/layers.svg
    title: Per-repository aggregation
    details: Results are grouped by repository, not shown as a flat list. Fold or unfold each repo to focus on what matters.
  - icon:
      src: /icons/terminal.svg
    title: Keyboard-driven TUI
    details: Navigate with arrow keys, select individual extracts, filter by file path, and confirm with Enter — all without leaving the terminal.
  - icon:
      src: /icons/target.svg
    title: Fine-grained selection
    details: Pick exactly the repos and code extracts you want. Deselected items are recorded as exclusions in the replay command.
  - icon:
      src: /icons/file-code.svg
    title: Structured output
    details: Get clean Markdown lists with GitHub links, or machine-readable JSON — ready to paste into docs, issues or scripts.
  - icon:
      src: /icons/replay.svg
    title: Replay command
    details: Every interactive session produces a one-liner you can run in CI to reproduce the exact same selection without the UI.
---

## Use cases

**Audit a dependency across the org**

```bash
github-code-search query "from 'lodash'" --org my-org
```

See every repo still importing lodash, select the ones to migrate, and get a Markdown checklist to paste in your migration issue.

---

**Hunt down TODOs before a release**

```bash
github-code-search query "TODO" --org my-org --exclude-repositories sandbox,archived-repo
```

Surface all in-code TODOs, triage interactively, and output a linked list for your release notes.

---

**Verify a breaking-change rollout**

```bash
github-code-search query "oldApiClient" --org my-org --output-type repo-only --format json
```

Use JSON output in a CI script to assert that no repository still references a deprecated client after your migration deadline.

---

**Security sweep — find hardcoded secret patterns**

```bash
github-code-search query "process.env.SECRET" --org my-org
```

Cross-repo scan for risky patterns; export results to Markdown to attach to a security audit report.

---

**Onboarding — understand how an internal library is used**

```bash
github-code-search query "useFeatureFlag" --org my-org --group-by-team-prefix platform/
```

Get a team-scoped view of every usage site before refactoring a shared hook or utility.

## Why not `gh search code`?

The official [`gh` CLI](https://cli.github.com/) supports `gh search code`, but returns a **flat paginated list** — one result per line, no grouping, no interactive selection, no structured output.

|                                            | `gh search code` | `github-code-search` |
| ------------------------------------------ | :--------------: | :------------------: |
| Results grouped by repo                    | ✗                | ✓                    |
| Interactive TUI (navigate, select, filter) | ✗                | ✓                    |
| Fine-grained extract selection             | ✗                | ✓                    |
| Markdown / JSON output                     | ✗                | ✓                    |
| Replay / CI command                        | ✗                | ✓                    |
| Team-prefix grouping                       | ✗                | ✓                    |
| Syntax highlighting in terminal            | ✗                | ✓                    |
| Pagination (up to 1 000 results)           | ✓                | ✓                    |

`github-code-search` is purpose-built for **org-wide code audits and interactive triage** — not just a search wrapper.

## Used in production?

Using `github-code-search` at your organisation? Share your experience, use cases or feedback in [GitHub Discussions](https://github.com/fulll/github-code-search/discussions) — your input shapes the roadmap.
