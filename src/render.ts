import pc from "picocolors";
import type { RepoGroup, Row } from "./types.ts";
import { highlightFragment } from "./render/highlight.ts";
import { buildFilterStats } from "./render/filter.ts";
import { rowTerminalLines, buildRows, isCursorVisible } from "./render/rows.ts";
import { buildMatchCountLabel, buildSummaryFull } from "./render/summary.ts";
import { applySelectAll, applySelectNone } from "./render/selection.ts";

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Consumers (tui.ts, output.ts, tests) continue to import from render.ts.

export { highlightFragment } from "./render/highlight.ts";
export { buildFilterStats } from "./render/filter.ts";
export { rowTerminalLines, buildRows, isCursorVisible } from "./render/rows.ts";
export {
  buildMatchCountLabel,
  buildSummary,
  buildSummaryFull,
  buildSelectionSummary,
} from "./render/summary.ts";
export { applySelectAll, applySelectNone } from "./render/selection.ts";

// ─── Help overlay ─────────────────────────────────────────────────────────────

export function renderHelpOverlay(): string {
  const bar = pc.dim("─".repeat(62));
  const rows = [
    bar,
    `  ${pc.bold("Key bindings")}`,
    bar,
    `  ${pc.yellow("↑")} / ${pc.yellow("k")}       navigate up            ${pc.yellow("↓")} / ${pc.yellow("j")}       navigate down`,
    `  ${pc.yellow("←")}           fold repo              ${pc.yellow("→")}           unfold repo`,
    `  ${pc.yellow("Space")}       toggle selection       ${pc.yellow("Enter")}       confirm & output`,
    `  ${pc.yellow("a")}           select all             ${pc.yellow("n")}           select none`,
    `                 ${pc.dim("(respects active filter)")}`,
    `  ${pc.yellow("f")}           enter filter mode      ${pc.yellow("r")}           reset filter`,
    `  ${pc.yellow("h")} / ${pc.yellow("?")}       toggle this help       ${pc.yellow("q")} / Ctrl+C  quit`,
    bar,
    `  ${pc.dim("Filter mode:")}  type to filter by path · Enter confirm · Esc cancel`,
    bar,
    pc.dim(`  press ${pc.yellow("h")} or ${pc.yellow("?")} to close`),
  ];
  return rows.join("\n");
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const INDENT = "  ";
const HEADER_LINES = 4; // title + summaryFull + hints + blank

/** Strip ANSI escape sequences to measure the visible character width of a string. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\d;]*[mGKHF]/g, "");
}

/** Options bag for renderGroups — all fields optional. */
interface RenderOptions {
  /** Currently active file-path filter (empty = no filter). */
  filterPath?: string;
  /** Whether the filter input bar is in edit mode. */
  filterMode?: boolean;
  /** Text being typed in filter mode (may differ from confirmed filterPath). */
  filterInput?: string;
  /** Whether to show the help overlay instead of the normal view. */
  showHelp?: boolean;
  /** Terminal column width used to right-align match counts (default: 80). */
  termWidth?: number;
}

export function renderGroups(
  groups: RepoGroup[],
  cursor: number,
  rows: Row[],
  termHeight: number,
  scrollOffset: number,
  query: string,
  org: string,
  opts: RenderOptions = {},
): string {
  const {
    filterPath = "",
    filterMode = false,
    filterInput = "",
    showHelp = false,
    termWidth = 80,
  } = opts;

  // ── Help overlay ──────────────────────────────────────────────────────────
  if (showHelp) {
    return renderHelpOverlay();
  }

  const lines: string[] = [];

  lines.push(
    `${pc.bgMagenta(pc.bold(" github-code-search "))} ${pc.bold(pc.cyan(query))} ${pc.dim("in")} ${pc.bold(pc.yellow(org))}`,
  );
  lines.push(buildSummaryFull(groups));

  // ── Filter bar (sticky, shown when active or typing) ──────────────────────
  let filterBarLines = 0;
  if (filterMode) {
    lines.push(
      `🔍 ${pc.bold("Filter:")} ${filterInput}${pc.inverse(" ")}  ${pc.dim("Enter confirm · Esc cancel")}`,
    );
    filterBarLines = 1;
  } else if (filterPath) {
    const stats = buildFilterStats(groups, filterPath);
    const statsStr = pc.dim(
      `${stats.visibleMatches} match${stats.visibleMatches !== 1 ? "es" : ""} in ${stats.visibleRepos} repo${stats.visibleRepos !== 1 ? "s" : ""} shown · ` +
        `${stats.hiddenMatches} hidden in ${stats.hiddenRepos} repo${stats.hiddenRepos !== 1 ? "s" : ""}  r to reset`,
    );
    lines.push(`🔍 ${pc.bold("filter:")} ${pc.yellow(filterPath)}  ${statsStr}`);
    filterBarLines = 1;
  }

  lines.push(
    pc.dim(
      "← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  h help  ↵ confirm  q quit\n",
    ),
  );

  // ── Sticky current-repo ───────────────────────────────────────────────────
  // When the cursor is on an extract row whose repo header has scrolled above
  // the viewport, pin that repo header immediately below the banner so the
  // user always knows which repo they are in.
  const cursorRow = rows[cursor];
  let stickyRepoLine: string | null = null;
  if (
    cursorRow &&
    cursorRow.type === "extract" &&
    cursorRow.repoIndex >= 0 &&
    cursorRow.repoIndex < groups.length
  ) {
    const repoRowIndex = rows.findIndex(
      (r) => r.type === "repo" && r.repoIndex === cursorRow.repoIndex,
    );
    if (repoRowIndex >= 0 && repoRowIndex < scrollOffset) {
      const g = groups[cursorRow.repoIndex];
      const checkbox = g.repoSelected ? pc.green("✓") : " ";
      stickyRepoLine = pc.dim(
        `▲ ${checkbox} ${pc.bold(g.repoFullName)} ${pc.dim(buildMatchCountLabel(g))}`,
      );
      lines.push(stickyRepoLine);
    }
  }

  const viewportHeight =
    termHeight - HEADER_LINES - filterBarLines - 2 - (stickyRepoLine !== null ? 1 : 0);
  let usedLines = 0;

  for (let i = scrollOffset; i < rows.length; i++) {
    const row = rows[i];

    // ── Section header row ────────────────────────────────────────────────
    if (row.type === "section") {
      lines.push(pc.magenta(pc.bold(`\n── ${row.sectionLabel} `)));
      usedLines += 2; // blank separator line + label line
      if (usedLines >= viewportHeight) break;
      continue;
    }

    const group = groups[row.repoIndex];
    const h = rowTerminalLines(group, row);

    if (usedLines + h > viewportHeight && usedLines > 0) break;

    const isCursor = i === cursor;

    if (row.type === "repo") {
      const arrow = group.folded ? pc.magenta("▸") : pc.magenta("▾");
      // ✓ for selected, space for deselected — keeps the line clean while a
      // green checkmark clearly signals selection. The space preserves column
      // alignment so the repo name always starts at the same offset.
      const checkbox = group.repoSelected ? pc.green("✓") : " ";
      const repoName = isCursor
        ? pc.bgMagenta(pc.bold(pc.white(` ${group.repoFullName} `)))
        : pc.bold(group.repoFullName);
      const count = pc.dim(buildMatchCountLabel(group));
      // Right-align the match count flush to the terminal edge
      const leftPart = `${arrow} ${checkbox} ${repoName}`;
      const leftLen = stripAnsi(leftPart).length;
      const countLen = stripAnsi(count).length;
      const pad = Math.max(0, termWidth - leftLen - countLen);
      const line = pad > 0 ? `${leftPart}${" ".repeat(pad)}${count}` : `${leftPart}${count}`;
      lines.push(line);
    } else {
      const ei = row.extractIndex!;
      const match = group.matches[ei];
      const selected = group.extractSelected[ei];
      const checkbox = selected ? pc.green("✓") : " ";
      const seg = match.textMatches[0]?.matches[0];
      const locSuffix = seg ? `:${seg.line}:${seg.col}` : "";
      const filePath = isCursor
        ? pc.bgMagenta(pc.bold(pc.white(` ${match.path}${locSuffix} `)))
        : `${pc.cyan(match.path)}${pc.dim(locSuffix)}`;
      lines.push(`${INDENT}${INDENT}${checkbox} ${filePath}`);

      if (match.textMatches.length > 0) {
        const tm = match.textMatches[0];
        const fragmentLines = highlightFragment(tm.fragment, tm.matches, match.path);
        for (const fl of fragmentLines) {
          lines.push(`${INDENT}${INDENT}${INDENT}${fl}`);
        }
      }
    }

    usedLines += h;
    if (usedLines >= viewportHeight) break;
  }

  // Position indicator
  if (rows.length > 0) {
    lines.push(
      pc.dim(
        `\n  ↕ row ${scrollOffset + 1}–${Math.min(scrollOffset + rows.length, rows.length)} of ${rows.length}`,
      ),
    );
  }

  return lines.join("\n");
}
