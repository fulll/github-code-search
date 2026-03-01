# Interactive mode

When you run a search without `--no-interactive` (and outside a CI environment), `github-code-search` launches a full-screen TUI. This is the main advantage of the tool over GitHub's web search: results are grouped by repository, and you can fold, navigate, filter, and select exactly what you need.

## Launching the TUI

```bash
github-code-search "useFeatureFlag" --org fulll
```

## TUI overview

```text
 github-code-search  useFeatureFlag in fulll
3 repos · 4 files
← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  h help  ↵ confirm  q quit

▸   fulll/billing-api                                         3 matches
▾ ✓ fulll/auth-service                                       2 matches
      ✓ src/middlewares/featureFlags.ts
            …const flag = useFeatureFlag('new-onboarding'); if (!flag) return next();…
      ✓ tests/unit/featureFlags.test.ts
            …expect(useFeatureFlag('new-onboarding')).toBe(true);…
▸   fulll/legacy-monolith                                     1 match
```

- `▸` — folded repo (extracts hidden)
- `▾` — unfolded repo (extracts visible)
- `✓` — selected (green in the terminal)
- ` ` — deselected (space — keeps columns aligned)
- Match counts are right-aligned to the terminal width
- The header badge `github-code-search` is displayed on a violet background

## Keyboard shortcuts

| Key            | Action                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `↑` / `↓`      | Navigate between repos and extracts                                                                                               |
| `←`            | Fold the repo under the cursor                                                                                                    |
| `→`            | Unfold the repo under the cursor                                                                                                  |
| `Space`        | Select / deselect the current repo or extract                                                                                     |
| `a`            | Select **all** — on a repo row: all repos and extracts; on an extract row: all extracts in that repo. Respects any active filter. |
| `n`            | Select **none** — same context rules as `a`. Respects any active filter.                                                          |
| `f`            | Open the **filter bar** — type to narrow visible repos or files                                                                   |
| `t`            | Cycle the **filter target**: `path` → `content` → `repo` → `path`                                                                 |
| `r`            | **Reset** the active filter and show all repos / extracts                                                                         |
| `h` / `?`      | Toggle the **help overlay**                                                                                                       |
| `Enter`        | Confirm and print selected results (also closes the help overlay)                                                                 |
| `q` / `Ctrl+C` | Quit without printing                                                                                                             |

## Selection behaviour

- **Selecting a repo row** (`Space`) cascades to all its extracts.
- **Deselecting a repo row** deselects all its extracts.
- **Selecting an individual extract** keeps the parent repo selected as long as at least one extract is selected.
- **Deselecting the last extract** in a repo automatically deselects the repo too.

## Filter mode

Press `f` to enter filter mode. A two-line bar appears at the top of the results:

```text
🔍  src/▌                                 3 repos · 5 files
           ←→ move  ·  ⌥←→ word  ·  ⌥⌫ del word  ·  Tab regex  ·  ↵ OK  ·  Esc cancel
```

- **Line 1**: the filter input field with a text cursor (`▌`), plus live stats on the right (how many repos and files are currently visible).
- **Line 2**: available shortcuts, indented to align with the input text.

### Filter targets

Press `t` (outside or inside filter mode) to cycle through three matching modes:

| Badge       | Target    | What is matched                                     | Unit shown/hidden |
| ----------- | --------- | --------------------------------------------------- | ----------------- |
| _(none)_    | `path`    | File path — default, case-insensitive substring     | Individual file   |
| `[content]` | `content` | Code fragment text returned by GitHub Search        | Individual file   |
| `[repo]`    | `repo`    | Full repository name (`org/repo`), case-insensitive | Entire repo       |

The matching part is highlighted in **yellow** in the result list so you can instantly see why a row is visible.

### Regex mode

Press `Tab` in filter mode to toggle regular-expression matching. The badge updates to `[path·regex]` (or `[content·regex]`, etc.) while regex is active. If the expression is invalid, it matches nothing (no results are shown until you correct the pattern).

### Confirmed filter

After pressing `Enter` the filter is locked and the bar shows a compact summary:

```text
🔍 [repo]  billing  3 matches in 1 repo shown · 2 hidden in 2 repos  r to reset
```

Press `r` at any time to clear the filter and show all results again.

::: info
`a` (select all) and `n` (select none) always operate only on the **currently visible** repos and extracts when a filter is active. The filter target is taken into account: with `filterTarget=repo` only repos whose name matches are affected.
:::

## Full workflow example

**1 — Run the search:**

```bash
github-code-search "useFeatureFlag" --org fulll
```

**2 — Navigate with `↑`/`↓`, unfold repos with `→`.**

**3 — Filter to `src/` files only:**

Press `f`, type `src/`, press `Enter`.

**4 — Select all visible extracts:**

Press `a` on a repo row to select all its visible extracts.

**5 — Deselect a specific extract:**

Navigate to it with `↑`/`↓`, press `Space`.

**6 — Confirm:**

Press `Enter`. The selected results are printed to stdout, along with a replay command.

## Output and replay command

After pressing `Enter`:

```text
2 repos · 2 files selected

- **fulll/auth-service** (1 match)
  - [ ] [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
- **fulll/billing-api** (1 match)
  - [ ] [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)
```

<details>
<summary>replay command</summary>

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive \
  --exclude-repositories legacy-monolith
```

</details>

The replay command encodes your exact selection (exclusions) so you can reproduce the result in CI without the UI. See [Non-interactive mode](/usage/non-interactive-mode) for more.

## Output format

By default output is Markdown. Pass `--format json` to get a JSON payload instead:

```bash
github-code-search "useFeatureFlag" --org fulll --format json
```

See [Output formats](/usage/output-formats) for the full reference.
