---
title: "What's new in v1.7.0"
description: "Shell completions for bash, zsh and fish, plus extended syntax highlighting for PHP, C/C++, Swift, Terraform/HCL and Dockerfile."
date: 2026-03-04
---

# What's new in github-code-search v1.7.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.7.0>

## Highlights

### Shell completions — bash, zsh, fish

Tab-completion is now available for all three major shells. A new `completions` subcommand prints the appropriate script to stdout:

```bash
# bash
github-code-search completions --shell bash >> ~/.bashrc

# zsh  (place the script in a $fpath directory)
github-code-search completions --shell zsh > ~/.zfunc/_github-code-search

# fish
github-code-search completions --shell fish > ~/.config/fish/completions/github-code-search.fish
```

When `--shell` is omitted, the shell is auto-detected from `$SHELL`.

The completion scripts cover:

- All subcommands (`query`, `upgrade`, `completions`)
- All flags (`--org`, `--format`, `--output-type`, `--exclude-repositories`, `--exclude-extracts`, `--group-by-team-prefix`, `--no-interactive`, `--include-archived`, `--no-cache`, `--debug`)
- Enumerated flag values where applicable (`--format markdown|json`, `--output-type repo-and-matches|repo-only`)

#### Auto-refresh on upgrade

If you have installed completions, they are **refreshed automatically** every time you run `github-code-search upgrade`. No manual action needed — the completion file is overwritten in-place.

#### Install script

The `install.sh` script now calls `install_completions()` at the end of an installation, writing the completion file for the detected shell:

```bash
curl -sSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

### Extended syntax highlighting

Five new language profiles have been added to the TUI code viewer:

| Language          | Keywords → magenta                           | Special tokens → cyan                                                          |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| **PHP**           | `function`, `class`, `echo`, `foreach`…      | `$variables`, PascalCase types — `#[Attributes]` correctly NOT dimmed (PHP 8+) |
| **C / C++**       | `int`, `void`, `struct`, `class`, `nullptr`… | `#include`/`#define` directives                                                |
| **Swift**         | `var`, `let`, `func`, `guard`, `protocol`…   | PascalCase types                                                               |
| **Terraform/HCL** | `resource`, `variable`, `output`, `module`…  | Booleans / `null`                                                              |
| **Dockerfile**    | `FROM`, `RUN`, `CMD`, `COPY`, `EXPOSE`…      | `$ENV_VAR` / `${VAR}` references                                               |

Language detection is extension-based first (`Dockerfile.ts` is correctly identified as TypeScript, not Dockerfile). Filename-based Dockerfile detection is the fallback for files without a known extension.

12 new file extensions are now recognised: `.php`, `.phtml`, `.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx`, `.swift`, `.tf`, `.hcl`.

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.7.0).
