import pc from "picocolors";
import * as readline from "readline";
import {
  applySelectAll,
  applySelectNone,
  buildFilterStats,
  buildRows,
  isCursorVisible,
  renderGroups,
  type FilterStats,
} from "./render.ts";
import { buildOutput } from "./output.ts";
import type { FilterTarget, OutputFormat, OutputType, RepoGroup } from "./types.ts";

// ─── Key binding constants ────────────────────────────────────────────────────

const ANSI_CLEAR = "\x1b[2J\x1b[H";
const ANSI_ARROW_UP = "\x1b[A";
const ANSI_ARROW_DOWN = "\x1b[B";
const ANSI_ARROW_LEFT = "\x1b[D";
const ANSI_ARROW_RIGHT = "\x1b[C";
const KEY_CTRL_C = "\u0003";
const KEY_ENTER_CR = "\r";
const KEY_ENTER_LF = "\n";
// Cursor / word navigation (filter mode)
const KEY_TAB = "\t";
const KEY_HOME = "\x1b[H";
const KEY_END = "\x1b[F";
const KEY_CTRL_A = "\x01";
const KEY_CTRL_E = "\x05";
const KEY_CTRL_W = "\x17";
const KEY_ALT_BACKSPACE = "\x1b\x7f";
const KEY_CTRL_ARROW_LEFT = "\x1b[1;5D";
const KEY_CTRL_ARROW_RIGHT = "\x1b[1;5C";
const KEY_ALT_ARROW_LEFT = "\x1b[1;3D"; // Alt/Option+← (xterm, iTerm2 with Use Option as Meta key)
const KEY_ALT_ARROW_RIGHT = "\x1b[1;3C"; // Alt/Option+→
const KEY_ALT_B = "\x1bb";
const KEY_ALT_F = "\x1bf";
const KEY_DELETE = "\x1b[3~";
const KEY_SHIFT_TAB = "\x1b[Z"; // Shift+Tab — cycle filter target in filter mode

// ─── Word-boundary helpers ────────────────────────────────────────────────────

/** Returns the start of the word immediately before position `pos`. */
function prevWordBoundary(s: string, pos: number): number {
  let i = pos;
  // skip trailing spaces
  while (i > 0 && s[i - 1] === " ") i--;
  // skip word chars
  while (i > 0 && s[i - 1] !== " ") i--;
  return i;
}

/** Returns the start of the next word after position `pos`. */
function nextWordBoundary(s: string, pos: number): number {
  let i = pos;
  const len = s.length;
  // skip current word
  while (i < len && s[i] !== " ") i++;
  // skip spaces
  while (i < len && s[i] === " ") i++;
  return i;
}

// ─── Interactive TUI ─────────────────────────────────────────────────────────

