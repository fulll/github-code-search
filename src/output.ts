import { buildSelectionSummary } from "./render.ts";
import { isRegexQuery } from "./regex.ts";
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
/** Wraps `s` in POSIX single quotes, escaping any embedded single quotes as '\''.
 *  Produces output that is safe to paste into bash / zsh regardless of the
 *  content (no `$()`, backtick, or glob expansion). */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export interface ReplayOptions {
  format?: OutputFormat;
  outputType?: OutputType;
  includeArchived?: boolean;
  excludeTemplates?: boolean;
  groupByTeamPrefix?: string;
  /** When set, appends `--regex-hint <term>` to the replay command so the
   *  result set from a regex query can be reproduced exactly. */
  regexHint?: string;
  /** Team-pick assignments to replay: maps combined label → chosen team. */
  pickTeams?: Record<string, string>;
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
  const {
    format,
    outputType,
    includeArchived,
    excludeTemplates,
    groupByTeamPrefix,
    regexHint,
    pickTeams,
  } = options;
  const parts: string[] = [
    `github-code-search ${shellQuote(query)} --org ${shellQuote(org)} --no-interactive`,
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
    parts.push(`--exclude-extracts ${shellQuote(excludedExtractsList.join(","))}`);
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
  if (excludeTemplates) {
    parts.push("--exclude-template-repositories");
  }
  if (groupByTeamPrefix) {
    parts.push(`--group-by-team-prefix ${shellQuote(groupByTeamPrefix)}`);
  }
  if (regexHint) {
    parts.push(`--regex-hint ${shellQuote(regexHint)}`);
  }
  if (pickTeams) {
    for (const [combined, chosen] of Object.entries(pickTeams)) {
      parts.push(`--pick-team ${shellQuote(`${combined}=${chosen}`)}`);
    }
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
    '<summary><a href="https://fulll.github.io/github-code-search/">github-code-search</a> replay command</summary>',
    "",
    "```bash",
    shellCmd,
    "```",
    "",
    "</details>",
  ].join("\n");
}

// ─── Markdown inline-code helper ────────────────────────────────────────────

/**
 * Wraps `s` in a Markdown inline-code span using a backtick fence long enough
 * to safely contain any backticks already present in `s` (CommonMark §6.1).
 * Adds surrounding spaces when `s` starts or ends with a backtick character.
 */
function mdInlineCode(s: string): string {
  const runs = [...s.matchAll(/`+/g)].map((m) => m[0].length);
  const maxRun = runs.length > 0 ? Math.max(...runs) : 0;
  const fence = "`".repeat(maxRun + 1);
  const padded = s.startsWith("`") || s.endsWith("`") ? ` ${s} ` : s;
  return `${fence}${padded}${fence}`;
}

// ─── Query title ─────────────────────────────────────────────────────────────

/**
 * Builds a first-level heading that identifies the query and any active
 * qualifiers (e.g. `--include-archived`, `--exclude-template-repositories`).
 *
 * Examples:
 *   # Results for "useFlag"
 *   # Results for `/useFlag/i`
 *   # Results for "axios" · including archived · excluding templates
 */
export function buildQueryTitle(query: string, options: ReplayOptions = {}): string {
  // JSON.stringify handles embedded double quotes and converts newlines to \n
  // so the heading always stays on a single line.
  // mdInlineCode uses a variable-length backtick fence to safely display regex
  // patterns that may themselves contain backtick characters.
  const queryDisplay = isRegexQuery(query) ? mdInlineCode(query) : JSON.stringify(query);
  const qualifiers: string[] = [];
  if (options.includeArchived) qualifiers.push("including archived");
  if (options.excludeTemplates) qualifiers.push("excluding templates");
  const suffix = qualifiers.length > 0 ? ` · ${qualifiers.join(" · ")}` : "";
  return `# Results for ${queryDisplay}${suffix}`;
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
      buildQueryTitle(query, options) +
      "\n\n" +
      repos.join("\n") +
      "\n\n" +
      buildReplayDetails(groups, query, org, excludedRepos, excludedExtractRefs, options) +
      "\n"
    );
  }

  const lines: string[] = [];

  lines.push(buildQueryTitle(query, options));
  lines.push("");
  lines.push(buildSelectionSummary(groups));
  lines.push("");

  for (const group of groups) {
    if (!group.repoSelected) continue;
    const matches = selectedMatches(group);
    if (matches.length === 0) continue;

    // Section header (emitted before the first repo in a new team section)
    if (group.sectionLabel !== undefined) {
      lines.push("");
      lines.push(`## ${group.sectionLabel}`);
      lines.push("");
    }

    const matchCount = selectedMatches(group).length;
    lines.push(`- **${group.repoFullName}** (${matchCount} match${matchCount !== 1 ? "es" : ""})`);
    for (const m of matches) {
      // Use VS Code-ready path:line:col as link text and anchor the URL to the
      // line when location info is available (GitHub #Lline deeplink).
      // seg.line/seg.col reflect absolute file line numbers resolved by api.ts
      // (falling back to fragment-relative positions when raw content is
      // unavailable).
      const seg = m.textMatches[0]?.matches[0];
      if (seg) {
        const matchedText = seg.text ? `: ${mdInlineCode(seg.text)}` : "";
        lines.push(
          `  - [ ] [${m.path}:${seg.line}:${seg.col}](${m.htmlUrl}#L${seg.line})${matchedText}`,
        );
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
          ...(seg !== undefined
            ? {
                line: seg.line,
                col: seg.col,
                ...(seg.text ? { matchedText: seg.text } : {}),
              }
            : {}),
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
  extraOptions: Pick<
    ReplayOptions,
    "includeArchived" | "excludeTemplates" | "groupByTeamPrefix" | "regexHint" | "pickTeams"
  > = {},
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
