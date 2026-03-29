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
import { formatRetryWait } from "./src/api-utils.ts";
import { buildOutput } from "./src/output.ts";
import { groupByTeamPrefix, flattenTeamSections, applyTeamPick } from "./src/group.ts";
import { checkForUpdate } from "./src/upgrade.ts";
import { runInteractive } from "./src/tui.ts";
import { generateCompletion, detectShell } from "./src/completions.ts";
import { buildApiQuery, isRegexQuery } from "./src/regex.ts";
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

// ─── Help colorization ───────────────────────────────────────────────────────
// Only apply colours when stdout is connected to a real terminal.
// All pipes, CI redirects, and `--no-color` environments stay plain-text.
const HAS_COLOR = Boolean(process.stdout.isTTY);

/**
 * Walk through a multi-line option/argument description and:
 *  • "Docs: <url>"   → dim label + cyan underlined URL
 *  • "Example: ..." → dim label + italic value
 *  • indent lines that look like code examples (e.g. / repoA / myorg) → dim
 */
function colorDesc(s: string): string {
  if (!HAS_COLOR) return s;
  return s
    .split("\n")
    .map((line) => {
      const docsMatch = line.match(/^(\s*Docs:\s*)(https?:\/\/\S+)$/);
      if (docsMatch) return pc.dim(docsMatch[1]) + pc.cyan(pc.underline(docsMatch[2]));
      const exampleMatch = line.match(/^(\s*Example:\s*)(.+)$/);
      if (exampleMatch) return pc.dim(exampleMatch[1]) + pc.italic(exampleMatch[2]);
      if (/^\s+(e\.g\.|repoA|myorg\/|squad-|chapter-)/.test(line)) return pc.dim(line);
      // Colorize any remaining bare URL (http/https) anywhere in the line
      return line.replace(/(https?:\/\/\S+)/g, (url) => pc.cyan(pc.underline(url)));
    })
    .join("\n");
}

/** Colored hyperlink (cyan + underline), falls back to plain when not a TTY. */
function helpLink(url: string): string {
  return HAS_COLOR ? pc.cyan(pc.underline(url)) : url;
}

/**
 * Builds the `addHelpText("after", ...)` footer block with a labelled link.
 * The label is bold when color is supported.
 */
function helpSection(label: string, url: string): string {
  const t = HAS_COLOR ? pc.bold(label) : label;
  return `\n${t}\n  ${helpLink(url)}`;
}

/**
 * Commander configureHelp options shared by all commands.
 * Each style hook only applies colour when HAS_COLOR is true.
 */
