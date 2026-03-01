import type { CodeMatch, FilterTarget, RepoGroup } from "../types.ts";

// ─── Filter matchers ──────────────────────────────────────────────────────────

/**
 * Returns a function that tests a string against `pattern`.
 * - `regex = true`  → compiled as case-insensitive RegExp; invalid pattern → always false.
 * - `regex = false` → case-insensitive substring check.
 * - Empty `pattern` → always true.
 */
function makePatternTest(pattern: string, regex: boolean): (s: string) => boolean {
  if (!pattern) return () => true;
  if (regex) {
    try {
      const re = new RegExp(pattern, "i");
      return (s) => re.test(s);
    } catch {
      // Fix: invalid regex → no-match predicate so the TUI shows zero results without crashing.
      return () => false;
    }
  }
  const lower = pattern.toLowerCase();
  return (s) => s.toLowerCase().includes(lower);
}

/**
 * Returns a predicate that tests a `CodeMatch` against a filter pattern.
 * - `target === "path"`    → tests `match.path`
 * - `target === "content"` → tests any `TextMatch.fragment`
 */
export function makeExtractMatcher(
  pattern: string,
  target: Exclude<FilterTarget, "repo">,
  regex: boolean,
): (m: CodeMatch) => boolean {
  if (!pattern) return () => true;
  const test = makePatternTest(pattern, regex);
  if (target === "content") {
    return (m) => m.textMatches.some((tm) => test(tm.fragment));
  }
  return (m) => test(m.path);
}

/**
 * Returns a predicate that tests a `RepoGroup` against a filter pattern,
 * matching on `group.repoFullName` (e.g. `"org/my-service"`).
 */
export function makeRepoMatcher(pattern: string, regex: boolean): (g: RepoGroup) => boolean {
  if (!pattern) return () => true;
  const test = makePatternTest(pattern, regex);
  return (g) => test(g.repoFullName);
}
