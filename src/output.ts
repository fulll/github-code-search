import { buildSelectionSummary } from "./render.ts";
import type { OutputFormat, OutputType, RepoGroup } from "./types.ts";

// ─── Short-form helpers ───────────────────────────────────────────────────────

/** Strip org prefix for compact replay flags. */
export function shortRepo(full: string, org: string): string {
  const prefix = `${org}/`;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}

export function shortExtractRef(full: string, org: string): string {
  // full = "org/repo:path:index"
  const colonIdx = full.indexOf(":");
  if (colonIdx === -1) return full;
  const repoPart = full.slice(0, colonIdx);
  const rest = full.slice(colonIdx);
  return shortRepo(repoPart, org) + rest;
}

// ─── Replay options ───────────────────────────────────────────────────────────

/** Options that affect the generated replay command. */
export interface ReplayOptions {
  format?: OutputFormat;
  outputType?: OutputType;
  includeArchived?: boolean;
  groupByTeamPrefix?: string;
}

// ─── Replay command ───────────────────────────────────────────────────────────

export function buildReplayCommand(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  // Fix: forward all input options so the replay command is fully reproducible — see issue #11
  options: ReplayOptions = {},
): string {
  const { format, outputType, includeArchived, groupByTeamPrefix } = options;
  const parts: string[] = [
    `github-code-search ${JSON.stringify(query)} --org ${org} --no-interactive`,
  ];

  const excludedReposList: string[] = [...excludedRepos].map((r) => shortRepo(r, org));
  for (const group of groups) {
    const short = shortRepo(group.repoFullName, org);
    if (!group.repoSelected && !excludedReposList.includes(short)) {
      excludedReposList.push(short);
    }
  }
  if (excludedReposList.length > 0) {
    parts.push(`--exclude-repositories ${excludedReposList.join(",")}`);
  }

  const excludedExtractsList: string[] = [...excludedExtractRefs].map((r) =>
    shortExtractRef(r, org),
  );
  for (const group of groups) {
    if (!group.repoSelected) continue;
    for (let ei = 0; ei < group.matches.length; ei++) {
      if (!group.extractSelected[ei]) {
        const ref = shortExtractRef(`${group.repoFullName}:${group.matches[ei].path}:${ei}`, org);
        if (!excludedExtractsList.includes(ref)) {
          excludedExtractsList.push(ref);
        }
      }
    }
  }
  if (excludedExtractsList.length > 0) {
    parts.push(`--exclude-extracts ${excludedExtractsList.join(",")}`);
  }

  if (format && format !== "markdown") {
    parts.push(`--format ${format}`);
  }
  if (outputType && outputType !== "repo-and-matches") {
    parts.push(`--output-type ${outputType}`);
  }
  if (includeArchived) {
    parts.push("--include-archived");
  }
  if (groupByTeamPrefix) {
    parts.push(`--group-by-team-prefix ${groupByTeamPrefix}`);
  }

  return `# Replay:\n${parts.join(" \\\n  ")}`;
}

// ─── Replay details (markdown) ─────────────────────────────────────────────────

/**
 * Wraps the replay command in a collapsible `<details>` block for clean
 * markdown output. The raw shell command is fenced in a ```bash block.
 */
