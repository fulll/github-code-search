import * as style from "./style.ts";
import type { FilterTarget, RepoGroup, Row, TextMatchSegment } from "./types.ts";
import { highlightFragment } from "./render/highlight.ts";
import { buildFilterStats, type FilterStats } from "./render/filter.ts";
import { rowTerminalLines } from "./render/rows.ts";
import { buildMatchCountLabel, buildSummaryFull } from "./render/summary.ts";
import { renderTeamPickHeader } from "./render/team-pick.ts";
import { visibleWidth, stripAnsi, clipToWidth } from "./render/terminal.ts";

// ─── Re-exports ───────────────────────────────────────────────────────────────
// Consumers (tui.ts, output.ts, tests) continue to import from render.ts.

export {
  getHeaderLines,
  MOUSE_BUTTON_WHEEL_UP,
  MOUSE_BUTTON_WHEEL_DOWN,
  MOUSE_SCROLL_STEP,
} from "./render/layout-constants.ts";
export { highlightFragment } from "./render/highlight.ts";
export { buildFilterStats, type FilterStats } from "./render/filter.ts";
export {
  rowTerminalLines,
  buildRows,
  isCursorVisible,
  normalizeScrollOffset,
} from "./render/rows.ts";
export {
  buildMatchCountLabel,
  buildSummary,
  buildSummaryFull,
  buildSelectionSummary,
} from "./render/summary.ts";
export { applySelectAll, applySelectNone } from "./render/selection.ts";

// ─── buildFileUrl ─────────────────────────────────────────────────────────────

/**
 * Returns the URL to open when the user presses `o` on an extract row.
 * When the first text-match segment has an absolute line number, appends the
 * GitHub `#L{line}` anchor so the browser jumps directly to that line.
 */
export function buildFileUrl(match: import("./types.ts").CodeMatch): string {
  const line = match.textMatches[0]?.matches[0]?.line;
  return line != null ? `${match.htmlUrl}#L${line}` : match.htmlUrl;
}

// ─── Help overlay ─────────────────────────────────────────────────────────────

