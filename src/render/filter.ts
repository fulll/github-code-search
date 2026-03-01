import type { FilterTarget, RepoGroup } from "../types.ts";
import { makeExtractMatcher, makeRepoMatcher } from "./filter-match.ts";

// ─── Filter stats ─────────────────────────────────────────────────────────────

export interface FilterStats {
  visibleRepos: number;
  hiddenRepos: number;
  /** Number of matching CodeMatch entries (one per file-in-repo). */
  visibleMatches: number;
  hiddenMatches: number;
  /** Number of unique file paths among visible matches. */
  visibleFiles: number;
}

/**
 * Counts visible/hidden repos and matches according to the active filter.
 * Supports all filter targets (path, content, repo) and regex mode.
 */
export function buildFilterStats(
  groups: RepoGroup[],
  filterPath: string,
  filterTarget: FilterTarget = "path",
  filterRegex = false,
): FilterStats {
  let visibleRepos = 0;
  let hiddenRepos = 0;
  let visibleMatches = 0;
  let hiddenMatches = 0;
  // Collect visible file paths in the same pass to avoid recomputing matchers.
  const visibleFileSet = new Set<string>();

  if (filterTarget === "repo") {
    const repoMatcher = makeRepoMatcher(filterPath, filterRegex);
    for (const g of groups) {
      if (repoMatcher(g)) {
        visibleRepos++;
        visibleMatches += g.matches.length;
        for (const m of g.matches) visibleFileSet.add(m.path);
      } else {
        hiddenRepos++;
        hiddenMatches += g.matches.length;
      }
    }
  } else {
    const extractMatcher = makeExtractMatcher(
      filterPath,
      filterTarget as Exclude<FilterTarget, "repo">,
      filterRegex,
    );
    for (const g of groups) {
      const matching = g.matches.filter(extractMatcher);
      if (matching.length > 0) {
        visibleRepos++;
        for (const m of matching) visibleFileSet.add(m.path);
      } else {
        hiddenRepos++;
      }
      visibleMatches += matching.length;
      hiddenMatches += g.matches.length - matching.length;
    }
  }

  return {
    visibleRepos,
    hiddenRepos,
    visibleMatches,
    hiddenMatches,
    visibleFiles: visibleFileSet.size,
  };
}