export function buildReplayDetails(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  options: ReplayOptions = {},
): string {
  const raw = buildReplayCommand(groups, query, org, excludedRepos, excludedExtractRefs, options);
  // Strip the leading "# Replay:\n" comment so only the runnable lines remain.
  const shellCmd = raw.replace(/^# Replay:\n/, "");
  return [
    "<details>",
    "<summary>replay command</summary>",
    "",
    "```bash",
    shellCmd,
    "```",
    "",
    "</details>",
  ].join("\n");
}

// ─── Selected matches helper ─────────────────────────────────────────────────

function selectedMatches(group: RepoGroup) {
  return group.matches.filter((_, i) => group.extractSelected[i]);
}

// ─── Text output ─────────────────────────────────────────────────────────────

export function buildMarkdownOutput(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  outputType: OutputType = "repo-and-matches",
  options: ReplayOptions = {},
): string {
  // repo-only: return the repo names followed by the replay command
  if (outputType === "repo-only") {
    const repos = groups
      .filter((g) => g.repoSelected && selectedMatches(g).length > 0)
      .map((g) => g.repoFullName);
    if (repos.length === 0) return "";
    return (
      repos.join("\n") +
      "\n\n" +
      buildReplayDetails(groups, query, org, excludedRepos, excludedExtractRefs, options) +
      "\n"
    );
  }

  const lines: string[] = [];

  lines.push(buildSelectionSummary(groups));
  lines.push("");

  for (const group of groups) {
    if (!group.repoSelected) continue;
    const matches = selectedMatches(group);
    if (matches.length === 0) continue;

    // Section header (emitted before the first repo in a new team section)
    if (group.sectionLabel !== undefined) {
      lines.push(`## ${group.sectionLabel}`);
      lines.push("");
    }

    const matchCount = selectedMatches(group).length;
    lines.push(`- **${group.repoFullName}** (${matchCount} match${matchCount !== 1 ? "es" : ""})`);
    for (const m of matches) {
      // Use VS Code-ready path:line:col as link text and anchor the URL to the
      // line when location info is available (GitHub #Lline deeplink).
      // Position is fragment-relative (GitHub Code Search API does not return
      // absolute line numbers).
      const seg = m.textMatches[0]?.matches[0];
      if (seg) {
        lines.push(`  - [ ] [${m.path}:${seg.line}:${seg.col}](${m.htmlUrl}#L${seg.line})`);
      } else {
        lines.push(`  - [ ] [${m.path}](${m.htmlUrl})`);
      }
    }
  }

  lines.push("");
  lines.push(buildReplayDetails(groups, query, org, excludedRepos, excludedExtractRefs, options));

  return lines.join("\n");
}

// ─── JSON output ─────────────────────────────────────────────────────────────

export function buildJsonOutput(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  outputType: OutputType = "repo-and-matches",
  options: ReplayOptions = {},
): string {
  const results = groups
    .filter((g) => g.repoSelected)
    .map((group) => {
      const base = { repo: group.repoFullName };
      if (outputType === "repo-only") return base;
      const matches = selectedMatches(group).map((m) => {
        const seg = m.textMatches[0]?.matches[0];
        return {
          path: m.path,
          url: m.htmlUrl,
          ...(seg !== undefined ? { line: seg.line, col: seg.col } : {}),
        };
      });
      return { ...base, matches };
    })
    .filter((r) => !("matches" in r) || r.matches.length > 0);

  const selectedRepoCount = groups.filter((g) => g.repoSelected).length;
  const selectedMatchCount = groups.reduce(
    (sum, g) => sum + g.extractSelected.filter(Boolean).length,
    0,
  );

  const replayCommand = buildReplayCommand(
    groups,
    query,
    org,
    excludedRepos,
    excludedExtractRefs,
    options,
  );

  return JSON.stringify(
    {
      query,
      org,
      selection: { repos: selectedRepoCount, matches: selectedMatchCount },
      results,
      replayCommand,
    },
    null,
    2,
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function buildOutput(
  groups: RepoGroup[],
  query: string,
  org: string,
  excludedRepos: Set<string>,
  excludedExtractRefs: Set<string>,
  format: OutputFormat,
  outputType: OutputType = "repo-and-matches",
  extraOptions: Pick<ReplayOptions, "includeArchived" | "groupByTeamPrefix"> = {},
): string {
  const options: ReplayOptions = { format, outputType, ...extraOptions };
  if (format === "json") {
    return buildJsonOutput(
      groups,
      query,
      org,
      excludedRepos,
      excludedExtractRefs,
      outputType,
      options,
    );
  }
  return buildMarkdownOutput(
    groups,
    query,
    org,
    excludedRepos,
    excludedExtractRefs,
    outputType,
    options,
  );
}
