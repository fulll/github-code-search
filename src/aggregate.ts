import type { CodeMatch, RepoGroup } from "./types.ts";

// ─── Normalisation helpers ────────────────────────────────────────────────────

/** Normalise a repo name: if it already contains a "/", keep it as-is,
 *  otherwise prepend the org. */
export function normaliseRepo(org: string, raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("/") ? trimmed : `${org}/${trimmed}`;
}

/**
 * Extract ref format (short):   "repoName:filePath:matchIndex"
 * Extract ref format (full):    "org/repoName:filePath:matchIndex"
 * We normalise at parse time.
 */
export function normaliseExtractRef(org: string, raw: string): string {
  const trimmed = raw.trim();
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) return trimmed;
  const repoPart = trimmed.slice(0, colonIdx);
  const rest = trimmed.slice(colonIdx); // keeps the leading ":"
  return normaliseRepo(org, repoPart) + rest;
}

export function extractRef(repoFullName: string, path: string, matchIndex: number): string {
  return `${repoFullName}:${path}:${matchIndex}`;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export function aggregate(
  matches: CodeMatch[],
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  includeArchived = false,
): RepoGroup[] {
  const map = new Map<string, CodeMatch[]>();
  for (const m of matches) {
    if (excludedRepos.has(m.repoFullName)) continue;
    if (!includeArchived && m.archived) continue;
    const list = map.get(m.repoFullName) ?? [];
    list.push(m);
    map.set(m.repoFullName, list);
  }

  return Array.from(map.entries()).map(([repoFullName, repoMatches]) => {
    const filteredMatches = repoMatches.filter((m, i) => {
      const ref = extractRef(repoFullName, m.path, i);
      return !excludedExtractRefs.has(ref);
    });
    return {
      repoFullName,
      matches: filteredMatches,
      folded: true,
      repoSelected: true,
      extractSelected: filteredMatches.map(() => true),
    };
  });
}
