---
title: "What's new in v1.8.2"
description: "Bug fix: multi-page searches no longer abort when GitHub rate-limits mid-pagination — the CLI now waits and resumes automatically."
date: 2026-03-09
---

# What's new in github-code-search v1.8.2

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.8.2>

## Highlights

### Fix: multi-page searches aborted by rate limits now auto-resume

When searching across a large organisation with many results (close to the
GitHub 1 000-result cap), the CLI could crash mid-way through pagination with:

```
  Fetching results from GitHub… ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  page 9/10
error: GitHub API rate limit exceeded. Please retry in 53 seconds.
```

The search was lost at ~90 % completion and had to be restarted from scratch.

#### Root causes (three compounding issues)

**1. Long rate-limit waits threw immediately.**  
When `x-ratelimit-reset` indicated a wait longer than 10 seconds,
`fetchWithRetry` threw an error instead of waiting. The pagination loop
propagated this exception and discarded all pages already fetched.

**2. Secondary rate limits were not recognised.**  
GitHub secondary rate limits return `403 + Retry-After` (without
`x-ratelimit-remaining: 0`). This pattern bypassed the retry logic entirely
and surfaced as an unhandled API error.

**3. 422 error when results hit exactly 1 000.**  
When `total_count` was an exact multiple of 100 (e.g. 1 000 results across 10
full pages), the pagination loop attempted a page 11. GitHub rejects this with
`422 Cannot access beyond the first 1000 results`.

#### What changed

- **Auto-wait with visible feedback.** When a rate-limit response is received
  during pagination, the CLI now prints a message, waits for the exact duration
  indicated by GitHub (`x-ratelimit-reset` or `Retry-After` + 1 s clock-skew
  buffer), and resumes automatically — no retry counting, no data lost:

  ```
    Fetching results from GitHub… ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  page 9/10
    Rate limited — waiting 53 seconds, resuming automatically…
    Fetching results from GitHub… ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  page 10/10
  ```

- **Secondary rate limit detection.** Any `403 + Retry-After` response is now
  treated as a retriable rate-limit condition.

- **Page 11 guard.** `fetchAllResults` now short-circuits before requesting
  a page beyond `totalPages`, preventing the 422 error at the cap.

**Before:** error at page 9, search lost.  
**After:** transparent pause, TUI opens with all 1 000 results.

---

## Upgrade

```bash
github-code-search upgrade
```

Or download the latest binary directly from the
[GitHub Releases page](https://github.com/fulll/github-code-search/releases/tag/v1.8.2).
