# Keyboard shortcuts

All shortcuts are active in the interactive TUI. Keys are **case-sensitive** — most use lowercase letters, but a few bindings (such as `Z` and `G`) require an uppercase letter.

## Navigation

| Key                    | Action                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `↑` / `k`              | Move cursor up (repos and extracts)                                                        |
| `↓` / `j`              | Move cursor down (repos and extracts)                                                      |
| `←`                    | Fold the repo under the cursor                                                             |
| `→`                    | Unfold the repo under the cursor                                                           |
| `Z`                    | **Global fold / unfold** — fold all repos if any is unfolded; unfold all if all are folded |
| `gg`                   | Jump to the **top** (first result)                                                         |
| `G`                    | Jump to the **bottom** (last result)                                                       |
| `Page Up` / `Ctrl+U`   | Scroll up one full page                                                                    |
| `Page Down` / `Ctrl+D` | Scroll down one full page                                                                  |

Section header rows (shown when `--group-by-team-prefix` is active) are skipped automatically during navigation.

## Selection

| Key     | Action                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Space` | Toggle selection on the current repo or extract. On a repo row: cascades to all its extracts.                                                              |
| `a`     | Select **all**. On a repo row: selects all repos and their extracts. On an extract row: selects all extracts in the current repo. Respects active filters. |
| `n`     | Select **none**. Same context rules as `a`. Respects active filters.                                                                                       |
| `o`     | **Open in browser** — opens the focused item in the default browser. On a repo row: opens the repository page. On an extract row: opens the file directly. |

## Filtering

| Key | Action                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------ |
| `f` | Open the filter bar and enter filter mode                                                              |
| `t` | Cycle the **filter target**: `path` → `content` → `repo` → `path`. Only works **outside** filter mode. |
| `r` | Reset the active filter and return to showing all repos / extracts                                     |

### Filter targets

| Target    | What is matched                                                               | Shown / hidden unit    |
| --------- | ----------------------------------------------------------------------------- | ---------------------- |
| `path`    | File path substring (default). Case-insensitive.                              | Individual extracts    |
| `content` | Code fragment text (the snippet returned by GitHub Search). Case-insensitive. | Individual extracts    |
| `repo`    | Repository full name (`org/repo`). Case-insensitive.                          | Entire repo + extracts |

The active target is always shown in the filter bar badge: `[path]`, `[content]`, or `[repo]` (with `·regex` appended when regex mode is on).

### Filter mode bindings

When the filter bar is open (after pressing `f`):

| Key                                                           | Action                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Printable characters / paste                                  | Insert character(s) at the cursor position                         |
| `←` / `→`                                                     | Move the text cursor one character left / right                    |
| `⌥←` / `⌥→` (macOS) · `Ctrl+←` / `Ctrl+→` · `Alt+b` / `Alt+f` | Jump one word left / right                                         |
| `Backspace`                                                   | Delete the character before the cursor                             |
| `⌥⌫` (macOS) · `Ctrl+W`                                       | Delete the word before the cursor                                  |
| `Tab`                                                         | Toggle **regex** mode (badge shows `[…·regex]` when on)            |
| `Shift+Tab`                                                   | Cycle the **filter target** (`path` → `content` → `repo` → `path`) |
| `Enter`                                                       | Confirm the filter and apply it                                    |
| `Esc`                                                         | Cancel without applying the filter                                 |

::: tip
Invalid regex patterns do not crash the TUI but are treated as matching nothing (zero visible rows). The badge is always yellow when regex mode is active, regardless of whether the pattern is valid.
:::

## Help and exit

| Key            | Action                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `h` / `?`      | Toggle the help overlay (shows all key bindings)                                                       |
| `Enter`        | When help overlay is **closed**: confirm and print selected results. When **open**: close the overlay. |
| `q` / `Ctrl+C` | Quit without printing results                                                                          |
