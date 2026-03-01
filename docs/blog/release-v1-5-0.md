---
title: "What's new in v1.5.0"
description: "Advanced filter targets (content, path, repo), regex mode in the filter bar, word-jump shortcuts, and several TUI accuracy fixes."
date: 2026-03-01
---

# What's new in github-code-search v1.5.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.5.0>

## Highlights

### Advanced filter targets

The filter bar (press `f`) can now search across three different targets. Outside filter mode, press **`t`** to cycle targets; inside the filter bar, use **Shift+Tab**:

| Badge       | What is filtered                           |
| ----------- | ------------------------------------------ |
| `[path]`    | File path of each result (default)         |
| `[content]` | Code snippet text inside each extract      |
| `[repo]`    | Repository name (short or `org/repo` form) |

The active target badge is always visible in the filter bar, including in the default `[path]` mode, so you always know what you are filtering against.

### Regex mode

Press **Tab** while the filter bar is open to toggle regex mode. When active, the filter input is interpreted as a regular expression — the badge shows `[…·regex]` to make it obvious. Invalid patterns match nothing gracefully (zero visible rows, no crash).

### Word-jump shortcuts in the filter bar

Three equivalent key combinations now move the cursor one word at a time:

- **⌥←/→** (macOS Option+Arrow — the most natural shortcut on macOS terminals)
- **Ctrl+←/→** (common on Linux/Windows terminals)
- **Alt+b / Alt+f** (readline-style mnemonics)

**⌥⌫** (Option+Backspace) / **Ctrl+W** delete the word before the cursor, as before.

### Accurate scroll position

The viewport used by the scroll engine now accounts for the filter bar height (0–2 lines depending on the active filter mode and badge visibility). Previously, the static `termHeight − 6` estimate could cause the cursor to stop scrolling before it was actually visible. The fix ensures `isCursorVisible` uses exactly the same window as `renderGroups`.

### Search-match highlighting on the cursor extract row

When the cursor is positioned on an extract row, the file path now shows the search-match highlight (yellow on magenta background) — consistent with how the highlighted repo row already behaved.

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.5.0).
