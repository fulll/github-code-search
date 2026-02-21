---
applyTo: "**"
excludeAgent: "code-review"
---

# Implement feature — instructions for Copilot coding agent

Follow these steps when implementing a new feature in this repository.

## 1. Understand the task scope before writing code

- Read the issue description and acceptance criteria carefully.
- Identify which modules will host the new logic (check `src/types.ts`, `AGENTS.md` and existing modules for context).
- If the feature introduces a new shared type, add it to `src/types.ts` before touching anything else.
- If the feature touches the CLI surface, the entry point is `github-code-search.ts` (Commander subcommands).

## 2. Follow the architectural boundaries

| Layer               | Location                                          | Rule                                            |
| ------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Shared types        | `src/types.ts`                                    | All new interfaces go here                      |
| Pure business logic | `src/aggregate.ts`, `src/group.ts`, `src/render/` | Pure functions only — no I/O                    |
| Output formatting   | `src/output.ts`                                   | Markdown and JSON renderers                     |
| Rendering façade    | `src/render.ts`                                   | Re-export new sub-module symbols here           |
| API calls           | `src/api.ts`                                      | Only place allowed to call GitHub REST API      |
| TUI interaction     | `src/tui.ts`                                      | Only place allowed to read stdin / write to TTY |
| CLI parsing         | `github-code-search.ts`                           | Commander options and subcommands               |
| Auto-upgrade        | `src/upgrade.ts`                                  | Binary self-replacement logic                   |

Never mix pure logic with I/O. If a new feature requires both, split it: write a pure function in the appropriate module and call it from `api.ts`, `tui.ts` or `github-code-search.ts`.

## 3. Adding a new render sub-module

If the feature introduces a new rendering concern (e.g. a new display component):

1. Create `src/render/<name>.ts` with pure functions.
2. Export the new symbols from `src/render.ts` (the façade).
3. Import from `src/render.ts` in consumers — never directly from `src/render/<name>.ts`.

## 4. Write tests for every new pure function

- Create or update `src/<module>.test.ts` (co-located with the source file).
- Use `describe` / `it` / `expect` from Bun's built-in test runner.
- Tests must be self-contained: no network calls, no filesystem side effects.
- Cover edge cases: empty arrays, undefined/null guards, boundary values.
- Run `bun test` to verify the full suite passes before considering the implementation done.

## 5. Update the CLI documentation if the public interface changes

- If a new CLI option or subcommand is added, update `README.md` (usage section, options table, examples).
- If a new flag requires additional GitHub token scopes, document them in `README.md` and `AGENTS.md`.

## 6. Validation checklist

Before opening the pull request, ensure every item passes:

```bash
bun test               # all tests green
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no formatting diff
bun run knip           # no unused exports or imports
bun run build.ts       # binary compiles without errors
```

## 7. Commit & pull request

- Branch name: `feat/<short-description>` (e.g. `feat/json-output-type`).
- Commit message: imperative mood, e.g. `Add --output-type flag for JSON format`.
- PR description: motivation, what changed, how to test manually.
