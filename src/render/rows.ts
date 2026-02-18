import type { RepoGroup, Row } from "../types.ts";
import { MAX_FRAGMENT_LINES } from "./highlight.ts";

// ─── Row helpers ──────────────────────────────────────────────────────────────

/** Number of terminal lines a single logical row occupies when rendered. */
export function rowTerminalLines(group: RepoGroup | undefined, row: Row): number {
  if (row.type === "section") return 2; // blank separator line + label line
  if (row.type === "repo") return 1;
  const match = group!.matches[row.extractIndex!];
  if (match.textMatches.length === 0) return 1;
  // 1 line for the file path + N lines for the fragment
  const rawLines = match.textMatches[0].fragment.split("\n");
  return 1 + Math.min(rawLines.length, MAX_FRAGMENT_LINES + 1); // +1 for potential "more" line
}

/**
 * Build the flat list of rows from a group array, optionally filtered by a
 * case-insensitive path substring. Repos with no visible extracts are omitted
 * when a filter is active.
 *
 * When a `RepoGroup` has a `sectionLabel` field, a preceding `"section"` row
 * is emitted so the TUI and viewport logic can handle it uniformly.
 */
export function buildRows(groups: RepoGroup[], filterPath = ""): Row[] {
  const filter = filterPath.toLowerCase();
  const rows: Row[] = [];
  for (let ri = 0; ri < groups.length; ri++) {
    const group = groups[ri];
    const visibleExtractIndices = group.matches
      .map((m, i) => (!filter || m.path.toLowerCase().includes(filter) ? i : -1))
      .filter((i) => i !== -1);
    if (filter && visibleExtractIndices.length === 0) continue;

    // Emit a section-header row when this group starts a new section
    if (group.sectionLabel !== undefined) {
      rows.push({
        type: "section",
        repoIndex: -1,
        sectionLabel: group.sectionLabel,
      });
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

/** Returns true if the cursor row is currently within the visible viewport. */
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
    if (i === cursor) return true;
    const row = rows[i];
    const group = row.repoIndex >= 0 ? groups[row.repoIndex] : undefined;
    usedLines += rowTerminalLines(group, row);
  }
  return false;
}
