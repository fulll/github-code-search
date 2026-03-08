# GitHub Actions — skill reference

This skill covers all aspects of creating and maintaining GitHub Actions workflows in this
repository. Read this before writing or modifying any `.github/workflows/*.yaml` file.

---

## Architecture overview

```
.github/
  actions/
    start-preview-server/     ← composite reusable action (shared server start logic)
      action.yml
  workflows/
    ci.yaml                   ← unit tests, format, lint, knip + coverage PR comment
    cd.yaml                   ← binary build + GitHub Release on tag push
    docs.yaml                 ← VitePress Pages deploy + versioned snapshot
    a11y.yaml                 ← WCAG 2.1 AA audit via pa11y-ci
    lighthouse.yaml           ← Lighthouse CI eco-design budgets + PR comment
    responsive.yaml           ← Playwright mobile viewport checks
```

### Composite action: `start-preview-server`

Shared by `a11y.yaml` and `responsive.yaml`. Starts `bun run docs:preview --port <port>`
in the background and polls the base URL until it responds, then exits. Inputs: `port`,
`base`, `timeout`.

`lighthouse.yaml` does **not** use this action because LHCI manages the server lifecycle
internally via `startServerCommand` in the `docs:lhci` script.

---

## Action pinning policy

### Security rationale

Tags (e.g. `@v4`) can be force-pushed to point to different commits. Pinning to a commit SHA
ensures the exact code that was reviewed is what runs in production.

### Resolution procedure

```bash
# Resolve an annotated or lightweight tag to its underlying commit SHA.
# The ^{} peeled form (second line) is the actual commit; use that if present.
git ls-remote https://github.com/<owner>/<repo>.git \
  refs/tags/<tag> refs/tags/<tag>^{}
```

### Pinning format

```yaml
uses: owner/repo@<40-char-sha> # v1.2.3
```

The `# vX.Y.Z` comment is **required**. It lets maintainers immediately see what version
a SHA corresponds to without running `git ls-remote` manually.

### Current versions in use

| Action                                   | Version | SHA                                        |
| ---------------------------------------- | ------- | ------------------------------------------ |
| `actions/checkout`                       | v6.0.2  | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` |
| `oven-sh/setup-bun`                      | v2.1.3  | `ecf28ddc73e819eb6fa29df6b34ef8921c743461` |
| `actions/upload-artifact`                | v7.0.0  | `bbbca2ddaa5d8feaa63e36b76fdaad77386f024f` |
| `actions/upload-pages-artifact`          | v3.0.1  | `56afc609e74202658d3ffba0e8f6dda462b719fa` |
| `actions/deploy-pages`                   | v4.0.5  | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` |
| `actions/github-script`                  | v7      | `f28e40c7f34bde8b3046d885e986cb6290c5673b` |
| `marocchino/sticky-pull-request-comment` | v2.9.4  | `773744901bac0e8cbb5a0dc842800d45e9b2b405` |
| `romeovs/lcov-reporter-action`           | v0.4.0  | `87a815f34ec27a5826abba44ce09bbc688da58fd` |
| `stefanzweifel/git-auto-commit-action`   | v5.0.1  | `8621497c8c39c72f3e2a999a26b4ca1b5058a842` |
| `bats-core/bats-action`                  | v4.0.0  | `77d6fb60505b4d0d1d73e48bd035b55074bbfb43` |

When upgrading an action, update **every row in this table** and **every workflow file**
referencing that action in the same commit. Use `grep` to find all usages:

```bash
grep -rn "oven-sh/setup-bun" .github/
```

---

## DRY: composite actions

### When to extract a composite action

Extract a sequence of steps into a composite action when **two or more workflows** share
the exact same steps — even if the steps look simple. The composite action lives under
`.github/actions/<name>/action.yml`.

### Composite action anatomy

```yaml
name: 'Human-readable name'
description: One-line description.

inputs:
  my-input:
    description: What this input controls.
    default: 'default-value'
    required: false   # set true only if there is no sensible default

runs:
  using: composite
  steps:
    - name: Descriptive step name
      shell: bash
      run: echo "Using input: ${{ inputs.my-input }}"
```

Each shell step in a composite action **must** declare `shell: bash` explicitly —
the runner does not inherit the workflow's default shell.

### Consuming a composite action

```yaml
- name: Start VitePress preview server
  uses: ./.github/actions/start-preview-server
  # with:       ← only if overriding defaults
  #   port: "4173"
```

The path `./.github/actions/<name>` is relative to the **repository root** and works
for both local and CI runs.

---

## PR comment reports

### Pattern

Every workflow that produces structured output (audit scores, coverage, test failures)
should post a **single sticky comment** per PR, updated on every push:

