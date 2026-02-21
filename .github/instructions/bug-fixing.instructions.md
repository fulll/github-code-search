---
applyTo: "**"
excludeAgent: "code-review"
---

# Bug fixing — instructions for Copilot coding agent

Follow these steps when fixing a bug in this repository.

## 1. Reproduce the bug before writing any fix

A bug report should include:

- The exact command that was run (with `GITHUB_TOKEN` redacted).
- The observed vs. expected behaviour.
- The `github-code-search --version` output (contains commit SHA, OS, architecture).

If the report is incomplete, do not guess. Review the relevant module(s) to locate the most likely root cause.

## 2. Locate the root cause

Use the module map in `AGENTS.md` to identify where the bug likely lives:

| Symptom                                | Look in                            |
| -------------------------------------- | ---------------------------------- |
| Wrong grouping / filtering of results  | `src/aggregate.ts`, `src/group.ts` |
| Incorrect markdown / JSON output       | `src/output.ts`                    |
| Wrong syntax highlighting              | `src/render/highlight.ts`          |
| Bad row navigation or visibility       | `src/render/rows.ts`               |
| Incorrect select-all / select-none     | `src/render/selection.ts`          |
| Wrong stats / summary line             | `src/render/summary.ts`            |
| Filter stats incorrect                 | `src/render/filter.ts`             |
| API pagination or rate-limit issue     | `src/api.ts`                       |
| TUI keyboard handling / display glitch | `src/tui.ts`                       |
| Upgrade failure                        | `src/upgrade.ts`                   |
| CLI option parsing / defaults          | `github-code-search.ts`            |

## 3. Write a failing test before fixing

For any bug in a pure-function module (`aggregate.ts`, `group.ts`, `output.ts`, `render/`):

1. Open (or create) the companion `*.test.ts` file.
2. Write a test case that reproduces the exact bug scenario and **fails** with the current code.
3. Commit the failing test first (or keep it as part of the same commit with the fix, clearly noted).

This ensures the fix is verified and the regression cannot reappear undetected.

For bugs in `tui.ts` or `api.ts` (side-effectful code), a test may not be practical — document the manual reproduction steps in the PR instead.

## 4. Apply the minimal fix

- Fix only the root cause. Do not refactor unrelated code in the same PR.
- Respect the layering: pure functions stay pure, I/O stays in `api.ts` / `tui.ts` / entry point.
- If fixing the bug requires a type change in `src/types.ts`, update all usages across the codebase.

## 5. Verify the fix

```bash
bun test               # the previously failing test now passes; full suite still green
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no formatting diff
bun run knip           # no unused exports or imports
bun run build.ts       # binary compiles without errors
```

## 6. Regression note

Add a one-line comment above the fix if the root cause is non-obvious:

```typescript
// Fix: <what was wrong and why> — see issue #<N>
```

## 7. Commit & pull request

- Branch name: `fix/<short-description>` (e.g. `fix/exclude-repos-with-org-prefix`).
- Commit message: imperative mood, e.g. `Fix --exclude-repositories ignoring org-prefixed names`.
- PR description:
  - Root cause explanation.
  - Steps to reproduce (before the fix).
  - Steps to verify (after the fix).
  - Reference to the issue number.
