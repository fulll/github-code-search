---
applyTo: "**"
excludeAgent: "code-review"
---

# Release — instructions for Copilot coding agent

Follow these steps when cutting a new release of `github-code-search`.

## 1. Determine the version bump

This project follows [Semantic Versioning](https://semver.org/):

| Change type                                    | Bump    | Example       |
| ---------------------------------------------- | ------- | ------------- |
| Bug fix only (no new behaviour, no API change) | `patch` | 1.2.4 → 1.2.5 |
| New feature, backward-compatible               | `minor` | 1.2.4 → 1.3.0 |
| Breaking change (CLI flag removed/renamed)     | `major` | 1.2.4 → 2.0.0 |

## 2. Bump the version

```bash
bun pm version patch   # or minor / major
```

If the working tree is dirty (staged or unstaged changes), `bun pm version` will refuse. In that case bump directly in `package.json`, then commit the version bump as the first commit on the release branch.

## 3. Write the blog post

**Required for minor and major releases. Optional (but encouraged) for patch releases.**

1. Create `docs/blog/release-v<X-Y-Z>.md` — use existing posts as format reference:
   - `docs/blog/release-v1-3-0.md` (minor, feature-focused)
   - `docs/blog/release-v1-4-0.md` (minor, TUI/community-focused)
   - Front-matter: `title`, `description`, `date` (ISO 8601).
   - Structure: `## Highlights` → one `###` section per major change group → `## Upgrade` at the bottom.
   - The upgrade section must include the `github-code-search upgrade` command and a link to the GitHub Releases page.

2. Update `docs/blog/index.md` — prepend a row to the `## v1 series` table:

   ```markdown
   | [vX.Y.Z](./release-vX-Y-Z) | One-line summary of highlights |
   ```

3. Update `CHANGELOG.md` — update (or add) the matching row in the table:
   ```markdown
   | [vX.Y.Z](https://fulll.github.io/github-code-search/blog/release-vX-Y-Z) | One-line summary |
   ```
   Never leave a row with `_pending_` in `CHANGELOG.md` when cutting the release.

## 4. Create the release branch and commit

```bash
VERSION=$(jq -r .version package.json)
git checkout -b release/$VERSION
git add package.json docs/blog/release-v*.md docs/blog/index.md CHANGELOG.md
git commit -S -m "v$VERSION"
```

> **All commits must be signed** — use `git commit -S` or `git config --global commit.gpgsign true`.

## 5. Tag and push

```bash
VERSION=$(jq -r .version package.json)
git tag v$VERSION
git push origin release/$VERSION --tags
```

The tag push triggers **`cd.yaml`**:

1. Builds self-contained binaries for all six targets.
2. Creates a GitHub Release with all binaries attached.
3. For major tags (`vX.0.0`): triggers `docs.yml` → docs snapshot + `versions.json` update.

Do **not** create the GitHub Release manually — the CD pipeline handles it.

## 6. Required validation before tagging

```bash
bun test               # full suite green
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no diff
bun run knip           # no unused exports
bun run build.ts       # binary compiles
```

## 7. Post-release checklist

- [ ] GitHub Release created automatically by CD pipeline (verify within ~5 min after tag push)
- [ ] Blog post live at `https://fulll.github.io/github-code-search/blog/release-vX-Y-Z`
- [ ] `bun run docs:build` succeeds locally (spot-check the new blog entry)
- [ ] `CHANGELOG.md` has no `_pending_` entries
- [ ] For **major** releases: versioned docs snapshot available at `/github-code-search/vX/`

## 8. Module map — what to document per release type

| Changed area              | Cover in the blog post                                          |
| ------------------------- | --------------------------------------------------------------- |
| `src/tui.ts`              | UX / interaction changes (keyboard shortcuts, new modes)        |
| `src/render/`             | Visual changes (colours, layout, new components)                |
| `src/aggregate.ts`        | New filter or exclusion options                                 |
| `src/group.ts`            | Team-grouping behaviour changes                                 |
| `src/output.ts`           | New output formats or structural changes to existing ones       |
| `src/api.ts`              | New GitHub API features, pagination changes, scope requirements |
| `src/upgrade.ts`          | Upgrade command improvements                                    |
| `github-code-search.ts`   | New CLI flags, subcommands, breaking option renames             |
| Community / project files | SECURITY, CODE_OF_CONDUCT, CONTRIBUTING changes worth surfacing |
