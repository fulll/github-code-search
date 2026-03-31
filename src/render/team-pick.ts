import pc from "picocolors";

const SEP = "  ";

// Visible-char cost of the overflow ellipsis indicators.
// Left side:  "…" (1) + SEP before first windowed item (2) = 3
// Right side: SEP after last windowed item (2) + "…" (1)  = 3
const EL_LEFT = 1 + SEP.length; // 3
const EL_RIGHT = SEP.length + 1; // 3

/**
 * Renders a horizontal pick bar for team pick mode.
 *
 * The focused team is shown in bold + full colour (magenta); the others are
 * dimmed. Used as the section header content when team pick mode is active or
 * as the candidate list in the re-pick mode hints bar.
 *
 * When `maxWidth` is provided the bar is rendered with a **sliding window** so
 * that the focused team is always visible, regardless of how many other teams
 * are listed. Candidates hidden to the left of the window are indicated with a
 * leading `…`; candidates hidden to the right with a trailing `…` — like a
 * horizontal tab strip. The total visible width (ANSI codes excluded) never
 * exceeds `maxWidth`.
 *
 * Example output (focusedIndex = 0,
 *   candidates = ["squad-frontend", "squad-mobile"]):
 *
 *   [ squad-frontend ]  squad-mobile
 *
 * Example output when many candidates don't fit (focusedIndex = 2,
 *   maxWidth constrains to 3 teams):
 *
 *   …  squad-b  [ squad-c ]  squad-d  …
 */
export function renderTeamPickHeader(
  candidateTeams: string[],
  focusedIndex: number,
  maxWidth?: number,
): string {
  const n = candidateTeams.length;
  // Pre-compute visible text for each candidate (focused gets [ ] brackets).
  const texts = candidateTeams.map((t, i) => (i === focusedIndex ? `[ ${t} ]` : t));
  const widths = texts.map((t) => t.length);

  if (maxWidth === undefined) {
    // No width constraint — render all candidates.
    return texts
      .map(
        (text, i) =>
          (i > 0 ? SEP : "") + (i === focusedIndex ? pc.bold(pc.magenta(text)) : pc.dim(text)),
      )
      .join("");
  }

  if (maxWidth <= 0) return "";

  // If the focused item alone is wider than maxWidth, clip it.
  if (widths[focusedIndex] > maxWidth) {
    const clipped = texts[focusedIndex].slice(0, maxWidth - 1) + "…";
    return pc.bold(pc.magenta(clipped));
  }

  // ── Windowed rendering ────────────────────────────────────────────────────
  // Find the largest window [start, end] that contains focusedIndex and whose
  // total visible width — including overflow ellipsis indicators — fits within
  // maxWidth. Width model:
  //
  //   • items:        sum of widths[start..end] + (end-start) × SEP.length
  //   • left ellipsis ("…" + SEP before first item):  EL_LEFT  = 3  (when start > 0)
  //   • right ellipsis (SEP + "…" after last item):   EL_RIGHT = 3  (when end < n-1)
  //
  // Start with a single-item window at focusedIndex, then greedily expand
  // right then left until neither direction fits any more.

  let start = focusedIndex;
  let end = focusedIndex;
  let usedWidth = widths[focusedIndex]; // width of all items in [start,end] + inter-item SEPs

  const totalWidth = (s: number, e: number, itemsW: number): number =>
    itemsW + (s > 0 ? EL_LEFT : 0) + (e < n - 1 ? EL_RIGHT : 0);

  for (;;) {
    let expanded = false;
    // Try expanding right.
    if (end + 1 < n) {
      const addCost = SEP.length + widths[end + 1];
      if (totalWidth(start, end + 1, usedWidth + addCost) <= maxWidth) {
        usedWidth += addCost;
        end++;
        expanded = true;
      }
    }
    // Try expanding left.
    if (start > 0) {
      const addCost = widths[start - 1] + SEP.length;
      if (totalWidth(start - 1, end, usedWidth + addCost) <= maxWidth) {
        usedWidth += addCost;
        start--;
        expanded = true;
      }
    }
    if (!expanded) break;
  }

  // ── Build the bar string ──────────────────────────────────────────────────
  // Guard: only emit overflow ellipsis when the items + both ellipses actually
  // fit. In the edge case where the focused item fills maxWidth (leaving no
  // room for a 3-char ellipsis), omit the indicator rather than overflowing.
  const needed = totalWidth(start, end, usedWidth);
  const addLeftEl = start > 0 && needed <= maxWidth;
  const addRightEl = end < n - 1 && needed <= maxWidth;

  const parts: string[] = [];
  if (addLeftEl) parts.push(pc.dim("…"));
  for (let i = start; i <= end; i++) {
    if (i > start || addLeftEl) parts.push(SEP);
    parts.push(i === focusedIndex ? pc.bold(pc.magenta(texts[i])) : pc.dim(texts[i]));
  }
  if (addRightEl) parts.push(SEP + pc.dim("…"));

  return parts.join("");
}
