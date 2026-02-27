#!/usr/bin/env bun
/**
 * github-code-search
 * Interactive GitHub code search with per-repo aggregation, fold/unfold, and selection.
 *
 * Usage:
 *   github-code-search upgrade
 *   github-code-search <query> --org <org> [options]   ← backward-compat default
 *   github-code-search query <query> --org <org> [options]
 *
 * Requirements:
 *   GITHUB_TOKEN env var must be set (for search; optional for upgrade).
 */

import { Command, program } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import { aggregate, normaliseExtractRef, normaliseRepo } from "./src/aggregate.ts";
import { fetchAllResults, fetchRepoTeams } from "./src/api.ts";
import { buildOutput } from "./src/output.ts";
import { groupByTeamPrefix, flattenTeamSections } from "./src/group.ts";
import { checkForUpdate } from "./src/upgrade.ts";
import { runInteractive } from "./src/tui.ts";
import type { OutputFormat, OutputType } from "./src/types.ts";

// Version + build metadata injected at compile time via --define (see build.ts).
// Fallback to "dev" / "unknown" when running directly with `bun run`.
declare const BUILD_VERSION: string;
declare const BUILD_COMMIT: string;
declare const BUILD_TARGET_OS: string;
declare const BUILD_TARGET_ARCH: string;
const VERSION = typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : "dev";
const COMMIT = typeof BUILD_COMMIT !== "undefined" ? BUILD_COMMIT : "dev";
const TARGET_OS = typeof BUILD_TARGET_OS !== "undefined" ? BUILD_TARGET_OS : process.platform;
const TARGET_ARCH =
  typeof BUILD_TARGET_ARCH !== "undefined"
    ? BUILD_TARGET_ARCH
    : process.arch === "x64"
      ? "x64"
      : process.arch;
/** Full version string shown by `--version`. */
const VERSION_FULL = `${VERSION} (${COMMIT} · ${TARGET_OS}/${TARGET_ARCH})`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Add the shared search options to a command. */
function addSearchOptions(cmd: Command): Command {
  return cmd
    .argument("<query>", "Search query")
    .requiredOption("--org <org>", "GitHub organization to search in")
    .option(
      "--exclude-repositories <repos>",
      [
        "Comma-separated list of repositories to exclude.",
        "Short form (without org prefix) or full form accepted:",
        "  repoA,repoB  OR  myorg/repoA,myorg/repoB",
        "Docs: https://fulll.github.io/github-code-search/usage/filtering",
      ].join("\n"),
      "",
    )
    .option(
      "--exclude-extracts <refs>",
      [
        "Comma-separated extract refs to exclude.",
        "Format (shortest): repoName:path:matchIndex",
        "  e.g.  repoA:src/foo.ts:0,repoB:lib/core.ts:2",
        "Full form also accepted: myorg/repoA:src/foo.ts:0",
        "Docs: https://fulll.github.io/github-code-search/usage/filtering",
      ].join("\n"),
      "",
    )
    .option(
      "--no-interactive",
      "Disable interactive mode (non-interactive). Also triggered by CI=true env var.",
    )
    .option(
      "--format <format>",
      [
        "Output format: markdown (default) or json.",
        "Docs: https://fulll.github.io/github-code-search/usage/output-formats",
      ].join("\n"),
      "markdown",
    )
    .option(
      "--output-type <type>",
      [
        "Output type: repo-and-matches (default) or repo-only.",
        "Docs: https://fulll.github.io/github-code-search/usage/output-formats",
      ].join("\n"),
      "repo-and-matches",
    )
    .option(
      "--include-archived",
      "Include archived repositories in results (default: false)",
      false,
    )
    .option(
      "--group-by-team-prefix <prefixes>",
      [
        "Comma-separated team-name prefixes used to group result repos by GitHub team.",
        "Example: squad-,chapter-",
        "Repos are first grouped by the first prefix (single-team, then multi-team),",
        "then by the next prefix, and so on. Repos matching no prefix go into 'other'.",
        "Docs: https://fulll.github.io/github-code-search/usage/team-grouping",
      ].join("\n"),
      "",
    )
    .option(
      "--no-cache",
      "Bypass the 24 h team-list cache and re-fetch teams from GitHub (only applies with --group-by-team-prefix).",
    );
}

