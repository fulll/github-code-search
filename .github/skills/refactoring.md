# Refactoring skill — github-code-search

Deep reference for safe refactoring in this codebase.
This skill complements `.github/instructions/refactoring.instructions.md`.

---

## Architectural invariants — what MUST NOT change

These constraints are non-negotiable. Any refactoring that would violate them must be restructured:

| Invariant                                                                                 | Why                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pure functions in `aggregate.ts`, `group.ts`, `output.ts`, `render/` have no side effects | Makes them deterministically unit-testable; any I/O breaks the test suite |
| All network I/O lives exclusively in `src/api.ts`                                         | Single audit surface for rate limits, auth, retry logic                   |
| All TTY I/O lives exclusively in `src/tui.ts`                                             | Enables headless (`--output-type`) usage without a TTY                    |
| `src/types.ts` is the single source of truth for shared interfaces                        | Prevents type drift across modules                                        |
| `src/render.ts` is the façade — consumers never import from `render/` directly            | Allows internal restructuring without changing import sites               |
| `src/api-utils.ts` and `src/cache.ts` are used only by `src/api.ts`                       | Keeps side-effectful helpers bounded                                      |

---

## Safe rename playbook

Before renaming an exported symbol:

1. **Find all usages** — grep or `list_code_usages` for the symbol name across the entire codebase.
2. **Check `render.ts` re-exports** — if the symbol is re-exported there, update the `export { … }` line.
3. **Check `src/types.ts`** — if it's a shared type, update all field/parameter references.
4. After renaming, run:
   ```bash
   bun run knip   # must report zero unused exports
   bun test       # must stay green
   ```

**Particularly common re-exports in `render.ts`:**

```typescript
export { buildRows, rowTerminalLines, isCursorVisible } from "./render/rows.ts";
export { buildFilterStats } from "./render/filter.ts";
export { applySelectAll, applySelectNone } from "./render/selection.ts";
export { buildSummary, buildSummaryFull, buildSelectionSummary } from "./render/summary.ts";
export { highlightFragment } from "./render/highlight.ts";
```

---

## Extracting a new module

Pattern when a module (e.g. `aggregate.ts`) grows too large:

1. Identify the cohesive set of functions to extract.
2. Create `src/<new-module>.ts` with those functions.
3. Re-export from the original module to preserve backward-compat **during the transition**:
   ```typescript
   // src/aggregate.ts — temporary re-export
   export { newHelper } from "./new-module.ts";
   ```
4. Update all actual import sites to use the new module directly.
5. Remove the temporary re-export from the original module.
6. Run `bun run knip` — must be clean.

---

## Characterisation tests (test before refactoring)

When the area to refactor has no (or insufficient) tests, write characterisation tests first:

```typescript
// Capture current behaviour as-is — test name documents what the code DOES, not what it SHOULD do
it("returns flat list when no team prefix matches", () => {
  const result = groupByTeamPrefix(matches, []);
  expect(result).toEqual([{ teamName: null, repos: matches }]);
});
```

Run the suite to confirm the characterisation tests pass with the original code. Then refactor — the tests now act as a safety net.

---

## Moving a type in `src/types.ts`

If a type needs to be split or renamed:

1. Add the new name first (keep the old name as a `type` alias temporarily):
   ```typescript
   // new name
   export interface NewName { … }
   // backward-compat alias — remove once all consumers updated
   export type OldName = NewName;
   ```
2. Update all consumers to use `NewName`.
3. Remove the `OldName` alias.
4. `bun run knip` — must be clean.

---

## knip — understanding its output

```bash
bun run knip
```

| Output line                | Meaning and fix                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `Unused export 'foo'`      | `foo` is exported but never imported — remove the export or the dead code             |
| `Unused file 'src/foo.ts'` | File is not imported anywhere — check if it was intentionally removed from re-exports |
| `Unlisted dependency`      | A package is used but not in `package.json` — add it                                  |

`knip.json` configures the project entry points and ignore lists. Check it before concluding a false positive.

---

## Validation checklist

```bash
bun test               # full suite passes — same behaviour before and after
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no formatting diff
bun run knip           # no unused exports or imports
bun run build.ts       # binary compiles without errors
```
