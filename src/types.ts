// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextMatchSegment {
  text: string;
  indices: [number, number];
  /** 1-based line within the fragment (fragment-relative, not absolute file line). */
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
}

export interface Row {
  type: "repo" | "extract" | "section";
  /** -1 for section rows */
  repoIndex: number;
  extractIndex?: number;
  /** Populated only for `type === "section"` rows. */
  sectionLabel?: string;
}

/** One labelled group of repos produced by `groupByTeamPrefix`. */
export interface TeamSection {
  label: string;
  groups: RepoGroup[];
}

export type OutputFormat = "markdown" | "json";

export type OutputType = "repo-only" | "repo-and-matches";