export function renderHelpOverlay(): string {
  const IS_MAC = process.platform === "darwin";
  const optStr = IS_MAC ? "⌥" : "Alt+";
  const optBs = IS_MAC ? "⌥⌫" : "Ctrl+W";

  // Box geometry: inner visible width = 80 (between │ chars), including 1-space
  // padding on each side → usable content width = 78.
  // Total box line visible length = 82 (╭ + 80×─ + ╮).
  const INNER = 80; // visible chars between │ and │
  const CONTENT = INNER - 2; // usable content chars (inner minus 2 side spaces)

  /** Pad a visible-width string to CONTENT chars. */
  const pad = (s: string) => {
    const visible = visibleWidth(s);
    return s + " ".repeat(Math.max(0, CONTENT - visible));
  };

  const top = `╭${"─".repeat(INNER)}╮`;
  const sep = `│ ${style.dim("─".repeat(CONTENT))} │`;
  const bot = `╰${"─".repeat(INNER)}╯`;

  const row = (s: string) => `│ ${pad(s)} │`;

  const rows = [
    top,
    row(`  ${style.bold("Key bindings")}`),
    sep,
    row(
      `  ${style.yellow("↑")} / ${style.yellow("k")}       navigate up            ${style.yellow("↓")} / ${style.yellow("j")}       navigate down`,
    ),
    row(
      `  ${style.yellow("←")}           fold repo              ${style.yellow("→")}           unfold repo`,
    ),
    row(`  ${style.yellow("Z")}           fold / unfold all repos`),
    row(
      `  ${style.yellow("gg")}          jump to top            ${style.yellow("G")}           jump to bottom`,
    ),
    row(
      `  ${style.yellow("PgUp")} / ${style.yellow("Ctrl+U")}  page up                ${style.yellow("PgDn")} / ${style.yellow("Ctrl+D")}  page down`,
    ),
    row(
      `  ${style.yellow("Space")}       toggle selection       ${style.yellow("Enter")}       confirm & output`,
    ),
    row(
      `  ${style.yellow("a")}           select all             ${style.yellow("n")}           select none`,
    ),
    row(`                 ${style.dim("(respects active filter)")}`),
    row(
      `  ${style.yellow("o")}           open in browser        ${style.dim("(repo row → page · extract row → file)")}`,
    ),
    row(
      `  ${style.yellow("f")}           enter filter mode      ${style.yellow("r")}           reset filter`,
    ),
    row(
      `  ${style.yellow("t")}           cycle filter target    ${style.dim("(path → content → repo)")}`,
    ),
    row(
      `  ${style.yellow("p")}           pick team owner        ${style.dim("(on a multi-team section header)")}`,
    ),
    row(
      `  ${style.yellow("h")} / ${style.yellow("?")}       toggle this help       ${style.yellow("q")} / Ctrl+C  quit`,
    ),
    sep,
    row(`  ${style.dim("Filter mode:")}`),
    row(
      `    type to filter  ·  ${style.yellow("←→")} cursor  ·  ${style.yellow(`${optStr}←→`)} word jump  ·  ${style.yellow(optBs)} del word`,
    ),
    row(
      `    ${style.yellow("Tab")} regex  ·  ${style.yellow("Shift+Tab")} target  ·  ${style.yellow("↵")} confirm  ·  ${style.yellow("Esc")} cancel`,
    ),
    sep,
    row(`  ${style.dim("Pick mode  (after pressing p on a multi-team section header):")}`),
    row(
      `    ${style.yellow("←")} / ${style.yellow("→")} move focus  ·  ${style.yellow("↵")} confirm pick  ·  ${style.yellow("Esc")} cancel`,
    ),
    sep,
    row(
      style.dim(
        `  press ${style.yellow("Esc")}, ${style.yellow("h")} or ${style.yellow("?")} to close`,
      ),
    ),
    bot,
  ];
  return rows.join("\n");
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const INDENT = "  ";
const HEADER_LINES = 4; // title + summaryFull + hints + blank

// ─── Active row styling ───────────────────────────────────────────────────────

/**
 * Wrap a content string with a full-width dark background and a saturated
 * purple left-bar character (▌).
 *
 * The bar occupies 1 visible column, so the caller must ensure that
 * `visibleWidth(content) === termWidth - 1` for the total visible row
 * width to equal `termWidth`.
 */
function renderActiveLine(content: string): string {
  // \x1b[48;5;53m  — dark purple background (256-colour bg)
  // \x1b[38;5;129m  — saturated purple foreground for the ▌ bar
  // \x1b[39m        — reset foreground only (background stays active)
  // \x1b[49m        — reset background at the end of the line
  return `\x1b[48;5;53m\x1b[38;5;129m▌\x1b[39m${content}\x1b[49m`;
}

/** Width in visible columns of the left-bar character. */
const ACTIVE_BAR_WIDTH = 1;

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
    segs.push({
      text: m[0],
      indices: [m.index, m.index + m[0].length],
      line: 0,
      col: 0,
    });
    if (m[0].length === 0) re.lastIndex++;
  }
  return segs;
}

/**
 * Sort and merge overlapping or adjacent TextMatchSegments before passing them
 * to highlightFragment. GitHub query matches and content-filter matches can share
 * character ranges; without merging, overlapping segments cause double-rendering.
 */
