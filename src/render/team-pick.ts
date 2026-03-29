import pc from "picocolors";

const SEP = "  ";

/**
 * Renders a horizontal pick bar for team pick mode.
 *
 * The focused team is shown in bold + full colour (magenta); the others are
 * dimmed. Used as the section header content when team pick mode is active.
 *
 * When `maxWidth` is provided the bar is clipped to that many visible
 * characters (ANSI codes do not count) and a "…" is appended when candidates
 * are omitted, so the line never wraps.
 *
 * Example output (focusedIndex = 0,
 *   candidates = ["squad-frontend", "squad-mobile"]):
 *
 *   [ squad-frontend ]  squad-mobile
 */
export function renderTeamPickHeader(
  candidateTeams: string[],
  focusedIndex: number,
  maxWidth?: number,
): string {
  const result: string[] = [];
  let visibleWidth = 0;

  for (let i = 0; i < candidateTeams.length; i++) {
    const team = candidateTeams[i];
    const visibleText = i === focusedIndex ? `[ ${team} ]` : team;
    const sep = i > 0 ? SEP : "";
    const cost = sep.length + visibleText.length;

    if (maxWidth !== undefined && visibleWidth + cost > maxWidth) {
      // Append "…" only if it fits within the remaining space.
      const ellipsisWidth = (i > 0 ? SEP.length : 0) + 1;
      if (visibleWidth + ellipsisWidth <= maxWidth) {
        result.push((i > 0 ? SEP : "") + "…");
      }
      break;
    }

    const ansi = i === focusedIndex ? pc.bold(pc.magenta(visibleText)) : pc.dim(visibleText);
    result.push(sep + ansi);
    visibleWidth += cost;
  }

  return result.join("");
}
