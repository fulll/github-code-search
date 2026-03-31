# Team grouping

`--group-by-team-prefix` organises result repositories by their GitHub team membership. It is especially useful in large organisations with multiple squads or chapters.

## Prerequisites

Fetching team membership requires the **`read:org`** (or `admin:org`) scope on your GitHub token, in addition to `repo` / `public_repo`.

See [Prerequisites](/getting-started/) for how to set up your token.

## Basic usage

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-
```

Pass one or more **comma-separated prefixes**. The tool fetches all org teams whose **slugs** (derived from the team name) start with any of the given prefixes, then groups repositories accordingly.

```bash
# Multiple prefixes
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad-,chapter-
```

## Grouping algorithm

The grouping is applied sequentially, one prefix at a time:

1. **First prefix** (`squad-`)
   - Repos belonging to **exactly 1** matching team → one section per team, sorted alphabetically.
   - Repos belonging to **2** matching teams → one section per combination, sorted alphabetically.
   - Repos belonging to **3+** matching teams → same, in ascending combination-size order.
2. **Next prefix** (`chapter-`) — applied to repos **not yet assigned** in the previous step.
3. Repos matching **no prefix** → collected into an `other` section at the end.

## Non-interactive output

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

## Interactive mode with sections

In the TUI, team sections appear as separator lines between repository rows:

```text
── squad-frontend
▶ ◉  fulll/auth-service  (2 matches)
── squad-mobile
▶ ◉  fulll/frontend-app  (1 match)
── other
▶ ◉  fulll/legacy-monolith  (1 match)
```

Section header rows **are navigable** — `↑` / `↓` can land on them. Pressing `p` while the cursor rests on a multi-team section header enters [team pick mode](#team-pick-mode).

## Team pick mode

When a section header shows multiple teams (e.g. `squad-frontend + squad-mobile`), pressing `p` on it enters **team pick mode**. Use this to assign the entire section to a single owner before exporting results to downstream tooling.

### In the TUI

The section header switches to a horizontal pick bar:

```
── [ squad-frontend ]  squad-mobile
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

The flag is repeatable — add one `--pick-team` per combined section to resolve. The replay command emits `--pick-team` automatically when a pick was confirmed in the TUI.

> **Note:** Per-repo re-picks performed in the TUI (pressing `t` on a `◈` repo) are **not** encoded in the replay command. They are interactive-only adjustments and must be repeated manually if you re-run the command.

If the combined label is not found (typo, or the section was not formed), a warning is emitted on stderr listing the available combined sections — the run continues without error.

## Re-pick & undo pick

After using `--pick-team` (or the interactive `p` shortcut) to assign a combined section to a team, individual repos marked `◈` can be re-assigned or restored to their original combined section at any time.

### TUI — re-pick mode

Navigate to any **picked repo** (marked `◈`) and press **`t`** to enter re-pick mode.

```text
── squad-frontend
▶ ◈  fulll/frontend-app              ← press t here
▶ ◈  fulll/mobile-sdk
```

The hints bar shows a horizontal pick bar — exactly like team pick mode — with the current focused team highlighted in `[ brackets ]`:

```text
Re-pick: [ squad-frontend ]  squad-mobile  0/u restore  ← → move  ↵ confirm  Esc/t cancel
```

| Key         | Action                                                          |
| ----------- | --------------------------------------------------------------- |
| `←` / `→`   | Cycle through candidate teams                                   |
| `Enter`     | Confirm and move repo to the focused team                       |
| `0` / `u`   | Restore **all** repos from the combined section (undo the pick) |
| `Esc` / `t` | Exit re-pick mode without changes                               |

### Undoing a pick (merge)

Pressing `0` or `u` in re-pick mode restores **all** repos from the same combined section back to where they came from (e.g. `squad-frontend + squad-mobile`). Every `◈` badge from that section is removed and all repos are treated as unassigned again.

```text
── squad-frontend + squad-mobile      ← all repos restored
▶ ◉  fulll/frontend-app
▶ ◉  fulll/mobile-sdk
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
