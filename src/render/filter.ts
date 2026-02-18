import type { RepoGroup } from "../types.ts";

// ─── Filter stats ─────────────────────────────────────────────────────────────

interface FilterStats {
  visibleRepos: number;
  hiddenRepos: number;
  visibleMatches: number;
  hiddenMatches: number;
}

/**
 * Given a confirmed filterPath, counts how many repos/matches are visible
 * (path contains the filter string) vs hidden.
 */
export function buildFilterStats(groups: RepoGroup[], filterPath: string): FilterStats {
  const filter = filterPath.toLowerCase();
  let visibleRepos = 0;
  let hiddenRepos = 0;
  let visibleMatches = 0;
  let hiddenMatches = 0;
  for (const g of groups) {
    const matching = g.matches.filter((m) => m.path.toLowerCase().includes(filter)).length;
    if (matching > 0) visibleRepos++;
    else hiddenRepos++;
    visibleMatches += matching;
    hiddenMatches += g.matches.length - matching;
  }
  return { visibleRepos, hiddenRepos, visibleMatches, hiddenMatches };
}
