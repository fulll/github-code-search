import pc from "picocolors";
import type { FilterTarget, RepoGroup, Row, TextMatchSegment } from "./types.ts";
import { highlightFragment } from "./render/highlight.ts";
import { buildFilterStats, type FilterStats } from "./render/filter.ts";
import { rowTerminalLines, buildRows, isCursorVisible } from "./render/rows.ts";
import { buildMatchCountLabel, buildSummaryFull } from "./render/summary.ts";
import { applySelectAll, applySelectNone } from "./render/selection.ts";

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Consumers (tui.ts, output.ts, tests) continue to import from render.ts.

export { highlightFragment } from "./render/highlight.ts";
export { buildFilterStats, type FilterStats } from "./render/filter.ts";
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
  const IS_MAC = process.platform === "darwin";
  const optStr = IS_MAC ? "⌥" : "Alt+";
  const optBs = IS_MAC ? "⌥⌫" : "Ctrl+W";
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
    `  ${pc.yellow("t")}           cycle filter target    ${pc.dim("(path → content → repo)")}`,
    `  ${pc.yellow("h")} / ${pc.yellow("?")}       toggle this help       ${pc.yellow("q")} / Ctrl+C  quit`,
    bar,
    `  ${pc.dim("Filter mode:")}`,
    `    type to filter  ·  ${pc.yellow("←→")} cursor  ·  ${pc.yellow(`${optStr}←→`)} word jump  ·  ${pc.yellow(optBs)} del word`,
    `    ${pc.yellow("Tab")} regex  ·  ${pc.yellow("Shift+Tab")} target  ·  ${pc.yellow("↵")} confirm  ·  ${pc.yellow("Esc")} cancel`,
    bar,
    pc.dim(`  press ${pc.yellow("h")} or ${pc.yellow("?")} to close`),
  ];
  return rows.join("\n");
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const INDENT = "  ";
const HEADER_LINES = 4; // title + summaryFull + hints + blank

/**
 * Compute flat-offset segments for all occurrences of `pattern` in `fragment`.
 * Returns fake TextMatchSegment entries (line/col unused by highlightFragment).
 * Used to overlay filter-term highlights when filterTarget === "content".
 */
function contentPatternSegments(
  fragment: string,
  pattern: string,
  isRegex: boolean,
): TextMatchSegment[] {
  let re: RegExp;
  try {
    re = isRegex
      ? new RegExp(pattern, "gi")
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  } catch {
    return [];
  }
  const segs: TextMatchSegment[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    segs.push({ text: m[0], indices: [m.index, m.index + m[0].length], line: 0, col: 0 });
    if (m[0].length === 0) re.lastIndex++;
  }
  return segs;
}

/** Strip ANSI escape sequences to measure the visible character width of a string. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\d;]*[mGKHF]/g, "");
}

/**
 * Returns a text-highlight function compiled once per renderGroups call.
 * The returned function applies bold-yellow highlighting to every occurrence of
 * `pattern` in the given text — but only when `filterTarget === target`.
 * Compiling the regex here avoids recompiling on every row during the render loop.
 * Matching is case-insensitive; invalid regex silently falls back to plain style.
 */
function makeTextHighlighter(
  pattern: string,
  filterTarget: FilterTarget,
  filterRegex: boolean,
): (text: string, target: FilterTarget, baseStyle: (s: string) => string) => string {
  if (!pattern) return (_text, _target, style) => style(_text);
  let re: RegExp;
  try {
    re = filterRegex
      ? new RegExp(pattern, "gi")
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  } catch {
    return (_text, _target, style) => style(_text);
  }
  return (text, target, baseStyle) => {
    if (filterTarget !== target) return baseStyle(text);
    re.lastIndex = 0; // reset for each new text (g flag retains state across calls)
    const parts: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(baseStyle(text.slice(last, m.index)));
      parts.push(pc.bold(pc.yellow(m[0])));
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++; // guard zero-length match
    }
    if (last < text.length) parts.push(baseStyle(text.slice(last)));
    return parts.length > 0 ? parts.join("") : baseStyle(text);
  };
}

/** Options bag for renderGroups — all fields optional. */
interface RenderOptions {
  /** Currently active confirmed filter (empty = no filter). */
  filterPath?: string;
  /** Whether the filter input bar is in edit mode. */
  filterMode?: boolean;
  /** Text being typed in filter mode (may differ from confirmed filterPath). */
  filterInput?: string;
  /** Caret position within filterInput (for cursor rendering). */
  filterCursor?: number;
  /** Pre-computed live stats for filterMode display (null = computing / not yet available). */
  filterLiveStats?: FilterStats | null;
  /** Whether to show the help overlay instead of the normal view. */
  showHelp?: boolean;
  /** Terminal column width used to right-align match counts (default: 80). */
  termWidth?: number;
  /** Which field to match against (default: "path"). */
  filterTarget?: FilterTarget;
  /** When true, filterPath is treated as a regular expression (default: false). */
  filterRegex?: boolean;
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
    filterCursor,
    filterLiveStats = null,
    showHelp = false,
    termWidth = 80,
    filterTarget = "path",
    filterRegex = false,
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

  // Active filter text used for in-row highlighting (filterInput while typing, filterPath once confirmed)
  const activeFilter = filterMode ? filterInput : filterPath;

  // Compile text highlighter once for this render call — avoids regex recompilation per row.
  const highlightText = makeTextHighlighter(activeFilter, filterTarget, filterRegex);