const helpFormatConfig = {
  // Section headings: "Usage:", "Options:", "Commands:" …
  styleTitle: (s: string) => (HAS_COLOR ? pc.bold(pc.yellow(s)) : s),
  // Command name in the usage line
  styleCommandText: (s: string) => (HAS_COLOR ? pc.bold(s) : s),
  // Subcommand names in the command listing
  styleSubcommandText: (s: string) => (HAS_COLOR ? pc.cyan(s) : s),
  // Argument placeholders (<query>)
  styleArgumentText: (s: string) => (HAS_COLOR ? pc.yellow(s) : s),
  // Option flags in the usage line (--org, --format …)
  styleOptionText: (s: string) => (HAS_COLOR ? pc.green(s) : s),
  // Option terms in the options table
  styleOptionTerm: (s: string) => (HAS_COLOR ? pc.green(s) : s),
  // Subcommand terms in the commands table
  styleSubcommandTerm: (s: string) => (HAS_COLOR ? pc.cyan(s) : s),
  // Argument terms in the arguments table
  styleArgumentTerm: (s: string) => (HAS_COLOR ? pc.yellow(s) : s),
  // Descriptions — color "Docs:", "Example:" and code-example lines
  styleOptionDescription: colorDesc,
  styleSubcommandDescription: colorDesc,
  styleArgumentDescription: colorDesc,
  styleCommandDescription: colorDesc,
  styleDescriptionText: colorDesc,
};

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
      "--exclude-template-repositories",
      "Exclude template repositories from results (default: false)",
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
      "--pick-team <assignment>",
      [
        "Assign a combined team section to a single owner.",
        'Format: "combined label"=chosenTeam  (the = separator is required).',
        'Example: --pick-team "squad-frontend + squad-mobile"=squad-frontend',
        "Repeatable — one flag per combined section to resolve.",
        "Only applies with --group-by-team-prefix.",
        "Docs: https://fulll.github.io/github-code-search/usage/team-grouping#team-pick-mode",
      ].join("\n"),
      (val: string, list: string[]) => [...list, val],
      [] as string[],
    )
    .option(
      "--no-cache",
      "Bypass the 24 h team-list cache and re-fetch teams from GitHub (only applies with --group-by-team-prefix).",
    )
    .option(
      "--regex-hint <term>",
      [
        "Override the search term sent to the GitHub API when using a regex query.",
        "Useful when auto-extraction produces a term that is too broad or too narrow.",
        'Example: --regex-hint "axios"  (for query /from.*[\'"]axios/)',
        "Docs: https://fulll.github.io/github-code-search/usage/search-syntax#regex-queries",
      ].join("\n"),
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
    excludeTemplateRepositories: boolean;
    groupByTeamPrefix: string;
    pickTeam: string[];
    cache: boolean;
    regexHint?: string;
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
  const excludeTemplates = Boolean(opts.excludeTemplateRepositories);

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

  // Shared promise for concurrent rate-limit hits (e.g. from Promise.all in
  // fetchRepoTeams). If a countdown is already running and covers the required
  // wait, new callers piggyback on it. If a new caller needs a *longer* wait
  // A single shared countdown loop: if a new caller needs a longer wait while
  // the loop is already running, we extend cooldownUntil and the loop picks up
  // the new deadline on its next tick — no second loop is ever started.
  let activeCooldown: Promise<void> | null = null;
  let cooldownUntil = 0;

  /** Shared rate-limit handler used for both the code search and the team fetch. */
  const onRateLimit = (waitMs: number): Promise<void> => {
    const desiredEnd = Date.now() + waitMs;
    if (activeCooldown !== null) {
      // A loop is already running. Extend the deadline if the new wait is longer;
      // piggyback in either case — a single loop covers all concurrent callers.
      if (desiredEnd > cooldownUntil) cooldownUntil = desiredEnd;
      return activeCooldown;
    }
    // No countdown running — start a fresh one.
    cooldownUntil = desiredEnd;
    activeCooldown = (async () => {
      // Start on a fresh line so the countdown doesn't overwrite the progress bar
      process.stderr.write("\n");
      while (true) {
        const remaining = cooldownUntil - Date.now();
        if (remaining <= 0) break;
        process.stderr.write(
          `\r  ${pc.yellow("Rate limited")} — resuming in ${formatRetryWait(remaining)}\u2026${" ".repeat(10)}`,
        );
        await new Promise((r) => setTimeout(r, 1_000));
      }
      // Leave cursor at line start; the next \r progress update will overwrite cleanly
      process.stderr.write(`\r  ${pc.dim("Rate limited")} — resuming\u2026${" ".repeat(40)}`);
    })().finally(() => {
      activeCooldown = null;
      cooldownUntil = 0;
    });
    return activeCooldown;
  };

  // ─── Regex query detection ───────────────────────────────────────────────
  let effectiveQuery = query;
  let regexFilter: RegExp | undefined;
  if (isRegexQuery(query)) {
    const { apiQuery, regexFilter: rf, warn } = buildApiQuery(query);
    if (rf === null) {
      // Compile error — always fatal, even if --regex-hint is provided,
      // because no local regex filter can be applied.
      console.error(pc.yellow(`⚠  Regex mode — ${warn}`));
      process.exit(1);
    }
    if (warn && !opts.regexHint) {
      // warn already contains the --regex-hint guidance; print it as-is.
      console.error(pc.yellow(`⚠  Regex mode — ${warn}`));
      process.exit(1);
    }
    effectiveQuery = opts.regexHint ?? apiQuery;
    regexFilter = rf ?? undefined;
    process.stderr.write(
      pc.dim(`  ℹ  Regex mode — GitHub query: "${effectiveQuery}", local filter: ${query}\n`),
    );
  }

  const rawMatches = await fetchAllResults(effectiveQuery, org, GITHUB_TOKEN!, onRateLimit);
  let groups = aggregate(
    rawMatches,
    excludedRepos,
    excludedExtractRefs,
    includeArchived,
    regexFilter,
    excludeTemplates,
  );

  // ─── Team-prefix grouping ─────────────────────────────────────────────────
  const pickTeams: Record<string, string> = {};
  if (opts.groupByTeamPrefix) {
    const prefixes = opts.groupByTeamPrefix
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (prefixes.length > 0) {
      const teamMap = await fetchRepoTeams(org, GITHUB_TOKEN!, prefixes, opts.cache, onRateLimit);
      // Attach team lists to each group
      for (const g of groups) {
        g.teams = teamMap.get(g.repoFullName) ?? [];
      }
      let sections = groupByTeamPrefix(groups, prefixes);
      // Apply --pick-team assignments before flattening.
      // Fix: detect non-matching picks and warn on stderr so the user can correct labels.
      for (const assignment of opts.pickTeam) {
        const eqIndex = assignment.indexOf("=");
        if (eqIndex === -1) {
          process.stderr.write(
            `warning: --pick-team "${assignment}" is missing the = separator; skipping\n`,
          );
          continue;
        }
        const combined = assignment.slice(0, eqIndex);
        const chosen = assignment.slice(eqIndex + 1);
        const updated = applyTeamPick(sections, combined, chosen);
        if (updated === sections) {
          // applyTeamPick returns the same reference when the combined label is not found.
          const available = sections
            .map((s) => s.label)
            .filter((l) => l.includes(" + "))
            .map((l) => `  "${l}"`)
            .join("\n");
          process.stderr.write(
            `warning: --pick-team: no section found with label "${combined}"\n` +
              (available
                ? `  Available combined sections:\n${available}\n`
                : "  (no combined sections remain)\n"),
          );
        } else {
          sections = updated;
          pickTeams[combined] = chosen;
        }
      }
      // Warn about combined sections that still have no pick assigned, so the user
      // knows which labels to add to the next replay command or interactive session.
      const unresolved = sections.filter((s) => s.label.includes(" + "));
      if (unresolved.length > 0 && opts.pickTeam.length > 0) {
        process.stderr.write(
          `note: ${unresolved.length} combined section${unresolved.length !== 1 ? "s" : ""} still unresolved ` +
            `(press "p" in TUI or use --pick-team to assign):\n` +
            unresolved.map((s) => `  "${s.label}"`).join("\n") +
            "\n",
        );
      }
      groups = flattenTeamSections(sections);
    }
  }

  if (isCI) {
    console.log(
      buildOutput(groups, query, org, excludedRepos, excludedExtractRefs, format, outputType, {
        includeArchived,
        excludeTemplates,
        groupByTeamPrefix: opts.groupByTeamPrefix,
        regexHint: opts.regexHint,
        pickTeams: Object.keys(pickTeams).length > 0 ? pickTeams : undefined,
      }),
    );
    // Check for a newer version and notify on stderr so it never pollutes piped output.
    // Race against a 2 s timeout so slow networks never delay the exit.
    // Fix: use AbortController so the in-flight fetch is actually cancelled on timeout.
    const updateAbortController = new AbortController();
    const latestTag = await Promise.race([
      checkForUpdate(VERSION, GITHUB_TOKEN, updateAbortController.signal),
      new Promise<null>((res) =>
        setTimeout(() => {
          updateAbortController.abort();
          res(null);
        }, 2000),
      ),
    ]).catch(() => null);
    if (latestTag) {
      const w = 55;
      // Fix: compute all widths from totalWidth so corners always align.
      // totalWidth = w + 4 ("│ " + w content chars + " │")
      const totalWidth = w + 4;
      const headerPrefix = "╭─";
      const headerLabel = " Update available ";
      const headerDashes = "─".repeat(
        Math.max(0, totalWidth - headerPrefix.length - headerLabel.length - 1),
      );
      const bottomBar = "─".repeat(totalWidth - 2);
      const pad = (s: string) => s + " ".repeat(Math.max(0, w - s.length));
      process.stderr.write(
        pc.yellow(
          [
            `${headerPrefix}${headerLabel}${headerDashes}╮`,
            `│ ${pad(`github-code-search ${VERSION} → ${latestTag}`)} │`,
            `│ ${pad("Run: github-code-search upgrade")} │`,
            `╰${bottomBar}╯`,
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
      excludeTemplates,
      opts.groupByTeamPrefix,
      opts.regexHint ?? "",
      Object.keys(pickTeams).length > 0 ? pickTeams : {},
    );
  }
}

// ─── CLI Definition ──────────────────────────────────────────────────────────

program
  .name("github-code-search")
  .version(VERSION_FULL, "-V, --version", "Output version, commit, OS and architecture")
  .description("Interactive GitHub code search with per-repo aggregation")
  .configureHelp(helpFormatConfig)
  .addHelpText(
    "after",
    helpSection("Documentation:", "https://fulll.github.io/github-code-search/"),
  );

// `upgrade` subcommand — does NOT require GITHUB_TOKEN (uses it only if set)
program
  .command("upgrade")
  .description("Check for a new release and auto-upgrade the binary")
  .configureHelp(helpFormatConfig)
  .addHelpText(
    "after",
    helpSection("Documentation:", "https://fulll.github.io/github-code-search/usage/upgrade"),
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
    try {
      const { refreshCompletions } = await import("./src/upgrade.ts");
      const refreshedPath = await refreshCompletions(detectShell(), undefined, opts.debug);
      if (refreshedPath) {
        process.stdout.write(`✓ Shell completions installed/refreshed at ${refreshedPath}\n`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const prefix = opts.debug ? "[debug] " : "warning: ";
      process.stdout.write(`${prefix}failed to refresh shell completions: ${message}\n`);
    }
    process.exit(0);
  });

// `completions` subcommand — print a shell completion script to stdout
program
  .command("completions")
  .description("Print a shell completion script for bash, zsh or fish")
  .configureHelp(helpFormatConfig)
  .addHelpText(
    "after",
    helpSection("Documentation:", "https://fulll.github.io/github-code-search/usage/upgrade"),
  )
  .option(
    "--shell <shell>",
    ["Target shell: bash, zsh or fish.", "Auto-detected from $SHELL when omitted."].join("\n"),
  )
  .action((opts: { shell?: string }) => {
    const shell = opts.shell ?? detectShell();
    if (!shell) {
      writeFileSync(
        2,
        `error: could not detect shell. Use --shell bash|zsh|fish to specify it explicitly.\n`,
      );
      process.exit(1);
    }
    try {
      writeFileSync(1, generateCompletion(shell) + "\n");
    } catch (e: unknown) {
      writeFileSync(2, `error: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    }
    process.exit(0);
  });

// `query` subcommand — the default (backward-compat: `gcs <query> --org <org>`)
const queryCmd = addSearchOptions(
  new Command("query")
    .description("Search GitHub code (default command when no subcommand given)")
    .configureHelp(helpFormatConfig)
    .addHelpText(
      "after",
      helpSection(
        "Documentation:",
        "https://fulll.github.io/github-code-search/usage/search-syntax",
      ),
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
