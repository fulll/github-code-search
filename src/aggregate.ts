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
 * `fragmentStartLine` is the 1-based absolute file line where the fragment
 * starts (derived from the existing API segments or falling back to 1). It is
 * used to produce absolute `line` values that match those stored by the API
 * path so that `output.ts` generates correct `#L{line}` GitHub anchors.
 */
function recomputeSegments(
  fragment: string,
  re: RegExp,
  fragmentStartLine: number,
): TextMatchSegment[] {
  // Reset lastIndex so exec() always searches from the start of the fragment.
  // The caller is responsible for providing a global (g) regex constructed once
  // per aggregate() call — not recompiled per fragment.
  re.lastIndex = 0;
  // Precompute newline positions once — O(n) — so per-match line/col lookup
  // is O(log n) via binary search instead of O(n) per match (O(n²) overall).
  const newlines: number[] = [];
  for (let i = 0; i < fragment.length; i++) {
    if (fragment[i] === "\n") newlines.push(i);
  }
  const segments: TextMatchSegment[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    // Binary-search for the number of newlines before `start`.
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < start) lo = mid + 1;
      else hi = mid;
    }
    // `lo` = number of fragment-local lines before `start` (0-based offset).
    // Add `fragmentStartLine - 1` to make it absolute.
    const line = fragmentStartLine + lo;
    const col = (lo === 0 ? start : start - newlines[lo - 1] - 1) + 1; // 1-based
    segments.push({ text: m[0], indices: [start, end], line, col });
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width matches
  }
  return segments;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Extracts a small multi-line window of `content` around the 1-based line
 * `matchLine`, mirroring the size of context GitHub's own fragment field
 * typically provides. Used to build a display-friendly fallback `TextMatch`
 * when the API-provided fragment does not contain a match but the full
 * downloaded file content does — see issue #148.
 */
function sliceContextWindow(
  content: string,
  matchLine: number,
  contextLines = 2,
): { fragment: string; fragmentStartLine: number } {
  const lines = content.split("\n");
  const startLine = Math.max(1, matchLine - contextLines);
  const endLine = Math.min(lines.length, matchLine + contextLines);
  return {
    fragment: lines.slice(startLine - 1, endLine).join("\n"),
    fragmentStartLine: startLine,
  };
}

/**
 * Finds the 1-based line numbers where `re` matches within `content`.
 * `re` must be a global RegExp; its `lastIndex` is reset before use.
 */
function findMatchLines(content: string, re: RegExp): Set<number> {
  re.lastIndex = 0;
  const lines = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    lines.add((before.match(/\n/g)?.length ?? 0) + 1);
    if (m[0].length === 0) re.lastIndex++;
  }
  return lines;
}

export function aggregate(
  matches: CodeMatch[],
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  includeArchived = false,
  regexFilter?: RegExp | null,
  excludeTemplates = false,
): RepoGroup[] {
  // Compile the global regex once per aggregate() call rather than once per
  // fragment inside recomputeSegments — avoids repeated RegExp construction
  // on large result sets.  Strip g and y first to prevent double-flag and
  // sticky-mode issues; recomputeSegments resets lastIndex per call.
  const globalRe = regexFilter
    ? new RegExp(regexFilter.source, regexFilter.flags.replace(/[gy]/g, "") + "g")
    : null;
  const map = new Map<string, CodeMatch[]>();
  for (const m of matches) {
    if (excludedRepos.has(m.repoFullName)) continue;
    if (!includeArchived && m.archived) continue;
    if (excludeTemplates && m.isTemplate === true) continue;
    // Fix: when a regex filter is active, replace each TextMatch's API-provided
    // segments (which point at the literal search term) with segments derived
    // from the actual regex match positions — see issue #111 / fix highlight bug
    let matchToAdd: CodeMatch = m;
    if (globalRe != null) {
      // Preserve the caller's lastIndex: aggregate() must not have observable
      // side-effects on the passed-in RegExp instance.
      const savedLastIndex = regexFilter!.lastIndex;
      let updatedTextMatches: TextMatch[] = m.textMatches
        .map((tm) => {
          // Derive the absolute start line of this fragment from the first API
          // segment. If no API segment is available, fall back to 1 so that
          // recomputeSegments emits fragment-relative lines (which equal
          // absolute lines when the fragment starts at line 1).
          let fragmentStartLine = 1;
          const firstApiSeg = tm.matches[0];
          if (firstApiSeg) {
            const before = tm.fragment.slice(0, firstApiSeg.indices[0]);
            const fragLine = (before.match(/\n/g)?.length ?? 0) + 1;
            fragmentStartLine = firstApiSeg.line - fragLine + 1;
          }
          const segs = recomputeSegments(tm.fragment, globalRe, fragmentStartLine);
          return segs.length > 0 ? { fragment: tm.fragment, matches: segs } : null;
        })
        .filter((tm): tm is TextMatch => tm !== null);
      // Fix: fall back to the full downloaded file content when none of the
      // API-provided fragments contain a match — the API fragment can be too
      // narrow to include the whole regex match even though the file does
      // contain it, silently dropping otherwise-valid results — see issue #148.
      if (updatedTextMatches.length === 0 && m.fileContent) {
        const fileContent = m.fileContent;
        updatedTextMatches = [...findMatchLines(fileContent, globalRe)]
          .map((matchLine) => {
            const { fragment, fragmentStartLine } = sliceContextWindow(fileContent, matchLine);
            const segs = recomputeSegments(fragment, globalRe, fragmentStartLine);
            return segs.length > 0 ? { fragment, matches: segs } : null;
          })
          .filter((tm): tm is TextMatch => tm !== null);
      }
      // Restore the caller's original lastIndex (rather than hard-coding 0),
      // so aggregate() doesn't have observable side effects on its inputs.
      regexFilter!.lastIndex = savedLastIndex;
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
