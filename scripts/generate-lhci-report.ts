#!/usr/bin/env bun
/**
 * Generate a concise Lighthouse CI summary from LHR JSON results.
 *
 * Reads assertion thresholds from .lhci.config.cjs so dot colours and
 * pass/fail status always reflect what `lhci assert` enforces.
 * Links to full uploaded HTML reports are read from links.json
 * (produced by `lhci upload --target=temporary-public-storage`).
 *
 * Exit codes:
 *   0 — all "error"-level assertions pass
 *   1 — one or more "error"-level assertions fail
 *
 * Usage:
 *   bun scripts/generate-lhci-report.ts [options]
 *
 * Options:
 *   --dir    <path>   Directory containing lhr-*.json / links.json  (default: .lighthouseci)
 *   --config <path>   Path to .lhci.config.cjs                      (default: .lhci.config.cjs)
 *   --out    <path>   Write report to file instead of stdout         (default: stdout)
 */

import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// ── CLI arg parsing ──────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function getArg(flag: string, def: string): string {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}

const lhciDir = resolve(getArg("--dir", ".lighthouseci"));
const configPath = resolve(getArg("--config", ".lhci.config.cjs"));
const outPath = getArg("--out", "");

// ── Load LHCI config (CJS) ───────────────────────────────────────────────────

let lhciConfig: Record<string, unknown> = {};
if (existsSync(configPath)) {
  const req = createRequire(import.meta.url);
  lhciConfig = req(configPath) as Record<string, unknown>;
}

type AssertionEntry = [string, Record<string, unknown>] | string;
type RawAssertions = Record<string, AssertionEntry>;

const rawAssertions: RawAssertions =
  ((lhciConfig as any)?.ci?.assert?.assertions as RawAssertions) ?? {};

interface AssertionRule {
  level: "error" | "warn" | "off";
  minScore?: number;
}

function parseRule(rule: AssertionEntry): AssertionRule {
  if (rule === "off") return { level: "off" };
  if (typeof rule === "string") return { level: rule as "error" | "warn" };
  const [level, opts] = rule;
  return {
    level: level as "error" | "warn",
    minScore: (opts?.minScore as number) ?? undefined,
  };
}

const assertions = new Map<string, AssertionRule>(
  Object.entries(rawAssertions).map(([k, v]) => [k, parseRule(v)]),
);

// ── Load LHR files ───────────────────────────────────────────────────────────

if (!existsSync(lhciDir)) {
  process.stderr.write(`Error: directory not found: ${lhciDir}\n`);
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LHR = Record<string, any>;

const lhrs: LHR[] = readdirSync(lhciDir)
  .filter((f) => /^lhr-.*\.json$/.test(f))
  .flatMap((f) => {
    try {
      return [JSON.parse(readFileSync(join(lhciDir, f), "utf8")) as LHR];
    } catch {
      return [];
    }
  });

if (!lhrs.length) {
  process.stderr.write(`Error: no lhr-*.json files found in ${lhciDir}\n`);
  process.exit(1);
}

// ── Group by URL, take median run (by performance score) ────────────────────

const byUrl = new Map<string, LHR[]>();
for (const lhr of lhrs) {
  const url: string = lhr.finalUrl ?? lhr.requestedUrl ?? "";
  const key = url.replace(/^https?:\/\/localhost:\d+/, "");
  if (!byUrl.has(key)) byUrl.set(key, []);
  byUrl.get(key)!.push(lhr);
}

function medianRun(runs: LHR[]): LHR {
  if (runs.length === 1) return runs[0];
  const sorted = runs.toSorted(
    (a, b) => (a.categories?.performance?.score ?? 0) - (b.categories?.performance?.score ?? 0),
  );
  return sorted[Math.floor(sorted.length / 2)];
}

const urlRuns = new Map<string, LHR>(
  [...byUrl.entries()].map(([url, runs]) => [url, medianRun(runs)]),
);

// ── Load upload links (optional) ─────────────────────────────────────────────

// links.json format: { "http://localhost:PORT/path": "https://...report.html" }
const linksPath = join(lhciDir, "links.json");
const linksByPath = new Map<string, string>();
if (existsSync(linksPath)) {
  try {
    const raw = JSON.parse(readFileSync(linksPath, "utf8")) as Record<string, string>;
    for (const [localUrl, reportUrl] of Object.entries(raw)) {
      const path = localUrl.replace(/^https?:\/\/localhost:\d+/, "");
      linksByPath.set(path, reportUrl);
    }
  } catch {
    /* ignore parse errors */
  }
}

const hasLinks = linksByPath.size > 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "performance", emoji: "⚡", label: "Perf" },
  { key: "accessibility", emoji: "♿", label: "A11y" },
  { key: "best-practices", emoji: "🛡️", label: "BP" },
  { key: "seo", emoji: "🔍", label: "SEO" },
] as const;

