// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextMatchSegment {
  text: string;
  indices: [number, number];
  /** 1-based absolute file line (computed by api.ts / recomputeSegments in aggregate.ts).
   *  Used for `#L{line}` GitHub anchors in output.ts. */
  line: number;
  /** 1-based column within that line. */
  col: number;
}

export interface TextMatch {
  fragment: string;
  matches: TextMatchSegment[];
}

export interface CodeMatch {
  path: string;
  repoFullName: string;
  htmlUrl: string;
  textMatches: TextMatch[];
  archived: boolean;
  isTemplate?: boolean;
  /** Full raw file content, when already downloaded by `fetchAllResults()` for
   *  line-number resolution. Used as a fallback for local regex filtering
   *  when the API-provided fragment does not contain the full match — see
   *  issue #148. Absent when the raw content could not be fetched. */
  fileContent?: string;
}

export interface RepoGroup {
  repoFullName: string;
  matches: CodeMatch[];
  folded: boolean;
  repoSelected: boolean;
  /** per-extract selected state (index → boolean) */
  extractSelected: boolean[];
  /** GitHub team slugs/names that have access to this repo (populated when
   *  `--group-by-team-prefix` is used). */
  teams?: string[];
  /** When set, this repo is the first entry of a new team section with this
   *  label. Consumed by `buildRows` to emit a preceding section-header row. */
  sectionLabel?: string;
  /** When set, this repo was moved from a combined section via --pick-team or
   *  interactive pick. Stores the original combined label (e.g. "squad-a + squad-b")
   *  so future split mode can identify it and offer to re-assign. */
  pickedFrom?: string;
}

export interface Row {
  type: "repo" | "extract" | "section";
  /** -1 for section rows */
  repoIndex: number;
  extractIndex?: number;
  /** Populated only for `type === "section"` rows. */
  sectionLabel?: string;
}

/**
 * One labelled group of repos produced by `groupByTeamPrefix` or
 * `groupByTeamHierarchy`. Flat consumers (`groupByTeamPrefix`) only ever set
 * `groups`. Hierarchy nodes (`groupByTeamHierarchy`) can have `groups` (repos
 * that belong to this section itself, with no more specific match), nested
 * `children` (more specific sub-sections), or both at once — a team can
 * directly own repos while some of its members also match a more specific
 * overlapping team name or the next prefix in an explicit chain.
 */
export interface TeamSection {
  label: string;
  groups: RepoGroup[];
  /** Nesting depth: 0 for a top-level section, 1 for a section nested one
   *  level down (via a chained `--group-by-team-prefix` level or an
   *  auto-detected overlapping team name), etc. Only set by
   *  `groupByTeamHierarchy`. */
  level?: number;
  /** Present (non-empty) only when this section has nested sub-sections —
   *  from the next prefix in an explicit chain, or an auto-detected
   *  overlapping team-name relationship. A node can have non-empty `groups`
   *  at the same time (see the type-level doc above). Only set by
   *  `groupByTeamHierarchy`. */
  children?: TeamSection[];
}

export type OutputFormat = "markdown" | "json";

export type OutputType = "repo-only" | "repo-and-matches";

/**
 * Which field the TUI filter bar matches against.
 * - "path"    — file path of the extract (default)
 * - "content" — code fragment text (`TextMatch.fragment`)
 * - "repo"    — repository full name (`RepoGroup.repoFullName`)
 */
export type FilterTarget = "path" | "content" | "repo";
