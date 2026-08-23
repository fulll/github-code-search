// Hit-testing for mouse clicks in the TUI viewport.
// Maps clicked (x, y) coordinates to logical Row and action type.

import type { RepoGroup, Row } from "../types.ts";
import { rowTerminalLines } from "./rows.ts";

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
 *   - "fold" on repo rows: click lands on the ▸/▾ emoji (occupies columns 1-2 visually)
 *   - "select" on any row: click lands on the ✓ checkbox (occupies columns 4-5 on repo rows, columns 4-5 on extract rows)
 *   - "navigate" on any row: click elsewhere (just move cursor to that row)
 *
 * Note: Emojis like ▸, ▾, ✓ occupy 2 visual columns each when rendered in terminals.
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
    const h = rowTerminalLines(group, row);

    if (lineOffset <= clickedLineOffset && clickedLineOffset < lineOffset + h) {
      // This row was clicked
      // Determine action based on column position and row type
      let action: "fold" | "select" | "navigate" = "navigate";

      if (row.type === "repo") {
        // Repo row layout: "▸ ✓ repo-name"
        // Arrow emoji: columns 1-2 (occupies 2 visual columns)
        // Space: column 3
        // Checkbox emoji: columns 4-5 (occupies 2 visual columns)
        // Space: column 6
        // Repo name: columns 7+
        if (x >= 1 && x <= 2) {
          action = "fold";
        } else if (x >= 4 && x <= 5) {
          action = "select";
        }
      } else if (row.type === "extract") {
        // Extract row layout: "  ✓ path:line:col" (top line) or fragments
        // Indent: columns 1-2
        // Checkbox emoji: columns 4-5 (occupies 2 visual columns) on extract header line only
        // Entire row width (except fold zone cols 1-2) is clickable for selection in double-click mode
        if (clickedLineOffset === lineOffset && x >= 4 && x <= 5) {
          // Only the first line of an extract has a clickable checkbox
          action = "select";
        } else if (clickedLineOffset === lineOffset && x >= 6) {
          // Double-click anywhere on extract header line (except fold/indent zone) can toggle
          // For now, mark as selectable so double-click can work on full width
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