/** Action handler shared by both the explicit `query` subcommand and the default. */
async function searchAction(
  query: string,
  opts: {
    org: string;
    excludeRepositories: string;
    excludeExtracts: string;
    interactive: boolean;
    format: string;
    outputType: string;
    includeArchived: boolean;
    groupByTeamPrefix: string;
    cache: boolean;
  },
): Promise<void> {
  // ─── GitHub API token ───────────────────────────────────────────────────────
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    console.error(pc.red("Error: GITHUB_TOKEN environment variable is not set."));
    process.exit(1);
  }

  const org = opts.org;
  const format: OutputFormat = opts.format === "json" ? "json" : "markdown";
  const outputType: OutputType = opts.outputType === "repo-only" ? "repo-only" : "repo-and-matches";
  const includeArchived = Boolean(opts.includeArchived);

  const excludedRepos = new Set(
    opts.excludeRepositories
      ? opts.excludeRepositories.split(",").map((r) => normaliseRepo(org, r))
      : [],
  );

  const excludedExtractRefs = new Set(
    opts.excludeExtracts
      ? opts.excludeExtracts.split(",").map((r) => normaliseExtractRef(org, r))
      : [],
  );

  /** True when running in non-interactive / CI mode */
  const isCI = process.env.CI === "true" || opts.interactive === false;

  const rawMatches = await fetchAllResults(query, org, GITHUB_TOKEN!);
  let groups = aggregate(rawMatches, excludedRepos, excludedExtractRefs, includeArchived);

  // ─── Team-prefix grouping ─────────────────────────────────────────────────
  if (opts.groupByTeamPrefix) {
    const prefixes = opts.groupByTeamPrefix
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (prefixes.length > 0) {
      const teamMap = await fetchRepoTeams(org, GITHUB_TOKEN!, prefixes, opts.cache);
      // Attach team lists to each group
      for (const g of groups) {
        g.teams = teamMap.get(g.repoFullName) ?? [];
      }
      groups = flattenTeamSections(groupByTeamPrefix(groups, prefixes));
    }
  }

  if (isCI) {
    console.log(
      buildOutput(groups, query, org, excludedRepos, excludedExtractRefs, format, outputType, {
        includeArchived,
        groupByTeamPrefix: opts.groupByTeamPrefix,
      }),
    );
    // Check for a newer version and notify on stderr so it never pollutes piped output.
    // Race against a 2 s timeout so slow networks never delay the exit.
    const latestTag = await Promise.race([
      checkForUpdate(VERSION, GITHUB_TOKEN),
      new Promise<null>((res) => setTimeout(() => res(null), 2000)),
    ]);
    if (latestTag) {
      const w = 55;
      const bar = "─".repeat(w);
      const pad = (s: string) => s + " ".repeat(Math.max(0, w - s.length));
      process.stderr.write(
        pc.yellow(
          [
            `╭─ Update available ${"─".repeat(w - 18)}╮`,
            `│ ${pad(`github-code-search ${VERSION} → ${latestTag}`)} │`,
            `│ ${pad("Run: github-code-search upgrade")} │`,
            `╰${bar}╯`,
            "",
          ].join("\n"),
        ),
      );
    }
  } else {
    await runInteractive(
      groups,
      query,
      org,
      excludedRepos,
      excludedExtractRefs,
      format,
      outputType,
      includeArchived,
      opts.groupByTeamPrefix,
    );
  }
}

// ─── CLI Definition ──────────────────────────────────────────────────────────

program
  .name("github-code-search")
  .version(VERSION_FULL, "-V, --version", "Output version, commit, OS and architecture")
  .description("Interactive GitHub code search with per-repo aggregation")
  .addHelpText("after", "\nDocumentation:\n  https://fulll.github.io/github-code-search/");

