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

| Key | Action                                                                                 |
| --- | -------------------------------------------------------------------------------------- |
| `f` | Open the filter bar — type a path substring to narrow visible files (case-insensitive) |
| `r` | Reset the active filter and show all repos / extracts                                  |

### Filter mode bindings

When the filter bar is open (after pressing `f`):

| Key                  | Action                                       |
| -------------------- | -------------------------------------------- |
| Printable characters | Append character to the filter term          |
| `Backspace`          | Delete the last character of the filter term |
| `Enter`              | Confirm the filter and apply it              |
| `Esc`                | Cancel without applying the filter           |

## Help and exit

| Key            | Action                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `h` / `?`      | Toggle the help overlay (shows all key bindings)                                                       |
| `Enter`        | When help overlay is **closed**: confirm and print selected results. When **open**: close the overlay. |
| `q` / `Ctrl+C` | Quit without printing results                                                                          |