function mergeSegments(segs: TextMatchSegment[]): TextMatchSegment[] {
  if (segs.length <= 1) return segs;
  const sorted = segs.toSorted((a, b) => a.indices[0] - b.indices[0]);
  const merged: TextMatchSegment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.indices[0] <= last.indices[1]) {
      // Overlapping or adjacent — extend the previous segment's end if needed.
      if (cur.indices[1] > last.indices[1]) last.indices[1] = cur.indices[1];
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
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
  if (!pattern) return (_text, _target, baseStyle) => baseStyle(_text);
  let re: RegExp;
  try {
    re = filterRegex
      ? new RegExp(pattern, "gi")
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  } catch {
    return (_text, _target, baseStyle) => baseStyle(_text);
  }
  return (text, target, baseStyle) => {
    if (filterTarget !== target) return baseStyle(text);
    re.lastIndex = 0; // reset for each new text (g flag retains state across calls)
    const parts: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(baseStyle(text.slice(last, m.index)));
      parts.push(style.style(["bold", "yellow"], m[0]));
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
  /** Active team pick mode state — when set, replaces the matching section header with a pick bar. */
  teamPickMode?: {
    active: boolean;
    sectionLabel: string;
    candidates: string[];
    focusedIndex: number;
  };
  /** Active team re-pick mode state — when set, shows the re-pick bar in the hints line. */
  repickMode?: {
    active: boolean;
    repoIndex: number;
    candidates: string[];
    focusedIndex: number;
  };
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
    clipToWidth(
      `${style.style(["bgMagenta", "black", "bold"], " github-code-search ")} ${style.style(["bold", "cyan"], query)} ${style.dim("in")} ${style.style(["bold", "yellow"], org)}`,
      termWidth,
    ),
  );
  lines.push(clipToWidth(buildSummaryFull(groups), termWidth));

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
  const targetBadge = ` ${style.dim("[")}${style.yellow(filterTarget)}${filterRegex ? style.dim("·") + style.yellow("regex") : ""}${style.dim("]")} `;

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
        statsStr = style.dim(parts.join(" \u00b7 "));
        statsVisLen = visibleWidth(statsStr);
      } else {
        statsStr = style.dim("…");
        statsVisLen = 1;
      }
    }
    const statsRight = statsVisLen > 0 ? `  ${statsStr}` : "";
    const statsRightVisLen = statsVisLen > 0 ? 2 + statsVisLen : 0;

    // 🔍 is 2 cols wide in most terminals; targetBadge is pure ASCII
    const prefixVisLen = 2 + visibleWidth(targetBadge);
    const fieldWidth = Math.max(8, termWidth - prefixVisLen - statsRightVisLen);
    const inputVisLen = visibleWidth(before + atCursor + after);
    const padWidth = Math.max(0, fieldWidth - inputVisLen);
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
      `${style.yellow("←→")} move`,
      `${style.yellow(`${optStr}←→`)} word`,
      `${style.yellow(optBs)} del word`,
      `${style.yellow("Tab")} regex${filterRegex ? style.green(" ✓") : ""}`,
      `${style.yellow("Shift+Tab")} target`,
      `${style.yellow("↵")} OK`,
      `${style.yellow("Esc")} cancel`,
    ].join("  ·  ");
    lines.push(style.dim(`${hintsIndent}${hints}`));

    filterBarLines = 2;
  } else if (filterPath) {
    const stats = buildFilterStats(groups, filterPath, filterTarget, filterRegex);
    const statsStr = style.dim(
      `${stats.visibleMatches} match${stats.visibleMatches !== 1 ? "es" : ""} in ${
        stats.visibleRepos
      } repo${stats.visibleRepos !== 1 ? "s" : ""} shown · ${
        stats.hiddenMatches
      } hidden in ${stats.hiddenRepos} repo${stats.hiddenRepos !== 1 ? "s" : ""}  r to reset`,
    );
    // Fix: clip so the filter status line never wraps — see issue #105.
    lines.push(
      clipToWidth(
        `🔍${targetBadge}${style.bold("filter:")} ${style.yellow(filterPath)}  ${statsStr}`,
        termWidth,
      ),
    );
    filterBarLines = 1;
  } else if (filterTarget !== "path" || filterRegex) {
    // No active filter text, but non-default mode selected — remind the user.
    lines.push(clipToWidth(`🔍${targetBadge}${style.dim("f to filter")}`, termWidth));
    filterBarLines = 1;
  }

  // Fix: clip hints to termWidth visible chars so the line never wraps — see issue #105.
  if (opts.repickMode?.active) {
    const dm = opts.repickMode;
    // Re-pick bar layout:
    //   "Re-pick: " | <scrollable candidate bar> | <padding> | "  0/u restore  ← → …"
    //
    // The candidate bar uses a sliding window (renderTeamPickHeader) so the
    // focused team is always visible regardless of how many teams exist.
    // The suffix is right-aligned by padding with spaces between the bar and
    // the suffix so the hints block always sits at the right terminal edge.
    const REPICK_PREFIX = "Re-pick: ";
    const REPICK_SUFFIX = "  0/u restore  ← → move  ↵ confirm  Esc/t cancel";
    const barWidth = Math.max(0, termWidth - REPICK_PREFIX.length - REPICK_SUFFIX.length);
    const bar = renderTeamPickHeader(dm.candidates, dm.focusedIndex, barWidth);
    const barPlain = stripAnsi(bar);
    // Pad between bar content and suffix to keep suffix right-aligned.
    // Use visibleWidth to account for CJK and multi-code-point graphemes.
    const padLen = Math.max(0, barWidth - visibleWidth(barPlain));
    const line = style.dim(REPICK_PREFIX) + bar + " ".repeat(padLen) + style.dim(REPICK_SUFFIX);
    lines.push(clipToWidth(line, termWidth) + "\n");
  } else if (opts.teamPickMode?.active) {
    const PICK_HINTS = `Pick team: ← / → move focus  ↵ confirm  Esc cancel`;
    const clippedPick = PICK_HINTS.length > termWidth ? PICK_HINTS.slice(0, termWidth) : PICK_HINTS;
    lines.push(style.dim(`${clippedPick}\n`));
  } else {
    const HINTS_TEXT =
      "← / → fold/unfold  Z fold-all  ↑ / ↓ navigate  gg/G top/bot  PgUp/Dn page  spc select  a all  n none  o open  f filter  t target/re-pick  p pick-team  h help  ↵ confirm  q quit";
    const clippedHints =
      HINTS_TEXT.length > termWidth ? HINTS_TEXT.slice(0, termWidth) : HINTS_TEXT;
    lines.push(style.dim(`${clippedHints}\n`));
  }

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
      const checkbox = g.repoSelected ? style.green("✓") : style.dim("✓");
      // Fix: clip to termWidth so the sticky line never wraps — see issue #105.
      stickyRepoLine = clipToWidth(
        `${style.dim(`▲ ${checkbox} `)}${style.style(["dim", "bold"], `${g.repoFullName} `)}${style.dim(
          buildMatchCountLabel(g),
        )}`,
        termWidth,
      );
      lines.push(stickyRepoLine);
    }
  }

  const viewportHeight =
    termHeight - HEADER_LINES - filterBarLines - 2 - (stickyRepoLine !== null ? 1 : 0);
  // Fix: clip fragment lines to termWidth minus the 3-level indent (INDENT*3 = 6 chars)
  // so that no fragment line wraps in the terminal. Without clipping, MAX_LINE_CHARS=120
  // produces lines up to 126 visible chars with indent, which wraps on typical terminals
  // (≤120 cols) and causes the rendered output to exceed termHeight — see issue #105.
  // The -1 accounts for the "…" appended by highlightFragment when a line is truncated.
  const FRAGMENT_INDENT = INDENT.length * 3; // 6 chars: "      "
  // Use Math.max(1, …) rather than Math.max(20, …) so that on very narrow terminals
  // (termWidth < FRAGMENT_INDENT + 1 + 20) the clamped floor of 20 can't exceed the
  // available width and still cause lines wider than termWidth — see review on #106.
  const fragmentMaxChars = Math.max(1, termWidth - FRAGMENT_INDENT - 1);
  let usedLines = 0;

  for (let i = scrollOffset; i < rows.length; i++) {
    const row = rows[i];

    // ── Section header row ────────────────────────────────────────────────
    if (row.type === "section") {
      const isActiveSectionCursor = i === cursor;
      // A section occupies 2 physical lines (blank separator + label) when it
      // follows other viewport content, but only 1 line (label only) when it
      // is the very first row rendered — see issue #105.
      const sectionCost = usedLines === 0 ? 1 : 2;
      if (sectionCost + usedLines > viewportHeight && usedLines > 0) break;
      // Fix: clip section label to termWidth so the label line never wraps.
      // "── " prefix is 3 visible chars + 1 trailing space = 4 chars total.
      const SECTION_FIXED = 4; // "── " (3) + trailing " " (1)
      const maxLabelChars = Math.max(0, termWidth - SECTION_FIXED);
      if (maxLabelChars === 0) {
        if (usedLines > 0) lines.push(""); // blank separator when not first
        lines.push(""); // empty label placeholder
        usedLines += sectionCost;
        if (usedLines >= viewportHeight) break;
        continue;
      }
      const label =
        row.sectionLabel.length > maxLabelChars
          ? row.sectionLabel.slice(0, maxLabelChars - 1) + "…"
          : row.sectionLabel;
      // Emit the blank separator only when there are rows above in the viewport.
      if (usedLines > 0) lines.push("");
      // Feat: team pick mode — show pick bar when active for this section — see issue #85.
      const pickMode = opts.teamPickMode;
      if (pickMode?.active && pickMode.sectionLabel === row.sectionLabel) {
        // Fix: clip pick bar to (termWidth - 3) so "── " + bar never wraps — see issue #121.
        const bar = renderTeamPickHeader(pickMode.candidates, pickMode.focusedIndex, termWidth - 3);
        lines.push(`${style.style(["magenta", "bold"], "── ")}${bar}`);
      } else if (isActiveSectionCursor) {
        const isMultiTeam = (row.sectionLabel ?? "").includes(" + ");
        if (isMultiTeam) {
          // Fix: reduce label budget when showing the hint so the combined line never wraps — see issue #121.
          const hintPlain = "  [p: pick team]";
          const maxCharsWithHint = Math.max(0, termWidth - SECTION_FIXED - hintPlain.length);
          const activeLabel =
            maxCharsWithHint === 0
              ? ""
              : row.sectionLabel.length > maxCharsWithHint
                ? row.sectionLabel.slice(0, Math.max(1, maxCharsWithHint - 1)) + "…"
                : row.sectionLabel;
          // Fix: clip the hint itself when it doesn't fit in the remaining space — see issue #121.
          const remainingWidth = termWidth - SECTION_FIXED - activeLabel.length;
          let hint = "";
          if (remainingWidth > 0) {
            if (hintPlain.length <= remainingWidth) {
              hint = hintPlain;
            } else if (remainingWidth === 1) {
              hint = "…";
            } else {
              hint = hintPlain.slice(0, remainingWidth - 1) + "…";
            }
          }
          lines.push(
            `${style.style(["bgMagenta", "bold"], `── ${activeLabel} `)}${hint ? style.dim(hint) : ""}`,
          );
        } else {
          lines.push(style.style(["bgMagenta", "bold"], `── ${label} `));
        }
      } else {
        lines.push(style.style(["magenta", "bold"], `── ${label} `));
      }
      usedLines += sectionCost;
      if (usedLines >= viewportHeight) break;
      continue;
    }

    const group = groups[row.repoIndex];
    const h = rowTerminalLines(group, row);

    if (usedLines + h > viewportHeight && usedLines > 0) break;

    const isCursor = i === cursor;

    if (row.type === "repo") {
      const arrow = group.folded ? style.magenta("▸") : style.magenta("▾");
      // Determine checkbox state: green if any extract is selected, dimmed if none are selected.
      // group.repoSelected is kept in sync with extracts via tui.ts and render/selection.ts,
      // so we can use it directly without recomputing.
      const checkbox = group.repoSelected ? style.green("✓") : style.dim("✓");
      // On cursor rows, use bold+white for the repo name (dark bg applied
      // to the whole line via renderActiveLine; no inline bgMagenta needed).
      // On inactive rows, use bright purple (same as the bar) in bold.
      const repoName = isCursor
        ? highlightText(group.repoFullName, "repo", (s) => style.style(["bold", "white"], s))
        : highlightText(
            group.repoFullName,
            "repo",
            (s) => `\x1b[38;5;129m${style.bold(s)}\x1b[39m`,
          );
      // ◈ badge — signals the repo was moved from a combined section via pick.
      // Future split mode will use this to identify pickable repos and add a hint.
      const pickedBadge = group.pickedFrom ? ` ${style.dim("◈")}` : "";
      // Use muted purple for the match count (both active and inactive rows).
      const count = `\x1b[38;5;99m${buildMatchCountLabel(group)}\x1b[39m`;
      // Right-align the match count flush to the terminal edge.
      // When active, subtract ACTIVE_BAR_WIDTH from padding so that
      // bar (1 char) + line content = termWidth total.
      const leftPartRaw = `${arrow} ${checkbox} ${repoName}${pickedBadge}`;
      const countLen = visibleWidth(count);
      const barAdjust = isCursor ? ACTIVE_BAR_WIDTH : 0;
      // Use Math.max(1, …) so that on very narrow terminals the floor of 1
      // never exceeds the available width (unlike Math.max(4, …) which can
      // produce a maxLeftVisible wider than the actual space and reintroduce
      // wrapping — see review on #106).
      const maxLeftVisible = Math.max(1, termWidth - countLen - barAdjust);
      const leftPart =
        visibleWidth(leftPartRaw) > maxLeftVisible
          ? clipToWidth(leftPartRaw, maxLeftVisible)
          : leftPartRaw;
      const leftLen = visibleWidth(leftPart);
      const pad = Math.max(0, termWidth - leftLen - countLen - barAdjust);
      const lineContent = pad > 0 ? `${leftPart}${" ".repeat(pad)}${count}` : `${leftPart}${count}`;
      lines.push(isCursor ? renderActiveLine(lineContent) : lineContent);
    } else {
      const ei = row.extractIndex!;
      const match = group.matches[ei];
      const selected = group.extractSelected[ei];
      const checkbox = selected ? style.green("✓") : style.dim("✓");
      const seg = match.textMatches[0]?.matches[0];
      const locSuffix = seg ? `:${seg.line}:${seg.col}` : "";
      // Active extract row: locSuffix uses bold+white (same as path) for
      // visual homogeneity. Inactive: dim to de-emphasise the coordinates.
      const styledLocSuffix = isCursor
        ? style.style(["bold", "white"], locSuffix)
        : style.dim(locSuffix);
      // Fix: clip the path to fit within termWidth — use the *actual* visible prefix
      // width for each render form rather than a shared PATH_INDENT constant.
      // Active:   ACTIVE_BAR_WIDTH (1) + "  " (2) + checkbox (1) + space (1) = 5
      // Inactive: "  " (2) + "  " (2) + checkbox (1) + space (1)            = 6
      // See issue #105 and review on #106 (previous code subtracted PATH_INDENT twice
      // for inactive rows, over-clipping by 4 chars).
      const prefixWidth = isCursor
        ? ACTIVE_BAR_WIDTH + INDENT.length + 1 + 1 // bar + "  " + checkbox + space = 5
        : INDENT.length * 2 + 1 + 1; // "  " + "  " + checkbox + space = 6
      // Use Math.max(1, …) so that on very narrow terminals the floor of 1
      // never exceeds the available width (unlike Math.max(10, …) which can
      // produce a maxPathVisible wider than termWidth - prefixWidth,
      // reintroducing line wrapping — see review on #106).
      const maxPathVisible = Math.max(1, termWidth - prefixWidth - locSuffix.length);
      const rawPath = isCursor
        ? `${highlightText(match.path, "path", (s) => style.style(["bold", "white"], s))}${styledLocSuffix}`
        : `${highlightText(match.path, "path", style.cyan)}${styledLocSuffix}`;
      const filePath =
        visibleWidth(rawPath) > maxPathVisible + locSuffix.length
          ? clipToWidth(rawPath, maxPathVisible + locSuffix.length)
          : rawPath;
      const extractLineContent = `${INDENT}${checkbox} ${filePath}`;
      lines.push(
        isCursor
          ? renderActiveLine(extractLineContent)
          : `${INDENT}${INDENT}${checkbox} ${filePath}`,
      );

      // Fix: render every fragment, not just textMatches[0] — see issue #74
      for (const tm of match.textMatches) {
        // When filtering by content, overlay the typed pattern on the fragment.
        const extraSegs =
          filterTarget === "content" && activeFilter
            ? contentPatternSegments(tm.fragment, activeFilter, filterRegex)
            : [];
        const fragmentLines = highlightFragment(
          tm.fragment,
          mergeSegments([...tm.matches, ...extraSegs]),
          match.path,
          fragmentMaxChars,
        );
        for (const fl of fragmentLines) {
          lines.push(`${INDENT}${INDENT}${INDENT}${fl}`);
        }
      }
    }

    usedLines += h;
    if (usedLines >= viewportHeight) break;
  }

  // Pad the unused viewport space so the position indicator is always fixed at
  // the bottom of the terminal. Without padding, when the rendered content is
  // shorter than viewportHeight (e.g. few results, many repos folded, or cursor
  // near the bottom of the list), the footer floats immediately after the last
  // item instead of staying at the bottom — see issue #105.
  // Each pushed "" contributes exactly 1 physical blank line in lines.join("\n").
  for (let i = usedLines; i < viewportHeight; i++) {
    lines.push("");
  }

  // Position indicator — uses cursor position so it always updates on every
  // navigation keystroke, regardless of whether scrollOffset changed.
  // The leading \n produces a blank separator between the viewport content and
  // the indicator (the separator is the last padding blank when full, or an
  // explicit extra blank here when viewport is full).
  if (rows.length > 0) {
    lines.push(style.dim(`\n  ↕ row ${cursor + 1} of ${rows.length}`));
  }

  return lines.join("\n");
}