// `upgrade` subcommand — does NOT require GITHUB_TOKEN (uses it only if set)
program
  .command("upgrade")
  .description("Check for a new release and auto-upgrade the binary")
  .addHelpText(
    "after",
    "\nDocumentation:\n  https://fulll.github.io/github-code-search/usage/upgrade",
  )
  .option("--debug", "Print debug information for troubleshooting")
  .action(async (opts: { debug?: boolean }) => {
    const { performUpgrade } = await import("./src/upgrade.ts");
    const token = process.env.GITHUB_TOKEN;
    // Fix: in some Bun versions, process.execPath returns the Bun runtime path
    // (e.g. ~/.bun/bin/bun) or an internal /$bunfs/ path instead of the compiled
    // binary path — which causes the mv to fail or replace the wrong file.
    // Prefer process.execPath when it looks like a real on-disk binary path;
    // fall back to resolving process.argv[0] (the invocation path) otherwise.
    const selfPath =
      process.execPath && !process.execPath.startsWith("/$bunfs/")
        ? process.execPath
        : resolve(process.argv[0]);
    if (opts.debug) {
      process.stdout.write(`[debug] process.execPath  = ${process.execPath}\n`);
      process.stdout.write(`[debug] process.argv[0]   = ${process.argv[0]}\n`);
      process.stdout.write(`[debug] selfPath (dest)    = ${selfPath}\n`);
      process.stdout.write(`[debug] process.platform   = ${process.platform}\n`);
      process.stdout.write(`[debug] process.arch       = ${process.arch}\n`);
      process.stdout.write(`[debug] VERSION            = ${VERSION}\n`);
    }
    try {
      await performUpgrade(VERSION, selfPath, token, opts.debug);
    } catch (e: unknown) {
      // Print upgrade errors to stdout so they are always visible (stderr
      // is sometimes swallowed by shells or terminal multiplexers).
      process.stdout.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    }
    process.exit(0);
  });

// `query` subcommand — the default (backward-compat: `gcs <query> --org <org>`)
const queryCmd = addSearchOptions(
  new Command("query")
    .description("Search GitHub code (default command when no subcommand given)")
    .addHelpText(
      "after",
      "\nDocumentation:\n  https://fulll.github.io/github-code-search/usage/search-syntax",
    ),
).action(async (query: string, opts) => {
  await searchAction(query, opts);
});

program.addCommand(queryCmd, { isDefault: true });

// Turn Commander's process.exit() calls into thrown CommanderErrors so we
// can intercept validation failures (missing --org, missing <query>, etc.)
// and show contextual help instead of a bare error message.
// Also suppress Commander's built-in "error: …" stderr line so only the help
// text is shown.
const silenceErrors = { outputError: () => {} };
program.exitOverride().configureOutput(silenceErrors);
queryCmd.exitOverride().configureOutput(silenceErrors);

// ─── Early exit for --version and --help ─────────────────────────────────────
// process.exit() in a Bun compiled binary can cut the stdout buffer before it
// is flushed. Use writeFileSync to guarantee the write completes before exiting.

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--version") || rawArgs.includes("-V")) {
    writeFileSync(1, VERSION_FULL + "\n");
    process.exit(0);
  } else if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    writeFileSync(1, program.helpInformation() + "\n");
    process.exit(0);
  }

  try {
    await program.parseAsync(process.argv);
  } catch (e: unknown) {
    // Commander validation error (missing argument, missing required option…)
    // → print the query-subcommand help to stderr and exit 1.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      typeof (e as { code: unknown }).code === "string" &&
      (e as { code: string }).code.startsWith("commander.")
    ) {
      writeFileSync(2, queryCmd.helpInformation() + "\n");
      process.exit(1);
    }
    // Any other known Error (e.g. rate-limit exceeded) → print a clean message
    // to stderr without a stack trace, then exit 1.
    if (e instanceof Error) {
      writeFileSync(2, `error: ${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
}
void main();