export async function runInteractive(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  format: OutputFormat,
  outputType: OutputType = "repo-and-matches",
  includeArchived = false,
  groupByTeamPrefix = "",
): Promise<void> {
  if (groups.length === 0) {
    console.log(pc.yellow("No results found."));
    return;
  }

  process.stdin.setRawMode(true);
  readline.emitKeypressEvents(process.stdin);

  let cursor = 0;
  let scrollOffset = 0;
  const termHeight = process.stdout.rows ?? 40;
  // HEADER_LINES (4) + position indicator (2) = 6 fixed lines consumed by renderGroups.
  // filterBarLines (0–2) and the sticky repo line (0–1) are added dynamically below.
  // Use getViewportHeight() for scroll decisions so they match what renderGroups actually renders.
  const getViewportHeight = () => {
    let barLines = 0;
    if (filterMode) barLines = 2;
    else if (filterPath || filterTarget !== "path" || filterRegex) barLines = 1;
    // When scrolled past the top, renderGroups shows a sticky repo header
    // that consumes one additional line from the available viewport.
    const stickyHeaderLines = scrollOffset > 0 ? 1 : 0;
    return termHeight - 6 - barLines - stickyHeaderLines;
  };

  // ─── Filter + help state ─────────────────────────────────────────────────
  let filterPath = "";
  let filterMode = false;
  let filterInput = "";
  let filterCursor = 0;
  let filterTarget: FilterTarget = "path";
  let filterRegex = false;
  let filterLiveStats: FilterStats | null = null;
  let statsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let showHelp = false;

  /** Schedule a debounced stats recompute (while typing in filter bar). */
  const scheduleStatsUpdate = () => {
    if (statsDebounceTimer !== null) clearTimeout(statsDebounceTimer);
    filterLiveStats = null; // show "…" while typing fast
    statsDebounceTimer = setTimeout(() => {
      filterLiveStats = buildFilterStats(groups, filterInput, filterTarget, filterRegex);
      statsDebounceTimer = null;
      redraw();
    }, 150);
  };

  const redraw = () => {
    const activeFilter = filterMode ? filterInput : filterPath;
    const rows = buildRows(groups, activeFilter, filterTarget, filterRegex);
    const rendered = renderGroups(groups, cursor, rows, termHeight, scrollOffset, query, org, {
      filterPath,
      filterMode,
      filterInput,
      filterCursor,
      filterLiveStats,
      showHelp,
      termWidth: process.stdout.columns ?? 80,
      filterTarget,
      filterRegex,
    });
    process.stdout.write(ANSI_CLEAR);
    process.stdout.write(rendered);
  };

  redraw();

  for await (const chunk of process.stdin) {
    const key = chunk.toString();

    // ── Filter input mode ────────────────────────────────────────────────────
    if (filterMode) {
      if (key === KEY_CTRL_C) {
        // safety exit even in filter mode
        process.stdout.write(ANSI_CLEAR);
        process.stdin.setRawMode(false);
        process.exit(0);
      } else if (key === "\x1b" && !key.startsWith("\x1b[") && !key.startsWith("\x1b\x1b")) {
        // ESC (bare) — cancel filter input
        filterMode = false;
        filterInput = "";
        filterCursor = 0;
        if (statsDebounceTimer !== null) {
          clearTimeout(statsDebounceTimer);
          statsDebounceTimer = null;
        }
        filterLiveStats = null;
      } else if (key === KEY_ENTER_CR || key === KEY_ENTER_LF) {
        // Enter — confirm filter
        filterPath = filterInput;
        filterMode = false;
        if (statsDebounceTimer !== null) {
          clearTimeout(statsDebounceTimer);
          statsDebounceTimer = null;
        }
        filterLiveStats = null;
        // Clamp cursor to new row list
        const newRows = buildRows(groups, filterPath, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scrollOffset = Math.min(scrollOffset, cursor);
      } else if (key === KEY_TAB) {
        // Tab — toggle regex mode
        filterRegex = !filterRegex;
        scheduleStatsUpdate();
      } else if (key === ANSI_ARROW_LEFT) {
        // ← — move cursor left
        filterCursor = Math.max(0, filterCursor - 1);
      } else if (key === ANSI_ARROW_RIGHT) {
        // → — move cursor right
        filterCursor = Math.min(filterInput.length, filterCursor + 1);
      } else if (key === KEY_HOME || key === KEY_CTRL_A) {
        // Home / Ctrl+A — jump to start
        filterCursor = 0;
      } else if (key === KEY_END || key === KEY_CTRL_E) {
        // End / Ctrl+E — jump to end
        filterCursor = filterInput.length;
      } else if (key === KEY_CTRL_ARROW_LEFT || key === KEY_ALT_ARROW_LEFT || key === KEY_ALT_B) {
        // Ctrl+← / Alt+← / Alt+b — word left
        filterCursor = prevWordBoundary(filterInput, filterCursor);
      } else if (key === KEY_CTRL_ARROW_RIGHT || key === KEY_ALT_ARROW_RIGHT || key === KEY_ALT_F) {
        // Ctrl+→ / Alt+→ / Alt+f — word right
        filterCursor = nextWordBoundary(filterInput, filterCursor);
      } else if (key === KEY_CTRL_W || key === KEY_ALT_BACKSPACE) {
        // Ctrl+W / Alt+Backspace — delete word before cursor
        const newPos = prevWordBoundary(filterInput, filterCursor);
        filterInput = filterInput.slice(0, newPos) + filterInput.slice(filterCursor);
        filterCursor = newPos;
        const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scheduleStatsUpdate();
      } else if ((key === "\x7f" || key === "\b") && filterCursor > 0) {
        // Backspace — delete char before cursor
        filterInput = filterInput.slice(0, filterCursor - 1) + filterInput.slice(filterCursor);
        filterCursor--;
        const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scheduleStatsUpdate();
      } else if (key === KEY_DELETE && filterCursor < filterInput.length) {
        // Del — delete char at cursor
        filterInput = filterInput.slice(0, filterCursor) + filterInput.slice(filterCursor + 1);
        const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scheduleStatsUpdate();
      } else if (key === KEY_SHIFT_TAB) {
        // Shift+Tab — cycle filter target (path → content → repo → path)
        // Uses Shift+Tab instead of 't' so the letter t can still be typed in the filter.
        filterTarget =
          filterTarget === "path" ? "content" : filterTarget === "content" ? "repo" : "path";
        const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scrollOffset = Math.min(scrollOffset, cursor);
        scheduleStatsUpdate();
      } else if (!key.startsWith("\x1b")) {
        // Printable character(s) — insert at cursor.
        // Handles both single keystrokes and paste (multi-char chunk).
        // Discard control chars (code < 32 or DEL 127) without using a regex
        // literal so as not to trigger the no-control-regex lint rule.
        const printable = Array.from(key)
          .filter((c) => {
            const code = c.charCodeAt(0);
            return code >= 32 && code !== 127;
          })
          .join("");
        if (printable.length > 0) {
          filterInput =
            filterInput.slice(0, filterCursor) + printable + filterInput.slice(filterCursor);
          filterCursor += printable.length;
          const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
          cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
          scheduleStatsUpdate();
        }
      }
      redraw();
      continue;
    }

    // ── Normal mode ─────────────────────────────────────────────────────────
    const rows = buildRows(groups, filterPath, filterTarget, filterRegex);
    const row = rows[cursor];

    if (key === KEY_CTRL_C || key === "q") {
      process.stdout.write(ANSI_CLEAR);
      process.stdin.setRawMode(false);
      process.exit(0);
    }

    if (key === KEY_ENTER_CR || key === KEY_ENTER_LF) {
      // Dismiss help if shown; otherwise confirm selection
      if (showHelp) {
        showHelp = false;
        redraw();
        continue;
      }
      process.stdout.write(ANSI_CLEAR);
      process.stdin.setRawMode(false);
      console.log(
        buildOutput(groups, query, org, excludedRepos, excludedExtractRefs, format, outputType, {
          includeArchived,
          groupByTeamPrefix,
        }),
      );
      process.exit(0);
    }

    // `h` / `?` — toggle help overlay
    if (key === "h" || key === "?") {
      showHelp = !showHelp;
      redraw();
      continue;
    }

    // `f` — enter filter input mode
    if (key === "f") {
      filterMode = true;
      filterInput = filterPath; // pre-fill with current filter
      filterCursor = filterInput.length; // cursor at end
      // Show current stats immediately if there's already a filter
      if (filterInput) {
        filterLiveStats = buildFilterStats(groups, filterInput, filterTarget, filterRegex);
      } else {
        filterLiveStats = null;
      }
      redraw();
      continue;
    }

    // `t` — cycle filter target: path → content → repo → path
    if (key === "t") {
      filterTarget =
        filterTarget === "path" ? "content" : filterTarget === "content" ? "repo" : "path";
      if (filterPath) {
        // Rebuild rows with new target
        const newRows = buildRows(groups, filterPath, filterTarget, filterRegex);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scrollOffset = Math.min(scrollOffset, cursor);
      }
      redraw();
      continue;
    }

    // `r` — reset filter
    if (key === "r") {
      filterPath = "";
      filterInput = "";
      filterCursor = 0;
      filterMode = false;
      if (statsDebounceTimer !== null) {
        clearTimeout(statsDebounceTimer);
        statsDebounceTimer = null;
      }
      filterLiveStats = null;
      const newRows = buildRows(groups, "", filterTarget, filterRegex);
      cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
      scrollOffset = Math.min(scrollOffset, cursor);
      redraw();
      continue;
    }

    // Skip navigation/selection keys when help overlay is shown
    if (showHelp) {
      redraw();
      continue;
    }

    if (key === ANSI_ARROW_UP || key === "k") {
      // Arrow up — skip section-header rows
      let next = Math.max(0, cursor - 1);
      while (next > 0 && rows[next]?.type === "section") next--;
      cursor = next;
      if (cursor < scrollOffset) scrollOffset = cursor;
    }

    if (key === ANSI_ARROW_DOWN || key === "j") {
      // Arrow down — skip section-header rows
      let next = Math.min(rows.length - 1, cursor + 1);
      while (next < rows.length - 1 && rows[next]?.type === "section") next++;
      cursor = next;
      while (
        scrollOffset < cursor &&
        !isCursorVisible(rows, groups, cursor, scrollOffset, getViewportHeight())
      ) {
        scrollOffset++;
      }
    }

    if (key === ANSI_ARROW_LEFT) {
      // Arrow left → fold
      if (row?.type === "repo") {
        groups[row.repoIndex].folded = true;
      } else if (row?.type === "extract") {
        const parentIdx = rows.findIndex((r) => r.type === "repo" && r.repoIndex === row.repoIndex);
        groups[row.repoIndex].folded = true;
        cursor = parentIdx;
        if (cursor < scrollOffset) scrollOffset = cursor;
      }
    }

    if (key === ANSI_ARROW_RIGHT) {
      // Arrow right → unfold
      if (row?.type === "repo") {
        groups[row.repoIndex].folded = false;
      }
    }

    if (key === " " && row && row.type !== "section") {
      if (row.type === "repo") {
        const group = groups[row.repoIndex];
        group.repoSelected = !group.repoSelected;
        group.extractSelected = group.extractSelected.map(() => group.repoSelected);
      } else {
        const group = groups[row.repoIndex];
        const ei = row.extractIndex!;
        group.extractSelected[ei] = !group.extractSelected[ei];
        group.repoSelected = group.extractSelected.some(Boolean);
      }
    }

    // `a` — select all (respects active filter)
    if (key === "a" && row && row.type !== "section") {
      applySelectAll(groups, row, filterPath, filterTarget, filterRegex);
    }

    // `n` — select none (respects active filter)
    if (key === "n" && row && row.type !== "section") {
      applySelectNone(groups, row, filterPath, filterTarget, filterRegex);
    }

    redraw();
  }
}
