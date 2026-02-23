# Your first search

This guide walks through a complete search session from first invocation to structured output.

## Prerequisites

Make sure you have:

- `github-code-search` [installed](/getting-started/installation)
- `GITHUB_TOKEN` set in your environment ([see Prerequisites](/getting-started/))

## Run a search

```bash
github-code-search query "useFeatureFlag" --org my-org
```

Or using the backward-compatible shorthand (no `query` subcommand):

```bash
github-code-search "useFeatureFlag" --org my-org
```

`github-code-search` fetches all matching code items across your organisation (up to 1 000 results — see [GitHub API limits](/reference/github-api-limits)) and opens the **interactive TUI**.

## The interactive TUI

```
GitHub Code Search: useFeatureFlag in my-org
4 repos · 11 files
← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  h help  ↵ confirm  q quit

▶ ◉  my-org/billing-api  (3 extracts)
▼ ◉  my-org/auth-service  (2 extracts)
      ◉  src/middlewares/featureFlags.ts
            …const flag = useFeatureFlag('new-onboarding'); if (!flag) return next();…
      ◉  tests/unit/featureFlags.test.ts
            …expect(useFeatureFlag('new-onboarding')).toBe(true);…
▶ ◉  my-org/frontend-app  (5 extracts)
▶ ○  my-org/legacy-monolith  (1 extract)
```

What you see:

- **`▶`** — repo is folded (extracts hidden). Press `→` to unfold.
- **`▼`** — repo is unfolded. Press `←` to fold.
- **`◉`** — selected. **`○`** — deselected.
- The summary line at the top shows the total count of repos and files found.

## Navigate and select

Use the keyboard to explore results:

| Key       | Action                                  |
| --------- | --------------------------------------- |
| `↑` / `↓` | Move the cursor                         |
| `←` / `→` | Fold / unfold the repo under the cursor |
| `Space`   | Toggle selection on the current row     |
| `a`       | Select all visible repos / extracts     |
| `n`       | Deselect all visible repos / extracts   |
| `f`       | Open the file-path filter bar           |
| `h`       | Toggle the help overlay                 |

Full keymap → [Keyboard shortcuts](/reference/keyboard-shortcuts)

## Confirm and get output

Press **`Enter`** to confirm. The selected results are printed to stdout:

```
2 repos · 3 files · 3 matches selected

- **my-org/auth-service**
  - [ ] [src/middlewares/featureFlags.ts:2:19](https://github.com/my-org/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
- **my-org/billing-api**
  - [ ] [src/flags.ts:3:14](https://github.com/my-org/billing-api/blob/main/src/flags.ts#L3)
  - [ ] [src/routes/invoices.ts:1:1](https://github.com/my-org/billing-api/blob/main/src/routes/invoices.ts#L1)

<details>
<summary>replay command</summary>

github-code-search "useFeatureFlag" --org my-org --no-interactive \
  --exclude-repositories legacy-monolith \
  --exclude-extracts auth-service:tests/unit/featureFlags.test.ts:0
</details>
```

The **replay command** at the bottom lets you reproduce the exact same selection non-interactively — useful in CI pipelines or documentation.

## What's next?

- **Search syntax**: learn how to target specific repos, file paths or languages → [Search syntax](/usage/search-syntax)
- **Interactive mode**: full guide to the TUI (filter bar, select all/none, …) → [Interactive mode](/usage/interactive-mode)
- **Non-interactive mode**: use `--no-interactive` in CI → [Non-interactive mode](/usage/non-interactive-mode)
- **Output formats**: get JSON instead of Markdown → [Output formats](/usage/output-formats)
