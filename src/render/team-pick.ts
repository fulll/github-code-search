import pc from "picocolors";

/**
 * Renders a horizontal pick bar for team pick mode.
 *
 * The focused team is shown in bold + full colour (magenta); the others are
 * dimmed. Used as the section header content when team pick mode is active.
 *
 * Example output (focusedIndex = 0,
 *   candidates = ["squad-frontend", "squad-mobile"]):
 *
 *   [ squad-frontend ]  squad-mobile
 */
export function renderTeamPickHeader(candidateTeams: string[], focusedIndex: number): string {
  return candidateTeams
    .map((team, i) => (i === focusedIndex ? pc.bold(pc.magenta(`[ ${team} ]`)) : pc.dim(team)))
    .join("  ");
}
