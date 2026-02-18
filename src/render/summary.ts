import pc from "picocolors";
import type { RepoGroup } from "../types.ts";

// ─── Match count label ────────────────────────────────────────────────────────

/**
 * Returns a label like "3 matches" or "3 matches, 1 selected" when some
 * extracts have been individually deselected.
 */
export function buildMatchCountLabel(group: RepoGroup): string {
  const total = group.matches.length;
  const selected = group.extractSelected.filter(Boolean).length;
  const matchWord = `${total} match${total !== 1 ? "es" : ""}`;
  if (selected < total) {
    return `${matchWord}, ${selected} selected`;
  }
  return matchWord;
}

// ─── File-count helpers ───────────────────────────────────────────────────────

/**
 * Counts unique file paths across a group list.
 * A path like `src/config.ts` present in three repos counts as ONE file.
 */
function countUniquePaths(groups: RepoGroup[]): number {
  return new Set(groups.flatMap((g) => g.matches.map((m) => m.path))).size;
}

/**
 * Counts unique file paths that are currently selected (at least one repo
 * has that path selected).
 */
function countSelectedUniquePaths(groups: RepoGroup[]): number {
  return new Set(
    groups.flatMap((g) => g.matches.filter((_, i) => g.extractSelected[i]).map((m) => m.path)),
  ).size;
}

// ─── Summary stats ────────────────────────────────────────────────────────────

/** Compact repo + file + match counts (no selection detail). */
export function buildSummary(groups: RepoGroup[]): string {
  const repoCount = groups.length;
  const fileCount = countUniquePaths(groups);
  const matchCount = groups.reduce((sum, g) => sum + g.matches.length, 0);
  const repoStr = `${repoCount} repo${repoCount !== 1 ? "s" : ""}`;
  const fileStr = `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
  const matchStr = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
  // Only show the matches segment when files ≠ matches (cross-repo duplicates)
  return pc.dim(
    matchCount === fileCount ? `${repoStr} · ${fileStr}` : `${repoStr} · ${fileStr} · ${matchStr}`,
  );
}

/**
 * Like buildSummary but annotates with selected counts when not everything
 * is selected. Used in the TUI header.
 */
export function buildSummaryFull(groups: RepoGroup[]): string {
  const totalRepos = groups.length;
  const selectedRepos = groups.filter((g) => g.repoSelected).length;

  const totalFiles = countUniquePaths(groups);
  const selectedFiles = countSelectedUniquePaths(groups);

  const totalMatches = groups.reduce((sum, g) => sum + g.matches.length, 0);
  const selectedMatches = groups.reduce(
    (sum, g) => sum + g.extractSelected.filter(Boolean).length,
    0,
  );

  const repoStr =
    selectedRepos < totalRepos
      ? `${totalRepos} repo${totalRepos !== 1 ? "s" : ""} (${selectedRepos} selected)`
      : `${totalRepos} repo${totalRepos !== 1 ? "s" : ""}`;

  const fileStr =
    selectedFiles < totalFiles
      ? `${totalFiles} file${totalFiles !== 1 ? "s" : ""} (${selectedFiles} selected)`
      : `${totalFiles} file${totalFiles !== 1 ? "s" : ""}`;

  const matchStr =
    selectedMatches < totalMatches
      ? `${totalMatches} match${totalMatches !== 1 ? "es" : ""} (${selectedMatches} selected)`
      : `${totalMatches} match${totalMatches !== 1 ? "es" : ""}`;

  // Only add the matches segment when it differs from files (cross-repo duplicates)
  return pc.dim(
    totalMatches === totalFiles
      ? `${repoStr} · ${fileStr}`
      : `${repoStr} · ${fileStr} · ${matchStr}`,
  );
}

/**
 * Plain-text summary of the current selection, used as a header in
 * non-interactive output (markdown / JSON).
 */
export function buildSelectionSummary(groups: RepoGroup[]): string {
  const selectedRepos = groups.filter((g) => g.repoSelected).length;
  const selectedFiles = countSelectedUniquePaths(groups);
  const selectedMatches = groups.reduce(
    (sum, g) => sum + g.extractSelected.filter(Boolean).length,
    0,
  );
  const repoStr = `${selectedRepos} repo${selectedRepos !== 1 ? "s" : ""}`;
  const fileStr = `${selectedFiles} file${selectedFiles !== 1 ? "s" : ""}`;
  const matchStr = `${selectedMatches} match${selectedMatches !== 1 ? "es" : ""}`;
  // Only add the matches segment when files ≠ matches (cross-repo duplicates)
  return selectedMatches === selectedFiles
    ? `${repoStr} · ${fileStr} selected`
    : `${repoStr} · ${fileStr} · ${matchStr} selected`;
}
