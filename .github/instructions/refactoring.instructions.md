---
applyTo: "**"
excludeAgent: "code-review"
---

# Refactoring — instructions for Copilot coding agent

Follow these steps when refactoring existing code in this repository.

## 1. Define the goal and scope

A good refactoring task has a clearly bounded scope. Before making any change, identify:

- Which module(s) are affected (consult `AGENTS.md` for the layer map).
- Whether the public API (exported symbols, CLI options) is changing or staying the same.
- Whether the refactoring is purely internal (no behavior change) or also simplifies the API.

**Prefer behaviour-preserving refactorings.** If the public API must change, document it explicitly in the PR.

## 2. Do not break the architectural boundaries

This codebase enforces a strict layering:

- **Pure functions** must stay pure — do not introduce side effects (I/O, global state, `Date.now()`, `Math.random()`) into `aggregate.ts`, `group.ts`, `output.ts`, or `render/` sub-modules.
- **I/O is isolated** in `api.ts`, `tui.ts` and `github-code-search.ts`. Keep it there.
- **`render.ts` is a façade** — if you move or rename symbols in `render/`, update the re-exports in `render.ts` accordingly.
- **`types.ts` is the single source of truth** — if you merge or rename interfaces, update all usages across the codebase.

## 3. Verify test coverage first

Before touching code:

```bash
bun test    # baseline — all tests must be green before you start
```

If the area you are refactoring lacks tests, **add tests before refactoring** (characterisation tests). This ensures you can verify the refactoring is behaviour-preserving.

## 4. Make changes incrementally

- Refactor one logical unit at a time (one function, one module boundary).
- Run `bun test` after each meaningful step to catch regressions early.
- Avoid mixing a refactoring with a feature addition in the same commit; separate concerns.

## 5. Update all usages when renaming

If you rename an exported function, type or constant:

- Update every import site across the codebase — use a global search before renaming.
- Update `render.ts` if the renamed symbol is re-exported there.
- Update `src/types.ts` if it's a shared type.
- Run `bun run knip` to detect any forgotten reference.

## 6. Keep `knip` clean

Every exported symbol must be used. After a refactoring:

```bash
bun run knip    # zero unused exports / imports
```

Remove dead code rather than leaving it commented out.

## 7. Validation checklist

```bash
bun test               # full suite passes — same behaviour before and after
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no formatting diff
bun run knip           # no unused exports or imports
bun run build.ts       # binary compiles without errors
```

## 8. Commit & pull request

- Branch name: `refactor/<short-description>` (e.g. `refactor/extract-filter-module`).
- Commit message: imperative mood, e.g. `Extract FilterStats helpers into render/filter.ts`.
- **All commits must be signed** (GPG or SSH). Configure once with `git config --global commit.gpgsign true`.
  Commits pushed via the GitHub API (Copilot Coding Agent, MCP tools) are automatically Verified by GitHub.
- PR description: what was restructured, why, and a note confirming no behaviour change.
