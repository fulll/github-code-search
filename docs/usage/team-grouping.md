# Team grouping

`--group-by-team-prefix` organises result repositories by their GitHub team membership, as a **hierarchy** of headings. It is especially useful in large organisations with multiple gammes, chapters or squads.

## Prerequisites

Fetching team membership requires the **`read:org`** (or `admin:org`) scope on your GitHub token, in addition to `repo` / `public_repo`.

See [Prerequisites](/getting-started/) for how to set up your token.

## Basic usage

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-
```

Pass one or more team-name prefixes. The tool fetches all org teams whose **slugs** (derived from the team name) start with any of the given prefixes, then groups repositories accordingly.

## Chain syntax: nesting and independent chains

The value of `--group-by-team-prefix` is a small grammar:

- `/` nests levels **within one chain** — repos are grouped by the first prefix, then each resulting section is sub-grouped by the next prefix, and so on.
- `,` separates **independent chains** — each is grouped on its own, in order, against whatever repos the previous chains haven't already claimed.

```bash
# One 2-level chain: group by gamme- first, then by squad- within each gamme
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix gamme-/squad-
```

```bash
# A 2-level chain (gamme-/squad-) plus an independent 1-level chain (chapter-)
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix gamme-/squad-,chapter-
```

A chain can have as many levels as you need (`gamme-/squad-/chapter-`, …). Malformed segments (a stray leading/trailing/double `,` or `/`) are dropped with a warning on stderr rather than silently producing an empty prefix.

## Grouping algorithm

Within **one level** of a chain, repos are bucketed exactly the same way regardless of depth:

1. Repos belonging to **exactly 1** matching team at this level → one section per team, sorted alphabetically.
2. Repos belonging to **2** matching teams → one section per combination (e.g. `squad-a + squad-b`), sorted alphabetically.
3. Repos belonging to **3+** matching teams → same, in ascending combination-size order.
4. Repos matching **no team** at this level → collected into an `other` section.

Then, for a chain with more levels, **every section produced above is recursively sub-grouped** by the next prefix — including its own `other` bucket, which becomes a nested `other` at the next depth.

Independent chains (separated by `,`) are processed in order, each consuming repos from the pool not yet claimed by an earlier chain. Repos matched by no chain at all end up in a single top-level `other` section.

### Automatic nesting of overlapping team names

Within one level, if a team's name is a **prefix of another team's name** (e.g. `gamme-lead-client` and `gamme-lead-client-p1`), the tool nests the more specific team under the more general one automatically — instead of listing them as unrelated siblings:

```text
## gamme-lead-client
### gamme-lead-client-p1
```

This cascades across any number of overlapping names, and applies independently at every depth of a chain.

## Non-interactive output

### Flat (single-level) output

```text
4 repos · 5 files · 6 matches selected

## squad-backend

- **fulll/billing-api** (3 matches)
  - [ ] [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)

## squad-frontend

- **fulll/auth-service** (2 matches)
  - [ ] [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)

## squad-frontend + squad-mobile

- **fulll/frontend-app** (1 match)
  - [ ] [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)

## other

