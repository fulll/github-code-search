// Hit-testing for mouse clicks in the TUI viewport.
// Maps clicked (x, y) coordinates to logical Row and action type.

import type { RepoGroup, Row } from "../types.ts";
import { rowTerminalLines } from "./rows.ts";
import { isClickInFoldZone, isClickInCheckboxZone, isClickInNavZone } from "./layout-constants.ts";

export interface ClickTarget {
  row: Row;
  column: number; // Column index within the row (0-based terminal position)
  action: "fold" | "select" | "navigate";
}

/**
 * Hit-test a mouse click against the rendered rows.
 *
 * Returns a ClickTarget if the click lands on a valid row; null if out of bounds.
 * Coordinates (x, y) are 1-indexed (terminal convention, per SGR mouse protocol).
 * headerLines: number of header lines before the first row (position indicator + filter bar).
 *
 * Actions:
 *   - "fold": click lands on the ▸/▾ emoji (repo rows only)
 *   - "select": click lands on the ✓ checkbox (repo or extract rows)
 *   - "navigate": click elsewhere (move cursor to that row)
 */
export function hitTestClick(
  groups: RepoGroup[],
  rows: Row[],
  scrollOffset: number,
  x: number,
  y: number,
  headerLines: number = 0,
): ClickTarget | null {
  // Convert 1-indexed terminal coordinates to 0-indexed offset within visible rows,
  // accounting for header lines (filter bar, position indicator)
  const clickedLineOffset = y - 1 - headerLines;
  if (clickedLineOffset < 0) return null;

  // Calculate cumulative line heights to find which row was clicked
  // Iterate only through visible rows (starting from scrollOffset)
  let lineOffset = 0;
  for (let i = scrollOffset; i < rows.length; i++) {
    const row = rows[i];
    const group = groups[row.repoIndex] ?? undefined;

    // Calculate row height, mirroring renderGroups logic for sections:
    // - First row (lineOffset === 0 for sections): 1 line (label only, no blank separator)
    // - Subsequent section rows: 2 lines (blank separator + label)
    // - Repos and extracts: use rowTerminalLines
    let h: number;
    if (row.type === "section") {
      h = lineOffset === 0 ? 1 : 2;
    } else {
      h = rowTerminalLines(group, row);
    }

    if (lineOffset <= clickedLineOffset && clickedLineOffset < lineOffset + h) {
      // This row was clicked
      // Determine action based on column position and row type
      let action: "fold" | "select" | "navigate" = "navigate";

      if (row.type === "repo") {
        // Repo row layout: "▸ ✓ repo-name"
        if (isClickInFoldZone(x)) {
          action = "fold";
        } else if (isClickInCheckboxZone(x)) {
          action = "select";
        }
      } else if (row.type === "extract") {
        // Extract row layout: "  ✓ path:line:col" (top line) or fragments
        // On the extract header line, double-click from checkbox onwards is select
        if (clickedLineOffset === lineOffset && isClickInCheckboxZone(x)) {
          action = "select";
        }
      }
      // Section rows don't support any action (just navigate)

      return { row, column: x, action };
    }

    lineOffset += h;
  }

  return null;
}
