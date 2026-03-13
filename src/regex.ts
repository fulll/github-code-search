// ─── Regex query helpers ──────────────────────────────────────────────────────
//
// The GitHub REST API (/search/code) does not support /pattern/ regex syntax.
// These helpers detect regex queries, derive a safe literal term to send to the
// API (casting a wide net), and return a compiled RegExp for local post-filtering.

/**
 * Returns true if `q` contains a `/pattern/` or `/pattern/flags` token.
 * A leading qualifier like `filename:package.json /regex/` is also matched.
 */
export function isRegexQuery(q: string): boolean {
  return extractRegexToken(q) !== null;
}

/**
 * Given a raw query string (possibly mixing GitHub qualifiers and a /regex/flags
 * token), returns:
 *
 * - `apiQuery`    — the query safe to send to the GitHub REST API
 * - `regexFilter` — the compiled RegExp to apply locally on `TextMatch.fragment`
 * - `warn`        — set when no exploitable literal term could be extracted;
 *                   the caller should require `--regex-hint` before proceeding.
 *
 * When `q` contains no regex token the input is returned unchanged and
 * `regexFilter` is `null`.
 */
export function buildApiQuery(q: string): {
  apiQuery: string;
  regexFilter: RegExp | null;
  warn?: string;
} {
  const token = extractRegexToken(q);

  // Plain-text query — nothing to do.
  if (token === null) {
    return { apiQuery: q, regexFilter: null };
  }

  // Compile the regex. Strip stateful flags:
  //   g (global)  — GitHub returns at most a few fragments, not all occurrences.
  //   y (sticky)  — makes RegExp.test() stateful via lastIndex, causing false
  //                 negatives when the same instance is reused across fragments.
  // Both are intentionally removed; all other flags (i, m, s, d, v, …) are kept.
  const { pattern, flags, raw, index } = token;
  const safeFlags = flags.replace(/[gy]/g, "");
  let regexFilter: RegExp | null = null;
  try {
    regexFilter = new RegExp(pattern, safeFlags);
  } catch (err) {
    // Fix: invalid regex — warn with the engine's own error message so callers
    // can surface a precise reason (e.g. invalid flags vs bad syntax).
    const reason = err instanceof Error ? err.message : String(err);
    return {
      apiQuery: "",
      regexFilter: null,
      warn: `Invalid regex /${pattern}/${flags}: ${reason}`,
    };
  }

  // Derive the API search term from the regex pattern.
  const { term, warn } = extractApiTerm(pattern);

  // Rebuild the API query by splicing the derived term at the exact byte
  // position of the matched token. Using q.replace(raw, term) would replace the
  // first *substring* occurrence of `raw`, which may appear earlier in the query
  // as a non-token prefix (e.g. inside a longer word). Using the stored index
  // guarantees we replace only the boundary-validated token that was matched.
  const apiQuery = (q.slice(0, index) + term + q.slice(index + raw.length)).trim();

  return { apiQuery, regexFilter, warn };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface RegexToken {
  /** Raw string as it appears in the query, e.g. "/from.*axios/i" */
  raw: string;
  /** Pattern string without delimiters */
  pattern: string;
  /** Flags string (may be empty) */
  flags: string;
  /** Start index of `raw` within the original query string. */
  index: number;
}

/**
 * Extracts the first `/pattern/flags` token from a query string.
 * Returns `null` when no regex token is found.
 */
function extractRegexToken(q: string): RegexToken | null {
  // Match /pattern/flags where:
  //   - the pattern is a non-empty sequence that doesn't contain an unescaped
  //     forward slash, backslash, or newline (\r / \n)
  //   - the token ends at end-of-string or a whitespace boundary, so we don't
  //     accidentally match a prefix of a longer non-delimited word
  //     (e.g. /foo/iSomething must NOT be recognised as a regex token).
  // The trailing flags cover all valid JS RegExp flag letters:
  //   g (global), i (ignoreCase), m (multiline), s (dotAll),
  //   u (unicode), y (sticky), d (hasIndices ES2022), v (unicodeSets ES2023).
  // Note: 'e' is intentionally excluded — it is not a valid JS RegExp flag.
  const m = q.match(/(?:^|\s)(\/(?:[^/\\\r\n]|\\.)+\/[gimsuydv]*)(?=$|\s)/);
  if (!m || !m[1]) return null;
  const raw = m[1].trim();
  // Compute the exact start position of the token within the original string.
  // m.index is where the full match starts; the token (group 1) may be preceded
  // by one whitespace character captured by (?:^|\s), hence the offset.
  const tokenStart = m.index! + m[0].length - m[1].length;
  const lastSlash = raw.lastIndexOf("/");
  const pattern = raw.slice(1, lastSlash);
  const flags = raw.slice(lastSlash + 1);
  return { raw, pattern, flags, index: tokenStart };
}

/**
 * Derive a literal API search term from a regex pattern.
 *
 * Strategy (in order):
 * 1. If the pattern is a **top-level alternation** `A|B|C` (branches not
 *    nested inside `(...)` or `[...]`) → join branches with ` OR `.
 * 2. Otherwise → extract all unescaped literal sequences, pick the longest one.
 * 3. If the best term is shorter than 3 characters → return `warn`.
 */
function extractApiTerm(pattern: string): { term: string; warn?: string } {
  // 1. Top-level alternation detection.
  const branches = splitTopLevelAlternation(pattern);
  if (branches.length > 1) {
    // Each branch must yield a meaningful literal (>= 3 chars) to use the OR
    // strategy — the same minimum enforced by the single-literal path below.
    // Branches shorter than 3 chars (e.g. /a|bc/) fall through so the global
    // "< 3 chars → warn + empty term" rule still applies.
    const branchTerms = branches.map((b) => longestLiteralSequence(b));
    if (branchTerms.every((t) => t.length >= 3)) {
      return { term: branchTerms.join(" OR ") };
    }
  }

  // 2. Longest literal sequence.
  const term = longestLiteralSequence(pattern);
  if (term.length < 3) {
    return {
      term: "",
      warn:
        "No meaningful search term could be extracted from the regex pattern. " +
        "Use --regex-hint <term> to specify the term to send to the GitHub API.",
    };
  }
  return { term };
}

/**
 * Split a regex pattern on top-level `|` characters — i.e. `|` that are not
 * inside `(...)`, `[...]`, or preceded by a backslash.
 */
function splitTopLevelAlternation(pattern: string): string[] {
  const branches: string[] = [];
  let depth = 0; // tracks unescaped '(' nesting depth outside character classes
  let inClass = false; // tracks whether we are currently inside a character class [...]
  let current = "";
  let escaped = false; // true when current char is escaped by a preceding backslash

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (escaped) {
      // Current character is escaped — treat as literal, never as a delimiter.
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      // Next character will be escaped.
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "[" && !inClass) {
      inClass = true;
      current += ch;
    } else if (ch === "]" && inClass) {
      inClass = false;
      current += ch;
    } else if (ch === "(" && !inClass) {
      depth++;
      current += ch;
    } else if (ch === ")" && !inClass) {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === "|" && depth === 0 && !inClass) {
      branches.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  branches.push(current);
  return branches;
}

/**
 * Extract the longest contiguous sequence of characters useful as a GitHub
 * search term from a regex pattern fragment.
 *
 * Only `[a-zA-Z0-9_-]` characters are accumulated — punctuation and special
 * characters that are valid regex literals (e.g. `\(`) are intentionally
 * excluded because they produce poor search terms.
 * Character classes `[...]` are skipped entirely.
 * Uses `>=` when updating `best` so that later (more specific) sequences of
 * equal length are preferred over earlier structural ones (e.g. `old-lib`
 * is preferred over `require` in `/require\(['"]old-lib['"]\)/`).
 */
function longestLiteralSequence(pattern: string): string {
  let best = "";
  let current = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // Skip entire character class [...] — its contents are never good search terms.
    if (ch === "[") {
      if (current.length >= best.length) best = current;
      current = "";
      i++; // skip `[`
      // Handle negation `[^` and literal `]` at the very start of the class.
      if (i < pattern.length && pattern[i] === "^") i++;
      if (i < pattern.length && pattern[i] === "]") i++;
      // Advance until unescaped `]`.
      while (i < pattern.length && pattern[i] !== "]") {
        if (pattern[i] === "\\") i++; // skip escaped char inside class
        i++;
      }
      i++; // skip closing `]`
      continue;
    }

    // Handle escape sequences.
    if (ch === "\\") {
      const next = pattern[i + 1] ?? "";
      // Only accumulate if the escaped char is a word character or hyphen
      // AND is not a common regex escape or backreference (\b, \d, \s, \w,
      // \p, \u, \x, \1–9, …) or control-character escape (\n, \r, \t, \f, \v).
      // Note: \a and \e are NOT in this list — in JS without u/v they are
      // identity escapes that simply match the literal letter ('a' or 'e'),
      // so they should be accumulated, not broken on.
      const isWordLike = /[a-zA-Z0-9_-]/.test(next);
      const isSpecialEscape = /[bBdDsSwWpPuUxX0-9nrtfv]/.test(next);
      if (isWordLike && !isSpecialEscape) {
        current += next;
      } else {
        // Escaped punctuation or special escape — not a useful literal search
        // char → break the current sequence.
        if (current.length >= best.length) best = current;
        current = "";
      }
      i += 2;
      continue;
    }

    // Only accumulate characters that make a useful GitHub search term.
    if (/[a-zA-Z0-9_-]/.test(ch)) {
      current += ch;
    } else {
      if (current.length >= best.length) best = current;
      current = "";
    }
    i++;
  }

  if (current.length >= best.length) best = current;
  return best;
}
