---
title: "What's new in v1.8.1"
description: "Bug fix: the CLI no longer hangs silently for up to 2 minutes after the pagination bar, especially on slow or mobile networks."
date: 2026-03-09
---

# What's new in github-code-search v1.8.1

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.8.1>

## Highlights

### Fix: silent hang after pagination bar on slow networks

After the `Fetching results from GitHub…` progress bar completed, the CLI could
freeze silently for **up to 2 minutes** before the interactive TUI appeared.
No spinner, no message — the terminal looked stuck. The hang was consistently
worse on tethering or congested networks and could sometimes be resolved by
re-running on a better connection.

#### Root cause

The GitHub Code Search API returns only fragment-relative character indices —
there are no absolute line numbers in the response. To display accurate line
numbers in the TUI, `github-code-search` fetches the raw content of each
matched file from `raw.githubusercontent.com` after pagination completes.

Two compounding issues caused the hang:

1. **No concurrency limit.** With 200+ unique files in the results, 200+
   HTTP requests fired simultaneously via `Promise.all`. On a saturated
   network this overwhelmed the connection pool and caused the event loop
   to stall.

2. **No progress feedback.** The user saw nothing between the end of the
   pagination bar and the TUI — no indication that work was still in
   progress.

#### What changed

- **Concurrency capped at 20** parallel requests (new `concurrentMap` helper
  in `api-utils.ts`). This dramatically reduces the load on the network
  connection and prevents the stall pattern on mobile networks.
- **Per-request 5 s timeout** via `AbortSignal.timeout`. If a raw file
  fetch stalls, it is silently abandoned and line numbers fall back to
  fragment-relative values — results still appear, just without precise
  absolute line numbers for that file.
- **New progress bar** shown on stderr during the resolution phase:

  ```
    Resolving line numbers… ▓▓▓▓▓▓▓░░░░░░░░░░░░░  23/67
  ```

  The line is erased cleanly before the TUI launches, leaving a clean
  terminal.

**Before:** silent freeze, up to 2 minutes on tethering.  
**After:** steady progress bar, TUI opens within seconds on any network.

---

## Upgrade

```bash
github-code-search upgrade
```

Or download the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.8.1).
