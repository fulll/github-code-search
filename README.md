# github-code-search

<img src="docs/public/logo.svg" alt="github-code-search logo" width="80" align="right">

[![Docs](https://img.shields.io/badge/docs-fulll.github.io%2Fgithub--code--search-blue)](https://fulll.github.io/github-code-search/)
[![Latest release](https://img.shields.io/github/v/release/fulll/github-code-search)](https://github.com/fulll/github-code-search/releases/latest)

Interactive CLI to search GitHub code across an organization — per-repository aggregation,
keyboard-driven TUI, fine-grained extract selection, markdown/JSON output.

→ **Full documentation: https://fulll.github.io/github-code-search/**

## Quick start

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
github-code-search query "TODO" --org my-org
```
