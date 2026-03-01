import type { FilterTarget, RepoGroup, Row } from "../types.ts";
import { makeExtractMatcher, makeRepoMatcher } from "./filter-match.ts";

// ─── Selection mutations ──────────────────────────────────────────────────────

/**
 * Select all repos+extracts (repo row context) or all extracts in the current
 * repo (extract row context), respecting the active filter.
 * Mutates groups in-place.
 */
export function applySelectAll(
  groups: RepoGroup[],
  contextRow: Row,
  filterPath = "",
  filterTarget: FilterTarget = "path",
  filterRegex = false,
): void {
  if (filterTarget === "repo") {
    const repoMatcher = makeRepoMatcher(filterPath, filterRegex);
    if (contextRow.type === "repo") {
      for (const g of groups) {
        if (!repoMatcher(g)) continue;
        g.repoSelected = true;
        g.extractSelected.fill(true);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      if (repoMatcher(g)) {
        g.repoSelected = true;
        g.extractSelected.fill(true);
      }
    }
    return;
  }

  if (filterPath) {
    const extractMatcher = makeExtractMatcher(
      filterPath,
      filterTarget as Exclude<FilterTarget, "repo">,
      filterRegex,
    );
    if (contextRow.type === "repo") {
      for (const g of groups) {
        if (!g.matches.some(extractMatcher)) continue;
        g.matches.forEach((m, i) => {
          if (extractMatcher(m)) g.extractSelected[i] = true;
        });
        g.repoSelected = g.extractSelected.some(Boolean);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      g.matches.forEach((m, i) => {
        if (extractMatcher(m)) g.extractSelected[i] = true;
      });
      g.repoSelected = g.extractSelected.some(Boolean);
    }
  } else {
    if (contextRow.type === "repo") {
      for (const g of groups) {
        g.repoSelected = true;
        g.extractSelected.fill(true);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      g.repoSelected = true;
      g.extractSelected.fill(true);
    }
  }
}

/**
 * Deselect all repos+extracts (repo row context) or all extracts in the
 * current repo (extract row context), respecting the active filter.
 * Mutates groups in-place.
 */
export function applySelectNone(
  groups: RepoGroup[],
  contextRow: Row,
  filterPath = "",
  filterTarget: FilterTarget = "path",
  filterRegex = false,
): void {
  if (filterTarget === "repo") {
    const repoMatcher = makeRepoMatcher(filterPath, filterRegex);
    if (contextRow.type === "repo") {
      for (const g of groups) {
        if (!repoMatcher(g)) continue;
        g.repoSelected = false;
        g.extractSelected.fill(false);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      if (repoMatcher(g)) {
        g.repoSelected = false;
        g.extractSelected.fill(false);
      }
    }
    return;
  }

  if (filterPath) {
    const extractMatcher = makeExtractMatcher(
      filterPath,
      filterTarget as Exclude<FilterTarget, "repo">,
      filterRegex,
    );
    if (contextRow.type === "repo") {
      for (const g of groups) {
        if (!g.matches.some(extractMatcher)) continue;
        g.matches.forEach((m, i) => {
          if (extractMatcher(m)) g.extractSelected[i] = false;
        });
        g.repoSelected = g.extractSelected.some(Boolean);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      g.matches.forEach((m, i) => {
        if (extractMatcher(m)) g.extractSelected[i] = false;
      });
      g.repoSelected = g.extractSelected.some(Boolean);
    }
  } else {
    if (contextRow.type === "repo") {
      for (const g of groups) {
        g.repoSelected = false;
        g.extractSelected.fill(false);
      }
    } else {
      const g = groups[contextRow.repoIndex];
      g.repoSelected = false;
      g.extractSelected.fill(false);
    }
  }
}
