---
layout: home

hero:
  name: "github-code-search"
  text: "Search GitHub code across your org"
  tagline: Search up to 1,000 results across every repo. Group by team. Triage interactively. Export to Markdown or JSON.
  image:
    src: /logo.svg
    alt: ""
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

<InstallSection />

<HowItWorks />

<UseCaseTabs />

<ComparisonTable />

<ProductionCta />

<TestimonialsSection />
