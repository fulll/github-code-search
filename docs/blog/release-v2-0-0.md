---
title: "What's new in v2.0.0"
description: "Hierarchical team-prefix grouping with nested headings, auto-pick, and exclusions — plus GCS_DEFAULT_ORG and gh CLI token fallback. Breaking change to --group-by-team-prefix and JSON output."
date: 2026-09-19
---

# What's new in github-code-search v2.0.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v2.0.0>

This is a **major** release: `--group-by-team-prefix` now supports a full hierarchy instead of a single flat level, which changes the markdown heading structure and the JSON output shape for anyone already using it. See [Breaking changes](#breaking-changes) below before upgrading.

## Highlights

### Hierarchical team-prefix grouping

`--group-by-team-prefix` now accepts a small chain grammar instead of a flat, comma-separated prefix list:

- `/` nests levels **within one chain** — group by the first prefix, then sub-group each section by the next prefix.
- `,` separates **independent chains** — each grouped on its own, against whatever repos earlier chains haven't already claimed.

```bash
# Group by tribe- first, then by squad- within each tribe
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix tribe-/squad-
```

Markdown output renders one heading level per depth (`##`, `###`, `####`, … capped at H6), and JSON output now carries the full hierarchy per result as a `section` array:

```json
{
  "repo": "myorg/mobile-app",
  "section": ["tribe-b", "squad-core + squad-mobile"],
  "matches": [{ "path": "src/index.ts", "url": "...", "line": 1, "col": 1 }]
}
```

Team names that overlap within one level (e.g. `squad-a` and `squad-a-legacy`) are now **combined automatically** into one section instead of appearing as unrelated siblings.

### `--pick-team` at every hierarchy level

`--pick-team` and interactive pick mode (`p`) now resolve combined sections at **any depth** of the hierarchy, not just the top level — the same workflow from v1.11.0, extended to nested chains.

### `--pick-team-auto` — resolve ambiguous sections automatically

New flag: auto-resolves combined sections whose team names share a common prefix (e.g. `tribe-a + tribe-a-p1` → `tribe-a`), without an explicit `--pick-team`. It also clusters combos that share a recurring team across siblings even without a literal common prefix, and always defers to an explicit `--pick-team` for the same section.

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix tribe-/squad- \
  --pick-team-auto
```

### `--exclude-team-prefixes` — strip noisy team names before grouping

Some orgs have many closely related, deeply-overlapping team names under one prefix. `--exclude-team-prefixes` removes matching teams from consideration **before** grouping runs, reducing ambiguous combos at the source:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --group-by-team-prefix tribe-/squad- \
  --exclude-team-prefixes squad-validators-
```

### `GCS_DEFAULT_ORG` — skip `--org` on every call

If you mostly search a single organization, set it once and omit `--org` entirely:

```bash
export GCS_DEFAULT_ORG=my-org
github-code-search "useFeatureFlag"
```

An explicit `--org` flag always takes precedence.

### `GITHUB_TOKEN` fallback via the GitHub CLI

If `GITHUB_TOKEN` isn't set and the [GitHub CLI](https://cli.github.com/) is installed and authenticated, `github-code-search` now retrieves a token automatically via `gh auth token` — no extra setup needed. Applies to the search commands and the `upgrade` subcommand.

### Also in this release

- Fixed a systematic ~2 s exit delay after printing results, in both interactive and non-interactive (`--no-interactive` / CI) mode.
- Removed the `picocolors` dependency in favor of a native `util.styleText` facade — no behavior change, one less external dependency.
- Bumped the minimum required Bun version to **1.4** (native `Bun.stringWidth` / `stripANSI` / `sliceAnsi` and `util.styleText` are used at runtime).
- Routine dependency upgrades.

## Breaking changes

- **Removed** `--group-by-team-prefix-consolidate` and the underlying consolidated-rendering mode. In practice, `--pick-team-auto` covers the real need (resolving ambiguous combined sections) more reliably — if you used the consolidate flag, switch to `--pick-team-auto` and/or `--exclude-team-prefixes`.
- Markdown output can now render **more than one heading level** (`##`/`###`/`####`…) when a multi-level chain (`tribe-/squad-`) is used, instead of always a single flat `##` level.
- JSON output gains a **`section` array** per result when `--group-by-team-prefix` is used (previously JSON carried no section/team information at all).

Plain, single-level `--group-by-team-prefix squad-` usage (no `/`) is unaffected — you'll only notice a difference if you adopt the new chain syntax or previously relied on `--group-by-team-prefix-consolidate`.

## Upgrade

```sh
github-code-search upgrade
```

Or download the latest binary from
[GitHub Releases](https://github.com/fulll/github-code-search/releases/tag/v2.0.0).
