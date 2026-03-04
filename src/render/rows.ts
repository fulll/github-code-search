import type { FilterTarget, RepoGroup, Row } from "../types.ts";
import { MAX_FRAGMENT_LINES } from "./highlight.ts";
import { makeExtractMatcher, makeRepoMatcher } from "./filter-match.ts";

// ─── Row helpers ──────────────────────────────────────────────────────────────

/** Number of terminal lines a single logical row occupies when rendered. */
export function rowTerminalLines(group: RepoGroup | undefined, row: Row): number {
  if (row.type === "section") return 2; // blank separator line + label line
  if (row.type === "repo") return 1;
  const match = group!.matches[row.extractIndex!];
  if (match.textMatches.length === 0) return 1;
  // Fix: sum lines for every fragment, not just textMatches[0] — see issue #74
  // 1 line for the file path + N lines per fragment
  let total = 1;
  for (const tm of match.textMatches) {
    const rawLines = tm.fragment.split("\n");
    total += Math.min(rawLines.length, MAX_FRAGMENT_LINES + 1); // +1 for potential "more" line
  }
  return total;
}

/**
 * Build the flat list of rows from a group array, optionally filtered.
 *
 * - `filterTarget === "path"` (default) — case-insensitive substring/regex on file path.
 * - `filterTarget === "content"` — matches against code fragment text.
 * - `filterTarget === "repo"` — matches on the repository full name; the entire
 *   repo is shown or hidden as a unit (all its extracts remain visible).
 *
 * When `filterRegex` is true the pattern is treated as a case-insensitive RegExp.
 * An invalid regex produces zero results without throwing.
 */
export function buildRows(
  groups: RepoGroup[],
  filterPath = "",
  filterTarget: FilterTarget = "path",
  filterRegex = false,
): Row[] {
  const rows: Row[] = [];

  if (filterTarget === "repo") {
    const repoMatcher = makeRepoMatcher(filterPath, filterRegex);
    let pendingSectionLabel: string | undefined;
    let lastEmittedSectionLabel: string | undefined;
    for (let ri = 0; ri < groups.length; ri++) {
      const group = groups[ri];
      // Track the most recent section boundary so we can emit it even when the
      // first repo of a section is filtered out.
      if (group.sectionLabel !== undefined) pendingSectionLabel = group.sectionLabel;
      if (!repoMatcher(group)) continue;
      const sectionToEmit = group.sectionLabel ?? pendingSectionLabel;
      if (sectionToEmit !== undefined && sectionToEmit !== lastEmittedSectionLabel) {
        rows.push({ type: "section", repoIndex: -1, sectionLabel: sectionToEmit });
        lastEmittedSectionLabel = sectionToEmit;
      }
      rows.push({ type: "repo", repoIndex: ri });
      if (!group.folded) {
        group.matches.forEach((_, ei) => {
          rows.push({ type: "extract", repoIndex: ri, extractIndex: ei });
        });
      }
    }
    return rows;
  }

  const extractMatcher = makeExtractMatcher(
    filterPath,
    filterTarget as Exclude<FilterTarget, "repo">,
    filterRegex,
  );
  let pendingSectionLabel: string | undefined;
  let lastEmittedSectionLabel: string | undefined;
  for (let ri = 0; ri < groups.length; ri++) {
    const group = groups[ri];
    if (group.sectionLabel !== undefined) pendingSectionLabel = group.sectionLabel;
    const visibleExtractIndices = group.matches
      .map((m, i) => (extractMatcher(m) ? i : -1))
      .filter((i) => i !== -1);
    if (filterPath && visibleExtractIndices.length === 0) continue;

    const sectionToEmit = group.sectionLabel ?? pendingSectionLabel;
    if (sectionToEmit !== undefined && sectionToEmit !== lastEmittedSectionLabel) {
      rows.push({ type: "section", repoIndex: -1, sectionLabel: sectionToEmit });
      lastEmittedSectionLabel = sectionToEmit;
    }
    rows.push({ type: "repo", repoIndex: ri });
    if (!group.folded) {
      for (const ei of visibleExtractIndices) {
        rows.push({ type: "extract", repoIndex: ri, extractIndex: ei });
      }
    }
  }
  return rows;
}

/** Returns true if the cursor row is currently within the visible viewport.
 *
 * Mirrors the renderGroups break condition exactly:
 *   a row renders only if `usedLines === 0 || usedLines + h <= viewportHeight`.
 * Without this check a multi-line cursor row (fragment extract) can appear
 * "visible" to the scroll adjuster while renderGroups would break before it.
 */
export function isCursorVisible(
  rows: Row[],
  groups: RepoGroup[],
  cursor: number,
  scrollOffset: number,
  viewportHeight: number,
): boolean {
  let usedLines = 0;
  for (let i = scrollOffset; i < rows.length; i++) {
    if (usedLines >= viewportHeight) return false;
    const row = rows[i];
    const group = row.repoIndex >= 0 ? groups[row.repoIndex] : undefined;
    const h = rowTerminalLines(group, row);
    if (i === cursor) {
      // The row is visible only if it actually fits in the remaining space
      // (same rule as renderGroups: first row always shows, others need room).
      return usedLines === 0 || usedLines + h <= viewportHeight;
    }
    usedLines += h;
  }
  return false;
}
