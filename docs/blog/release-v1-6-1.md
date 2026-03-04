---
title: "What's new in v1.6.1"
description: "Patch fix: the TUI now correctly renders all text fragments when a file contains multiple matches, not just the first one."
date: 2026-03-04
---

# What's new in github-code-search v1.6.1

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.6.1>

## Highlights

### Fix: all text fragments now displayed for multi-match files

When a file contained **multiple matches**, the TUI was only rendering the first text fragment and silently dropping the rest. This meant that in dense codebases where the same query matched several locations in a single file, only one extract was ever visible in the interactive view.

The root cause was an incorrect indexing assumption in the fragment rendering loop. The fix ensures every `TextMatch` fragment is iterated and rendered, regardless of how many matches exist in the same file.

**Before:** only the first fragment of each multi-match file was shown.  
**After:** all fragments are shown, consistent with the markdown/JSON output.

---

## Upgrade

```bash
github-code-search upgrade
```

Or download the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.6.1).
