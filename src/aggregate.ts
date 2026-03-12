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
  regexFilter?: RegExp | null,
): RepoGroup[] {
  const map = new Map<string, CodeMatch[]>();
  for (const m of matches) {
    if (excludedRepos.has(m.repoFullName)) continue;
    if (!includeArchived && m.archived) continue;
    // Fix: when a regex filter is active, only keep matches where at least one
    // text_match fragment satisfies the pattern — see issue #111
    if (regexFilter != null) {
      const hasMatch = m.textMatches.some((tm) => {
        // Fix: reset lastIndex before each call — a global/sticky regex is
        // stateful and would produce false negatives on subsequent fragments.
        regexFilter.lastIndex = 0;
        return regexFilter.test(tm.fragment);
      });
      // Fix: restore lastIndex to 0 so callers that reuse the same RegExp
      // instance don't observe a stale non-zero lastIndex after aggregate().
      regexFilter.lastIndex = 0;
      if (!hasMatch) continue;
    }
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
