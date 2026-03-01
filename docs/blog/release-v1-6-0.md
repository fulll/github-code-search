---
title: "What's new in v1.6.0"
description: "Power navigation shortcuts: global fold/unfold, Vim-style gg/G top/bottom jumps, paged scrolling with Page Up/Down and Ctrl+U/D, and open-in-browser for any result."
date: 2026-03-02
---

# What's new in github-code-search v1.6.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.6.0>

## Highlights

### Global fold / unfold — `Z`

Press **`Z`** to collapse every repository in one keystroke. Press `Z` again to expand them all at once.

The logic is straightforward:

- If at least one repo is currently expanded, `Z` folds everything.
- If every repo is already folded, `Z` unfolds everything.

The cursor tracks the repository it was positioned on before the fold, so you never lose your place in the list.

### Vim-style top / bottom navigation — `gg` and `G`

| Shortcut | Action                       |
| -------- | ---------------------------- |
| `gg`     | Jump to the **first** result |
| `G`      | Jump to the **last** result  |

`gg` triggers on two consecutive `g` keypresses. Both shortcuts skip over section headers produced by `--group-by-team-prefix`, landing only on repo or extract rows.

### Paged scrolling — `Page Up`/`Page Down` and `Ctrl+U`/`Ctrl+D`

Scroll through large result sets without holding an arrow key:

| Shortcut               | Action               |
| ---------------------- | -------------------- |
| `Page Up` / `Ctrl+U`   | Scroll up one page   |
| `Page Down` / `Ctrl+D` | Scroll down one page |

Page size is computed from the actual terminal height, so the jump covers exactly what is visible on screen.

### Open-in-browser — `o`

Press **`o`** on any focused row to open the corresponding page directly in your default browser — no copy-paste required.

| Row type    | Opens                            |
| ----------- | -------------------------------- |
| Repo row    | The GitHub repository page       |
| Extract row | The exact file in the repository |

Works on macOS (`open`), Linux (`xdg-open`), and Windows (`cmd /c start`).

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.6.0).
