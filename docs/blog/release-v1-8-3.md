---
title: "What's new in v1.8.3"
description: "Fix TUI layout: header/footer anchoring, viewport packing and narrow-terminal rendering"
date: 2026-03-09
---

# What's new in github-code-search v1.8.3

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.8.3>

## Highlights

### Fix: header no longer scrolls off screen

In previous versions, scrolling down fast could push the `github-code-search`
title bar and the column headers (`PATH`, `MATCH`) out of the visible area,
leaving the TUI without any reference point. The header row is now anchored to
the top of the viewport regardless of scroll offset.

### Fix: footer always visible at the bottom

The keyboard-shortcut bar at the bottom of the TUI could float up into the
results area when the result list was shorter than the terminal height.  
The viewport now fills any remaining vertical space with blank lines before
rendering the footer, keeping it pinned to the last row.

### Fix: correct rendering on narrow terminals (Unicode / emoji clipping)

The `clipAnsi` helper that truncates long lines to fit the terminal width was
splitting multi-byte UTF-8 sequences such as emoji (e.g. `🔍`) at a raw byte
boundary, producing garbled output or invisible characters on narrow terminals.  
The helper now advances by full Unicode code points (`codePointAt`) and only
clips between complete characters.

---

## Other improvements

- **Title badge contrast** — the `github-code-search` badge in the header now
  renders in black on magenta instead of a low-contrast colour combination,
  making it readable on all common terminal themes.
- **Viewport packing** — `normalizeScrollOffset` prevents the scroll position
  from drifting past the last result, ensuring the bottom of the list always
  fills the screen.

---

## Upgrade

```sh
github-code-search upgrade
```

Or download the latest binary from
[GitHub Releases](https://github.com/fulll/github-code-search/releases/tag/v1.8.3).
