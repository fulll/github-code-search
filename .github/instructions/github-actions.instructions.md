---
applyTo: ".github/workflows/**"
---

# GitHub Actions — instructions for Copilot coding agent

> **Skill reference:** for the full best-practices guide, action-pinning decision table, composite action patterns and PR comment strategies read `.github/skills/github-actions.md` first.

Follow these steps when creating or modifying GitHub Actions workflows in this repository.

## 1. File conventions

- All workflow files use the **`.yaml`** extension (not `.yml`).
- File names use **kebab-case**: `a11y.yaml`, `lighthouse.yaml`, `docs.yaml`.
- Every workflow must start with a block comment explaining its purpose, triggers and strategy.

## 2. Pinning third-party actions

**Every third-party action (anything not `actions/*` from GitHub itself) MUST be pinned
to an exact commit SHA, never to a tag or a branch.**

```yaml
# ✅ correct — SHA-pinned with tag comment
uses: owner/repo@<40-char-sha> # v1.2.3

# ❌ wrong — mutable tag
uses: owner/repo@v1

# ❌ wrong — branch (can be force-pushed)
uses: owner/repo@main
```

To resolve a tag to its commit SHA:

```bash
git ls-remote https://github.com/<owner>/<repo>.git refs/tags/<tag> refs/tags/<tag>^{}
# The ^{} peeled SHA (second line, if present) is the actual commit. Use that one.
```

Add a comment `# v1.2.3` to the right of the hash so the version is human-readable.

**First-party GitHub actions** (`actions/checkout`, `actions/upload-artifact`, etc.) should
also be pinned. Always resolve the latest released tag before using any action.

## 3. Coordinated version upgrades

When bumping an action version, update **every workflow file** that uses it in the same commit.
Actions that appear in multiple workflows (e.g. `actions/checkout`, `oven-sh/setup-bun`) must
always reference **the same commit SHA** across all files. Use `grep` to find all usages before
opening a PR.

```bash
grep -r "oven-sh/setup-bun" .github/workflows/
```

## 4. DRY — composite action for shared steps

If two or more workflows share identical steps (e.g. starting a preview server, waiting for it
to be ready), extract them into a **composite action** under `.github/actions/<name>/action.yml`.

```yaml
# In a workflow:
- name: Start VitePress preview server
  uses: ./.github/actions/start-preview-server
```

The composite action must declare all inputs with defaults and document each one. Never
duplicate multi-step shell sequences across workflows.

## 5. PR comment reports

Every workflow that produces a structured report (audit scores, coverage, test results) **must**:

1. Generate a formatted Markdown summary (table preferred).
2. Post it as a **sticky PR comment** using
   `marocchino/sticky-pull-request-comment@<sha> # v2.9.4` with a unique `header:` value
   so the comment is updated (not duplicated) on each push to the PR.
3. Use `actions/github-script` to build the comment body when the data comes from JSON files
   produced by the workflow (avoids shelling out to `jq` / Python).

```yaml
- name: Generate scores comment
  id: comment-body
  if: github.event_name == 'pull_request'
  uses: actions/github-script@<sha> # v7
  with:
    result-encoding: string
    script: |
      // ... parse JSON, build Markdown table, return body

- name: Post / update comment on PR
  if: github.event_name == 'pull_request'
  uses: marocchino/sticky-pull-request-comment@<sha> # v2.9.4
  with:
    header: <unique-identifier>
    message: ${{ steps.comment-body.outputs.result }}
```

## 6. Minimum required permissions

Set `permissions: contents: read` at the **workflow level** as the default.
Override to `write` **at the job level** only for the exact permissions needed:

```yaml
permissions:
  contents: read # workflow-level default (principle of least privilege)

jobs:
  audit:
    permissions:
      contents: read
      pull-requests: write # needed only to post the PR comment
```

## 7. Concurrency

Every workflow that produces side-effects (deploy, comment, upload) must define a
`concurrency` block to cancel stale runs:

```yaml
concurrency:
  group: <workflow-name>-${{ github.ref }}
  cancel-in-progress: true
```

## 8. Validation checklist before opening a PR

```bash
# Lint all workflow files locally (requires actionlint):
actionlint .github/workflows/*.yaml .github/actions/**/*.yml

# Confirm every action is pinned:
grep -rn "uses:" .github/workflows/ | grep -v "@[a-f0-9]\{40\}"
# → must return nothing
```

Also verify:

- [ ] All `.yml` workflow files have been renamed to `.yaml`
- [ ] Every new third-party action has a `# vX.Y.Z` comment after its SHA
- [ ] New reusable composite actions are under `.github/actions/<name>/action.yml`
- [ ] The workflow self-references the correct filename (e.g. in `paths:`)
- [ ] `pull-requests: write` is set only on jobs that post comments
- [ ] No `bunx` in workflow `run:` steps — use binaries from `node_modules/.bin/` or
      scripts defined in `package.json` via `bun run <script>`
