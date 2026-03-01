# Keyboard shortcuts

All shortcuts are active in the interactive TUI. Keys are **case-sensitive** and must be typed in lowercase.

## Navigation

| Key       | Action                                |
| --------- | ------------------------------------- |
| `↑` / `k` | Move cursor up (repos and extracts)   |
| `↓` / `j` | Move cursor down (repos and extracts) |
| `←`       | Fold the repo under the cursor        |
| `→`       | Unfold the repo under the cursor      |

Section header rows (shown when `--group-by-team-prefix` is active) are skipped automatically during navigation.

## Selection

| Key     | Action                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Space` | Toggle selection on the current repo or extract. On a repo row: cascades to all its extracts.                                                              |
| `a`     | Select **all**. On a repo row: selects all repos and their extracts. On an extract row: selects all extracts in the current repo. Respects active filters. |
| `n`     | Select **none**. Same context rules as `a`. Respects active filters.                                                                                       |

## Filtering

| Key | Action                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------- |
| `f` | Open the filter bar and enter filter mode                                                                |
| `t` | Cycle the **filter target**: `path` → `content` → `repo` → `path`. Works outside and inside filter mode. |
| `r` | Reset the active filter and return to showing all repos / extracts                                       |

### Filter targets

| Target    | What is matched                                                               | Shown / hidden unit    |
| --------- | ----------------------------------------------------------------------------- | ---------------------- |
| `path`    | File path substring (default). Case-insensitive.                              | Individual extracts    |
| `content` | Code fragment text (the snippet returned by GitHub Search). Case-insensitive. | Individual extracts    |
| `repo`    | Repository full name (`org/repo`). Case-insensitive.                          | Entire repo + extracts |

The active target is always shown in the filter bar badge, e.g. `[content]` or `[repo]`.

### Filter mode bindings

When the filter bar is open (after pressing `f`):

| Key                                     | Action                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| Printable characters / paste            | Insert character(s) at the cursor position              |
| `←` / `→`                               | Move the text cursor one character left / right         |
| `⌥←` / `⌥→` (macOS) · `Alt+←` / `Alt+→` | Jump one word left / right                              |
| `Backspace`                             | Delete the character before the cursor                  |
| `⌥⌫` (macOS) · `Ctrl+W`                 | Delete the word before the cursor                       |
| `Tab`                                   | Toggle **regex** mode (badge shows `[…·regex]` when on) |
| `Enter`                                 | Confirm the filter and apply it                         |
| `Esc`                                   | Cancel without applying the filter                      |

::: tip
Invalid regex patterns are silently ignored (no results hidden, no crash). The badge turns yellow when a valid regex is active.
:::

## Help and exit

| Key            | Action                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `h` / `?`      | Toggle the help overlay (shows all key bindings)                                                       |
| `Enter`        | When help overlay is **closed**: confirm and print selected results. When **open**: close the overlay. |
| `q` / `Ctrl+C` | Quit without printing results                                                                          |
