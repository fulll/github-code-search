# Release skill — github-code-search

Deep reference for cutting releases of this project.
This skill complements `.github/instructions/release.instructions.md`.

---

## Version bump — important note

**Never use `bun pm version patch/minor/major` to bump the version.**

Unlike `npm version`, Bun's implementation creates both a git commit _and_ a git
tag in a single operation. This is incompatible with the release workflow:

- The tag must land on the dedicated `release/X.Y.Z` branch, not on `main`.
- The blog post and `CHANGELOG.md` must be committed _before_ the version tag is
  pushed (the CD pipeline reads the tag to build binaries and name the release).
- Undoing an unwanted auto-tag requires `git tag -d vX.Y.Z` locally and
  `git push origin --delete vX.Y.Z` on the remote — easy to forget one of the
  two, which can trigger the CD pipeline prematurely.

**Correct approach:**

```bash
# Bump directly in package.json
sed -i '' 's/"version": ".*"/"version": "X.Y.Z"/' package.json

# Verify
jq -r .version package.json
```

The git commit and tag are created separately in steps 4 and 5.

---

## Semver decision guide

| Change type                                                                    | Bump    | Example       |
| ------------------------------------------------------------------------------ | ------- | ------------- |
| Bug fix only — no new behaviour, no public API change                          | `patch` | 1.2.4 → 1.2.5 |
| New feature — backward-compatible (new flag, new output field, new subcommand) | `minor` | 1.2.4 → 1.3.0 |
| Breaking change — CLI flag removed/renamed, output field removed               | `major` | 1.2.4 → 2.0.0 |

**Edge cases:**

- Adding a new optional CLI flag → `minor`
- Changing default behaviour of an existing flag → `minor` if clearly additive, `major` if output changes
- Fixing a bug that causes output to change (e.g. wrong grouping) → `patch` — it was already broken
- Removing a deprecated flag → `major`

---

## CD pipeline mechanics (`cd.yaml`)

Pushing `vX.Y.Z` triggers the release pipeline automatically:

1. **Build step** — compiles 6 self-contained binaries:

   | Target                   | Output filename                         |
   | ------------------------ | --------------------------------------- |
   | `bun-linux-x64`          | `github-code-search-linux-x64`          |
   | `bun-linux-x64-baseline` | `github-code-search-linux-x64-baseline` |
   | `bun-linux-arm64`        | `github-code-search-linux-arm64`        |
   | `bun-darwin-x64`         | `github-code-search-darwin-x64`         |
   | `bun-darwin-arm64`       | `github-code-search-darwin-arm64`       |
   | `bun-windows-x64`        | `github-code-search-windows-x64.exe`    |

2. **GitHub Release** — created automatically with `generate_release_notes: true` (titles from merged PR + commits since last tag). **Do not create it manually.**

3. **Legacy aliases** — additional filenames published for backward compatibility with pre-v1.2.1 install scripts.

4. **Docs snapshot** (major tags `vX.0.0` only) — triggers `docs.yml` → snapshot job:
   - Builds versioned docs at `/github-code-search/vX/`.
   - Prepends entry to `docs/public/versions.json` and commits back to `main`.

---

## Version badge

`VersionBadge.vue` reads `version` from `package.json` at build time via `vite.define`. It auto-derives the blog post slug (`release-vX-Y-Z`) from the version — no manual update needed. Verify it shows correctly after the docs deploy (~5 min after tag push).

---

## Blog post format

Required for **minor** and **major** releases. Optional for patch (GitHub Release body is sufficient for patch).

> **Always ask the user interactively before writing the blog post.**
> Do not invent highlights, descriptions or examples from code alone.
> Ask at minimum:
>
> - Which changes deserve a `###` section and why?
> - Suggested one-line `description` for the front-matter.
> - Any before/after CLI output or screenshots to illustrate?
>
> Then draft the post and show it to the user for approval before committing.

**Front-matter:**

```yaml
---
title: "github-code-search v1.9.0"
description: "One compelling sentence summarising the release."
date: YYYY-MM-DD
---
```

**Structure:**

````markdown
## Highlights

### <Feature group 1>

<!-- One paragraph + code example if applicable -->

### <Feature group 2>

## Upgrade

```bash
github-code-search upgrade
```
````

Full release notes: [GitHub Releases](https://github.com/fulll/github-code-search/releases/tag/v1.9.0)

````

**Reference posts to study:**
- `docs/blog/release-v1-3-0.md` — feature-focused minor release
- `docs/blog/release-v1-4-0.md` — TUI/community-focused
- `docs/blog/release-v1-8-0.md` — most recent minor

---

## `CHANGELOG.md` format

```markdown
| [v1.9.0](https://fulll.github.io/github-code-search/blog/release-v1-9-0) | One-line summary |
````

Rule: never leave a row with `_pending_` when tagging.

---

## Versioned docs snapshot (major only)

When pushing `vX.0.0`, the `docs.yml → snapshot` job:

1. Runs `bun run docs:build` with `VITEPRESS_BASE=/github-code-search/vX/`.
2. Publishes to `gh-pages` branch under `/vX/`.
3. Prepends `{ "text": "vX (latest)", "link": "/github-code-search/vX/" }` to `docs/public/versions.json`.

The version selector in the VitePress nav (`themeConfig.versionSelector`) reads this file at runtime.

---

## Validation before tagging

```bash
bun test               # full suite green
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no diff
bun run knip           # no unused exports
bun run build.ts       # binary compiles for current platform

# If docs changed:
bun run docs:build
bun run docs:build:a11y
bun run docs:preview -- --port 4173 &
bun run docs:a11y            # 0 pa11y violations
bun run docs:test:responsive # 20/20 Playwright tests green
```