function catRule(catKey: string): AssertionRule {
  return assertions.get(`categories:${catKey}`) ?? { level: "off" };
}

function evalCategory(
  catKey: string,
  score: number | null,
): { pass: boolean; rule: AssertionRule } {
  const rule = catRule(catKey);
  if (rule.level === "off" || rule.minScore == null) return { pass: true, rule };
  return { pass: score != null && score >= rule.minScore, rule };
}

function dot(score: number | null, pass: boolean, level: AssertionRule["level"]): string {
  if (score == null) return "⚪";
  if (pass) return "🟢";
  return level === "error" ? "🔴" : "🟠";
}

function pct(score: number | null): string {
  return score == null ? "n/a" : String(Math.round(score * 100));
}

// ── Build report ─────────────────────────────────────────────────────────────

let hasErrors = false;
const lines: string[] = [];

// Header
lines.push("## 🔦 Lighthouse Report", "");

// Summary table
const catCols = CATEGORIES.map((c) => `${c.emoji} ${c.label}`).join(" | ");
const reportCol = hasLinks ? " Report |" : "";
lines.push(`| Page | ${catCols} |${reportCol}`);
const reportAlign = hasLinks ? ":---:|" : "";
lines.push(`|:---|${CATEGORIES.map(() => ":---:").join("|")}|${reportAlign}`);

for (const [shortUrl, lhr] of urlRuns) {
  const cols = CATEGORIES.map(({ key }) => {
    const score: number | null = lhr.categories?.[key]?.score ?? null;
    const { pass, rule } = evalCategory(key, score);
    if (!pass && rule.level === "error") hasErrors = true;
    const indicator = dot(score, pass, rule.level);
    const threshold = rule.minScore != null ? ` _(≥${Math.round(rule.minScore * 100)})_` : "";
    return `${indicator} **${pct(score)}**${threshold}`;
  });

  const reportCell = hasLinks
    ? ` [🔗 view](${linksByPath.get(shortUrl) ?? linksByPath.get(shortUrl + "/") ?? ""}) |`
    : "";

  lines.push(`| \`${shortUrl || "/"}\` | ${cols.join(" | ")} |${reportCell}`);
}

lines.push("");

// ── Footer ──────────────────────────────────────────────────────────────────

const sha = (process.env.GITHUB_SHA ?? "").slice(0, 7);
const runId = process.env.GITHUB_RUN_ID ?? "";
const repository = process.env.GITHUB_REPOSITORY ?? "";
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runUrl = runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : "";

const categoryThresholds = CATEGORIES.map(({ key, label }) => {
  const rule = catRule(key);
  return rule.minScore != null ? `${label} ≥ ${Math.round(rule.minScore * 100)}` : null;
})
  .filter(Boolean)
  .join(" · ");

lines.push(`> **Thresholds:** ${categoryThresholds}`);

if (sha && runUrl) {
  lines.push(`> _commit \`${sha}\` · [full workflow run](${runUrl})_`);
} else if (sha) {
  lines.push(`> _commit \`${sha}\`_`);
}

if (hasErrors) {
  lines.push("", "> ⚠️ **One or more error-level assertions failed.**");
}

// ── Output ───────────────────────────────────────────────────────────────────

const report = lines.join("\n") + "\n";

if (outPath) {
  writeFileSync(outPath, report, "utf8");
} else {
  process.stdout.write(report);
}

process.exit(hasErrors ? 1 : 0);