  // ── Filter bar (sticky, shown when active or typing) ──────────────────────
  const IS_MAC = process.platform === "darwin";
  const optStr = IS_MAC ? "⌥" : "Alt+";
  const optBs = IS_MAC ? "⌥⌫" : "Ctrl+W";

  // Mode badge: always shown so the active target is always explicit — [path], [content], [repo],
  // [path·regex], [content·regex], [repo·regex].
  const targetBadge = ` ${pc.dim("[")}${pc.yellow(filterTarget)}${filterRegex ? pc.dim("·") + pc.yellow("regex") : ""}${pc.dim("]")} `;

  let filterBarLines = 0;
  if (filterMode) {
    // ── Line 1: underlined input field + stats right-aligned ───────────────
    const cur = filterCursor ?? filterInput.length;
    const before = filterInput.slice(0, cur);
    const atCursor = filterInput.length > cur ? filterInput[cur] : " ";
    const after = filterInput.slice(cur + 1);

    let statsStr = "";
    let statsVisLen = 0;
    if (filterInput) {
      if (filterLiveStats) {
        const r = filterLiveStats.visibleRepos;
        const f = filterLiveStats.visibleFiles;
        const m2 = filterLiveStats.visibleMatches;
        // Show matches only when cross-repo duplicates inflate the count
        const parts = [
          `${r} repo${r !== 1 ? "s" : ""}`,
          `${f} file${f !== 1 ? "s" : ""}`,
          ...(m2 !== f ? [`${m2} match${m2 !== 1 ? "es" : ""}`] : []),
        ];
        statsStr = pc.dim(parts.join(" \u00b7 "));
        statsVisLen = stripAnsi(statsStr).length;
      } else {
        statsStr = pc.dim("…");
        statsVisLen = 1;
      }
    }
    const statsRight = statsVisLen > 0 ? `  ${statsStr}` : "";
    const statsRightVisLen = statsVisLen > 0 ? 2 + statsVisLen : 0;

    // 🔍 is 2 cols wide in most terminals; targetBadge is pure ASCII
    const prefixVisLen = 2 + stripAnsi(targetBadge).length;
    const fieldWidth = Math.max(8, termWidth - prefixVisLen - statsRightVisLen);
    const padWidth = Math.max(0, fieldWidth - filterInput.length - 1);
    const pad = " ".repeat(padWidth);

    // Underline the whole field; cursor char gets inverse video on top
    const inputLine =
      `🔍${targetBadge}` +
      `\x1b[4m${before}\x1b[7m${atCursor}\x1b[27m${after}${pad}\x1b[24m` +
      statsRight;
    lines.push(inputLine);

    // ── Line 2: OS-aware shortcuts (indented to align with input text) ──────
    // prefixVisLen = width of "🔍" (2) + targetBadge, so hints start exactly
    // under the first character of the typed filter input.
    const hintsIndent = " ".repeat(prefixVisLen);
    const hints = [
      `${pc.yellow("←→")} move`,
      `${pc.yellow(`${optStr}←→`)} word`,
      `${pc.yellow(optBs)} del word`,
      `${pc.yellow("Tab")} regex${filterRegex ? pc.green(" ✓") : ""}`,
      `${pc.yellow("Shift+Tab")} target`,
      `${pc.yellow("↵")} OK`,
      `${pc.yellow("Esc")} cancel`,
    ].join("  ·  ");
    lines.push(pc.dim(`${hintsIndent}${hints}`));

    filterBarLines = 2;
  } else if (filterPath) {
    const stats = buildFilterStats(groups, filterPath, filterTarget, filterRegex);
    const statsStr = pc.dim(
      `${stats.visibleMatches} match${stats.visibleMatches !== 1 ? "es" : ""} in ${
        stats.visibleRepos
      } repo${stats.visibleRepos !== 1 ? "s" : ""} shown · ${
        stats.hiddenMatches
      } hidden in ${stats.hiddenRepos} repo${stats.hiddenRepos !== 1 ? "s" : ""}  r to reset`,
    );
    lines.push(`🔍${targetBadge}${pc.bold("filter:")} ${pc.yellow(filterPath)}  ${statsStr}`);
    filterBarLines = 1;
  } else if (filterTarget !== "path" || filterRegex) {
    // No active filter text, but non-default mode selected — remind the user.
    lines.push(`🔍${targetBadge}${pc.dim("f to filter")}`);
    filterBarLines = 1;
  }

  lines.push(
    pc.dim(
      "← / → fold/unfold  ↑ / ↓ navigate  spc select  a all  n none  f filter  t target  h help  ↵ confirm  q quit\n",
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
      // On cursor rows, keep the magenta background but still highlight the
      // matching chars in yellow so the pattern remains visible.
      // Each segment is individually styled (bold+white or bold+yellow) so
      // nested ANSI resets do not bleed into neighbouring segments.
      const repoName = isCursor
        ? pc.bgMagenta(
            ` ${highlightText(group.repoFullName, "repo", (s) => pc.bold(pc.white(s)))} `,
          )
        : highlightText(group.repoFullName, "repo", pc.bold);
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
        : `${highlightText(match.path, "path", pc.cyan)}${pc.dim(locSuffix)}`;
      lines.push(`${INDENT}${INDENT}${checkbox} ${filePath}`);

      if (match.textMatches.length > 0) {
        const tm = match.textMatches[0];
        // When filtering by content, overlay the typed pattern on the fragment.
        const extraSegs =
          filterTarget === "content" && activeFilter
            ? contentPatternSegments(tm.fragment, activeFilter, filterRegex)
            : [];
        const fragmentLines = highlightFragment(
          tm.fragment,
          [...tm.matches, ...extraSegs],
          match.path,
        );
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
