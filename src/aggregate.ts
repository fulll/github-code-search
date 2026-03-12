import type { CodeMatch, RepoGroup, TextMatch, TextMatchSegment } from "./types.ts";

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

// ─── Regex segment helper ────────────────────────────────────────────────────

/**
 * Run `regex` against `fragment` and return `TextMatchSegment[]` for every
 * match — replacing the API-provided segments (which point at the literal
 * search term) with the actual regex match positions.
 *
 * Line (1-based) and col (1-based) are computed from the fragment text so
 * that `highlightFragment` can map them to the correct terminal lines.
 */
function recomputeSegments(fragment: string, regex: RegExp): TextMatchSegment[] {
  // Force global flag so exec() advances; strip it first to avoid double-g
  const re = new RegExp(regex.source, regex.flags.replace("g", "") + "g");
  const segments: TextMatchSegment[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const before = fragment.slice(0, start);
    const nlIdx = before.lastIndexOf("\n");
    const line = (before.match(/\n/g)?.length ?? 0) + 1;
    const col = (nlIdx === -1 ? start : start - nlIdx - 1) + 1;
    segments.push({ text: m[0], indices: [start, end], line, col });
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width matches
  }
  return segments;
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
    // Fix: when a regex filter is active, replace each TextMatch's API-provided
    // segments (which point at the literal search term) with segments derived
    // from the actual regex match positions — see issue #111 / fix highlight bug
    let matchToAdd: CodeMatch = m;
    if (regexFilter != null) {
      // Preserve the caller's lastIndex: aggregate() must not have observable
      // side-effects on the passed-in RegExp instance.
      const savedLastIndex = regexFilter.lastIndex;
      const updatedTextMatches: TextMatch[] = m.textMatches
        .map((tm) => {
          const segs = recomputeSegments(tm.fragment, regexFilter);
          return segs.length > 0 ? { fragment: tm.fragment, matches: segs } : null;
        })
        .filter((tm): tm is TextMatch => tm !== null);
      // Restore the caller's original lastIndex (rather than hard-coding 0),
      // so aggregate() doesn't have observable side effects on its inputs.
      regexFilter.lastIndex = savedLastIndex;
      if (updatedTextMatches.length === 0) continue;
      matchToAdd = { ...m, textMatches: updatedTextMatches };
    }
    const list = map.get(m.repoFullName) ?? [];
    list.push(matchToAdd);
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