- **fulll/legacy-monolith** (1 match)
  - [ ] [src/legacy.js:5:1](https://github.com/fulll/legacy-monolith/blob/main/src/legacy.js#L5)
```

### Nested (`gamme-/squad-`) output

Nested levels render as consecutive markdown headings (`##`, `###`, `####`, …, capped at H6) — a sibling section that shares an ancestor with the previous one doesn't repeat that ancestor's heading:

```text
7 repos · 7 files · 8 matches selected

## gamme-lead-client
### squad-bank

- **fulll/bank** (1 match)
  - [ ] [src/index.ts:3:14](https://github.com/fulll/bank/blob/main/src/index.ts#L3)

## gamme-lead-mobile
### squad-core + squad-mobile

- **fulll/tools-mobile** (1 match)
  - [ ] [src/index.ts:1:1](https://github.com/fulll/tools-mobile/blob/main/src/index.ts#L1)

### other

- **fulll/wizard-mobile** (1 match)
  - [ ] [src/index.ts:2:5](https://github.com/fulll/wizard-mobile/blob/main/src/index.ts#L2)

## other

- **fulll/github-code-search** (1 match)
  - [ ] [src/index.ts:7:1](https://github.com/fulll/github-code-search/blob/main/src/index.ts#L7)
```

### JSON output

Each result carries its full hierarchy path (root first) in a `section` array:

```json
{
  "results": [
    {
      "repo": "fulll/tools-mobile",
      "section": ["gamme-lead-mobile", "squad-core + squad-mobile"],
      "matches": [{ "path": "src/index.ts", "url": "...", "line": 1, "col": 1 }]
    }
  ]
}
```

## Interactive mode with sections

In the TUI, team sections appear as separator lines between repository rows, indented by 2 spaces per nesting level:

```text
── gamme-lead-client
  ── squad-bank
▶ ◉  fulll/bank  (1 match)
── gamme-lead-mobile
  ── squad-core + squad-mobile
▶ ◉  fulll/tools-mobile  (1 match)
  ── other
▶ ◉  fulll/wizard-mobile  (1 match)
── other
▶ ◉  fulll/github-code-search  (1 match)
```

Section header rows **are navigable** at any depth — `↑` / `↓` can land on them. Pressing `p` while the cursor rests on a multi-team section header enters [team pick mode](#team-pick-mode), regardless of its nesting level.

## Team pick mode

When a section header shows multiple teams (e.g. `squad-frontend + squad-mobile`), pressing `p` on it enters **team pick mode**. Use this to assign the entire section — including any nested sub-sections underneath it — to a single owner before exporting results to downstream tooling.

### In the TUI

The section header switches to a horizontal pick bar, at whatever depth the cursor was on:

```
  ── [ squad-core ]  squad-mobile
```

The highlighted team (bold, full colour, wrapped in `[ ]`) is the current selection. The others are dimmed.

| Key       | Action                                   |
| --------- | ---------------------------------------- |
| `←` / `→` | Move focus between candidate teams       |
| `Enter`   | Confirm — section label updates in place |
| `Esc`     | Cancel — no change                       |

`p` on a section that already has a single team label does nothing.

Repos moved into a team by pick mode are annotated with a `◈` badge next to their name.

### Non-interactive — `--pick-team`

```bash
github-code-search query "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad- \
  --pick-team "squad-frontend + squad-mobile"=squad-frontend
```

The combined label can be:

- **A bare label** (as above) — auto-resolved as long as it's **unambiguous** anywhere in the hierarchy. Since a label like `other` (or even a specific combination) can legitimately appear under more than one parent, an ambiguous bare label is rejected with the list of full paths to choose from.
- **A fully-qualified path**, joined with `>`, when the label is ambiguous or you'd rather be explicit:

  ```bash
  --pick-team "gamme-lead-client > squad-a + squad-b"=squad-a
  ```

The flag is repeatable — add one `--pick-team` per combined section to resolve. The replay command emits `--pick-team` automatically (with a fully-qualified path when the pick was made on a nested section) when a pick was confirmed in the TUI.

> **Note:** Per-repo re-picks performed in the TUI (pressing `t` on a `◈` repo) are **not** encoded in the replay command. They are interactive-only adjustments and must be repeated manually if you re-run the command.

If the combined label or path is not found (typo, ambiguous, or the section was not formed), a warning is emitted on stderr listing the available combined sections — the run continues without error.

## Auto-pick by common prefix

Many combined sections aren't actually ambiguous: when one of the team names is a literal prefix of every other team name in the combo (e.g. `gamme-lead-client` and `gamme-lead-client-p1`), the "parent" team is the obvious owner. `--pick-team-auto` resolves these automatically, without needing a manual `--pick-team`:

```bash
github-code-search query "useFeatureFlag" --org fulll \
  --group-by-team-prefix gamme- \
  --pick-team-auto
```

```text
## gamme-lead-client + gamme-lead-client-p1   →   ## gamme-lead-client
```

- Combos with **no common-prefix team** (e.g. `squad-frontend + squad-mobile` — neither is a prefix of the other) are left combined and unresolved, exactly like today.
- Applies independently **at every hierarchy depth**, not just the top level.
- An explicit `--pick-team` for the same section always wins: run explicit picks first, then `--pick-team-auto` resolves whatever combined sections remain.
- The replay command emits `--pick-team-auto` when it was used, so a session is reproduced exactly.

## Re-pick & undo pick

After using `--pick-team` (or the interactive `p` shortcut) to assign a combined section to a team, individual repos marked `◈` can be re-assigned or restored to their original combined section at any time — regardless of how deeply nested the original section was.

### TUI — re-pick mode

Navigate to any **picked repo** (marked `◈`) and press **`t`** to enter re-pick mode.

```text
  ── squad-core
▶ ◈  fulll/tools-mobile              ← press t here
```

The hints bar shows a horizontal pick bar — exactly like team pick mode — with the current focused team highlighted in `[ brackets ]`:

```text
Re-pick: [ squad-core ]  squad-mobile  0/u restore  ← → move  ↵ confirm  Esc/t cancel
```

| Key         | Action                                                          |
| ----------- | --------------------------------------------------------------- |
| `←` / `→`   | Cycle through candidate teams                                   |
| `Enter`     | Confirm and move repo to the focused team                       |
| `0` / `u`   | Restore **all** repos from the combined section (undo the pick) |
| `Esc` / `t` | Exit re-pick mode without changes                               |

### Undoing a pick (merge)

Pressing `0` or `u` in re-pick mode restores **all** repos from the same combined section back to where they came from (e.g. `squad-core + squad-mobile`). Every `◈` badge from that section is removed and all repos are treated as unassigned again.

```text
  ── squad-core + squad-mobile      ← all repos restored
▶ ◉  fulll/tools-mobile
```

In **non-interactive mode**, undoing a pick is implicit: simply omit the `--pick-team` flag for that combined section in the replay command.

## Team list cache

To avoid repeating dozens of API calls on every run, `github-code-search` caches the team list on disk for **24 hours**.

### Cache location

| OS      | Path                                                                    |
| ------- | ----------------------------------------------------------------------- |
| macOS   | `~/Library/Caches/github-code-search/`                                  |
| Linux   | `$XDG_CACHE_HOME/github-code-search/` or `~/.cache/github-code-search/` |
| Windows | `%LOCALAPPDATA%\github-code-search\`                                    |

Override the cache directory with the `GITHUB_CODE_SEARCH_CACHE_DIR` environment variable.

### Bypass the cache

Pass `--no-cache` to force a fresh fetch:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad- --no-cache
```

### Purge the cache

```bash
# macOS
rm -rf ~/Library/Caches/github-code-search

# Linux
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/github-code-search"
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\github-code-search"
```