```yaml
- name: Build comment body
  id: report
  if: github.event_name == 'pull_request'
  uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
  with:
    result-encoding: string
    script: |
      // Read JSON output, build Markdown table, return the string.
      return body;

- name: Post / update comment
  if: github.event_name == 'pull_request'
  uses: marocchino/sticky-pull-request-comment@773744901bac0e8cbb5a0dc842800d45e9b2b405 # v2.9.4
  with:
    header: <unique-workflow-id> # e.g. "lighthouse-ci", "coverage", "pa11y"
    message: ${{ steps.report.outputs.result }}
```

The `header:` field is the de-duplication key. Keep it consistent across workflow runs.

### Comment table format

Prefer a Markdown table over prose for numeric/structured results:

```markdown
## 🔦 Lighthouse — Eco-design Report

| Page |  ⚡ Perf  |  ♿ A11y   |   🛡️ BP    |   🔍 SEO   |
| :--- | :-------: | :--------: | :--------: | :--------: |
| `/`  | 🟢 **99** | 🟢 **100** | 🟢 **100** | 🟢 **100** |

> _commit `abc1234` · [full workflow run](https://...)_
```

Use colour-coded dots:

- 🟢 ≥ 90 (pass)
- 🟠 50–89 (warning)
- 🔴 < 50 / missing (fail)

Always include a link to the full workflow run and the short commit SHA.

---

## Permissions policy

Apply the **principle of least privilege**:

```yaml
permissions:
  contents: read # workflow-level default — covers most jobs

jobs:
  report:
    permissions:
      contents: read
      pull-requests: write # only on jobs that post PR comments
```

Never set `pull-requests: write` at the workflow level. The only exception is
`docs.yaml` which needs `contents: write` + `pages: write` + `id-token: write` for
the GitHub Pages deployment.

---

## Concurrency

Cancel outdated runs to avoid wasted minutes and stale PR comments:

```yaml
concurrency:
  group: <workflow-name>-${{ github.ref }}
  cancel-in-progress: true
```

For deploy workflows, set `cancel-in-progress: false` if partial deploys would leave
the Pages site in a broken state; use a more specific group key instead.

---

## Chrome / Puppeteer on Ubuntu runners

Ubuntu `ubuntu-latest` ships `google-chrome-stable`. Skip the ~200 MB Puppeteer
Chromium download and use the system binary:

```yaml
env:
  PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome-stable
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: "1"
```

For Playwright (which bundles its own browsers), install only the required browser:

```yaml
- name: Install Playwright (Chromium only)
  run: ./node_modules/.bin/playwright install --with-deps chromium
```

---

## No `bunx` in CI

Use binaries from installed `devDependencies` directly:

```yaml
# ✅ binary from node_modules/.bin/ via PATH  (added by bun install)
run: ./node_modules/.bin/playwright install --with-deps chromium

# ✅ package.json script
run: bun run docs:a11y

# ❌ bunx — downloads from cache, CWD issues, not reproducible
run: bunx playwright ...
```

Prefer `bun run <script>` over bare binary calls so the full command is documented
in `package.json` and easy to run locally.

---

## Linting workflows locally

Install [actionlint](https://github.com/rhymond/actionlint) and run it before pushing:

```bash
actionlint .github/workflows/*.yaml .github/actions/**/*.yml
```

It checks:

- Correct `uses:` syntax (including SHA format)
- Missing required inputs / typos in action inputs
- Shell syntax errors inside `run:` blocks
- Correct expression syntax in `${{ ... }}`

---

## Good practices checklist

| #   | Rule                                                      | Why                                   |
| --- | --------------------------------------------------------- | ------------------------------------- |
| 1   | All third-party actions pinned to commit SHA              | Supply-chain security                 |
| 2   | SHA comment `# vX.Y.Z` on every pinned action             | Human readability                     |
| 3   | Coordinated version bumps across all workflows            | Consistent security posture           |
| 4   | Composite action for shared step sequences                | DRY, single point of maintenance      |
| 5   | Sticky PR comment for every structured report             | Reviewers see impact without clicking |
| 6   | `permissions: contents: read` at workflow level           | Least privilege                       |
| 7   | `pull-requests: write` only on jobs that post             | Scoped elevation                      |
| 8   | `concurrency` block on every workflow                     | No wasted minutes, no stale comments  |
| 9   | No `bunx` in CI — use `bun run` or `./node_modules/.bin/` | Reproducibility                       |
| 10  | All workflow files use `.yaml` extension                  | Team consistency                      |
| 11  | Paths filter includes the workflow file itself            | Re-run when workflow changes          |
| 12  | `if-no-files-found: ignore` on artifact uploads           | No spurious failures on skip paths    |
