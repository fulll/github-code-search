import pc from "picocolors";
import * as readline from "readline";
import {
  applySelectAll,
  applySelectNone,
  buildRows,
  isCursorVisible,
  renderGroups,
} from "./render.ts";
import { buildOutput } from "./output.ts";
import type { OutputFormat, OutputType, RepoGroup } from "./types.ts";

// ─── Key binding constants ────────────────────────────────────────────────────

const ANSI_CLEAR = "\x1b[2J\x1b[H";
const ANSI_ARROW_UP = "\x1b[A";
const ANSI_ARROW_DOWN = "\x1b[B";
const ANSI_ARROW_LEFT = "\x1b[D";
const ANSI_ARROW_RIGHT = "\x1b[C";
const KEY_CTRL_C = "\u0003";
const KEY_ENTER_CR = "\r";
const KEY_ENTER_LF = "\n";

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
  const viewportHeight = termHeight - 5;

  // ─── Filter + help state ─────────────────────────────────────────────────
  let filterPath = "";
  let filterMode = false;
  let filterInput = "";
  let showHelp = false;

  const redraw = () => {
    const activeFilter = filterMode ? filterInput : filterPath;
    const rows = buildRows(groups, activeFilter);
    const rendered = renderGroups(groups, cursor, rows, termHeight, scrollOffset, query, org, {
      filterPath,
      filterMode,
      filterInput,
      showHelp,
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
      } else if (key === "\x1b") {
        // ESC — cancel filter input
        filterMode = false;
        filterInput = "";
      } else if (key === KEY_ENTER_CR || key === KEY_ENTER_LF) {
        // Enter — confirm filter
        filterPath = filterInput;
        filterMode = false;
        // Clamp cursor to new row list
        const newRows = buildRows(groups, filterPath);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
        scrollOffset = Math.min(scrollOffset, cursor);
      } else if (key === "\x7f" || key === "\b") {
        // Backspace — trim and clamp cursor to new live-filtered row list
        filterInput = filterInput.slice(0, -1);
        const newRows = buildRows(groups, filterInput);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
      } else if (key.length === 1 && key >= " ") {
        // Printable character — clamp cursor to new live-filtered row list
        filterInput += key;
        const newRows = buildRows(groups, filterInput);
        cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
      }
      redraw();
      continue;
    }

    // ── Normal mode ─────────────────────────────────────────────────────────
    const rows = buildRows(groups, filterPath);
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
      redraw();
      continue;
    }

    // `r` — reset filter
    if (key === "r") {
      filterPath = "";
      filterInput = "";
      filterMode = false;
      const newRows = buildRows(groups, "");
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
        !isCursorVisible(rows, groups, cursor, scrollOffset, viewportHeight)
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
      applySelectAll(groups, row, filterPath);
    }

    // `n` — select none (respects active filter)
    if (key === "n" && row && row.type !== "section") {
      applySelectNone(groups, row, filterPath);
    }

    redraw();
  }
}
