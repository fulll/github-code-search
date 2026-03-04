---
title: "What's new in v1.8.0"
description: "Purple TUI theme, fetch progress bar, position indicator, line-anchored file links, and Esc to close help."
date: 2026-03-04
---

# What's new in github-code-search v1.8.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.8.0>

## Highlights

### Cohesive purple TUI theme

The interactive view has been completely re-skinned around a purple colour palette.

| Element                 | Before            | After                           |
| ----------------------- | ----------------- | ------------------------------- |
| Active row background   | Grey (`48;5;236`) | Dark purple (`48;5;53`)         |
| Active row left bar `▌` | None              | Saturated purple (`38;5;129`)   |
| Repo names              | Bold cyan         | Bright purple bold (`38;5;129`) |
| Match count badge       | Dim white         | Muted purple (`38;5;99`)        |

The left bar spans the full terminal width so the selected row is unmistakable even in long result lists.
Path and loc-suffix (`:line:col`) on the active extract row use **bold white** for visual consistency.

### Fetch progress bar

A progress bar is now displayed during the GitHub API search so you can track paged requests in real time:

```
Fetching results ████████████████░░░░░░░░  8/13 pages
```

The bar fills in saturated purple and shows the current page / estimated total pages.
It disappears automatically when all results are loaded.

### Position indicator

A persistent indicator at the bottom of the TUI shows your exact position within the result list:

```
  ↕ row 14 of 49
```

The number always reflects the **cursor position**, not the scroll offset, so it updates on every keypress — including when you navigate upward inside an already-scrolled viewport.

### Line-anchored file links (`o`)

When you press `o` on an **extract row**, the browser now opens the file at the **exact matched line** by appending a `#L{line}` anchor to the GitHub URL.

Before: `https://github.com/org/repo/blob/main/src/foo.ts`  
After: `https://github.com/org/repo/blob/main/src/foo.ts#L42`

On a **repo row**, `o` still opens the repository home page unchanged.

### Esc to close the help overlay

The help overlay (toggled with `h` or `?`) can now also be dismissed with `Esc`, matching the expected behaviour of most terminal UIs.

---

## Upgrade

```bash
github-code-search upgrade
```

Or grab the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.8.0).
