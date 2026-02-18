import type { RepoGroup, Row } from "../types.ts";

// ─── Selection mutations ──────────────────────────────────────────────────────

/**
 * Select all repos+extracts (repo row context) or all extracts in the current
 * repo (extract row context), respecting an optional file-path filter.
 * Mutates groups in-place.
 */
export function applySelectAll(groups: RepoGroup[], contextRow: Row, filterPath = ""): void {
  const filter = filterPath.toLowerCase();
  if (contextRow.type === "repo") {
    for (const g of groups) {
      if (filter) {
        const anyMatch = g.matches.some((m) => m.path.toLowerCase().includes(filter));
        if (!anyMatch) continue;
        g.matches.forEach((m, i) => {
          if (m.path.toLowerCase().includes(filter)) g.extractSelected[i] = true;
        });
        g.repoSelected = g.extractSelected.some(Boolean);
      } else {
        g.repoSelected = true;
        g.extractSelected.fill(true);
      }
    }
  } else {
    const g = groups[contextRow.repoIndex];
    if (filter) {
      g.matches.forEach((m, i) => {
        if (m.path.toLowerCase().includes(filter)) g.extractSelected[i] = true;
      });
      g.repoSelected = g.extractSelected.some(Boolean);
    } else {
      g.repoSelected = true;
      g.extractSelected.fill(true);
    }
  }
}

/**
 * Deselect all repos+extracts (repo row context) or all extracts in the
 * current repo (extract row context), respecting an optional file-path filter.
 * Mutates groups in-place.
 */
export function applySelectNone(groups: RepoGroup[], contextRow: Row, filterPath = ""): void {
  const filter = filterPath.toLowerCase();
  if (contextRow.type === "repo") {
    for (const g of groups) {
      if (filter) {
        const anyMatch = g.matches.some((m) => m.path.toLowerCase().includes(filter));
        if (!anyMatch) continue;
        g.matches.forEach((m, i) => {
          if (m.path.toLowerCase().includes(filter)) g.extractSelected[i] = false;
        });
        g.repoSelected = g.extractSelected.some(Boolean);
      } else {
        g.repoSelected = false;
        g.extractSelected.fill(false);
      }
    }
  } else {
    const g = groups[contextRow.repoIndex];
    if (filter) {
      g.matches.forEach((m, i) => {
        if (m.path.toLowerCase().includes(filter)) g.extractSelected[i] = false;
      });
      g.repoSelected = g.extractSelected.some(Boolean);
    } else {
      g.repoSelected = false;
      g.extractSelected.fill(false);
    }
  }
}
