# Bug fixing skill — github-code-search

Deep reference for diagnosing and fixing bugs in this codebase.
This skill complements `.github/instructions/bug-fixing.instructions.md`.

---

## Symptom → module diagnostic table

| Symptom                                                     | Primary suspect                                 | Secondary suspect                 |
| ----------------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| Results missing or duplicated                               | `src/aggregate.ts`                              | `src/api.ts` (pagination)         |
| Wrong repository grouping                                   | `src/group.ts`                                  | `src/aggregate.ts`                |
| `--exclude-repositories` / `--exclude-extracts` not working | `src/aggregate.ts`                              | `github-code-search.ts` (parsing) |
| Markdown output malformed                                   | `src/output.ts`                                 | —                                 |
| JSON output missing fields or wrong shape                   | `src/output.ts`                                 | `src/types.ts` (interface)        |
| Syntax highlighting wrong colour / wrong language           | `src/render/highlight.ts`                       | —                                 |
| Row navigation skips or wraps incorrectly                   | `src/render/rows.ts`                            | `src/tui.ts` (key handler)        |
| Select-all / select-none inconsistent                       | `src/render/selection.ts`                       | `src/tui.ts`                      |
| Filter count / stats incorrect                              | `src/render/filter.ts`, `src/render/summary.ts` | —                                 |
| Path filter (`/regex/`) doesn't match expected              | `src/render/filter-match.ts`                    | `src/tui.ts` (filter state)       |
| API returns 0 results or stops paginating                   | `src/api.ts`                                    | `src/api-utils.ts`                |
| Rate limit hit / 429 not retried                            | `src/api-utils.ts` (`fetchWithRetry`)           | —                                 |
| TUI shows blank screen or wrong row                         | `src/tui.ts`                                    | `src/render/rows.ts`              |
| Help overlay doesn't appear / has wrong keys                | `src/render.ts` (`renderHelpOverlay`)           | `src/tui.ts`                      |
| Upgrade fails or replaces wrong binary                      | `src/upgrade.ts`                                | —                                 |
| Completion script wrong content                             | `src/completions.ts`                            | —                                 |
| Completion file written to wrong path                       | `src/completions.ts` (`getCompletionFilePath`)  | env vars (`XDG_*`, `ZDOTDIR`)     |
| Completion not refreshed after upgrade                      | `src/upgrade.ts` (`refreshCompletions`)         | —                                 |
| `--version` shows wrong info                                | `build.ts` (SHA injection)                      | —                                 |
| CLI option ignored or parsed wrong                          | `github-code-search.ts`                         | `src/types.ts` (`OutputType`)     |

---

## Reproducing a bug

A complete bug report must have:

1. **Exact command** (redact `GITHUB_TOKEN` with `***`):
   ```
   GITHUB_TOKEN=*** github-code-search query "pattern" --org acme
   ```
2. **Observed output** vs **expected output**.
3. **Version string**: `github-code-search --version` → e.g. `1.8.0 (a1b2c3d · darwin/arm64)`.
4. **Bun version** (when running from source): `bun --version`.

If the report is missing items 1 or 3, read the relevant module(s) to hypothesise the root cause before asking for more info.

---

## Test-first patterns for bugs

### Pure function bug (aggregate, group, output, render/\*)

```typescript
// src/aggregate.test.ts
describe("applyFiltersAndExclusions — bug #N", () => {
  it("excludes org-prefixed repo names correctly", () => {
    const result = applyFiltersAndExclusions(matches, {
      excludeRepositories: ["acme/my-repo"], // the previously broken form
    });
    expect(result).not.toContainEqual(expect.objectContaining({ repo: "acme/my-repo" }));
  });
});
```

The test must **fail** with the current code before the fix. Commit the test, then fix.

### api-utils bug (retry / pagination)

```typescript
// src/api-utils.test.ts
it("retries on 429 with Retry-After header", async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "0" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await fetchWithRetry("https://api.github.com/test");
  expect(callCount).toBe(2);
});
```

### Side-effectful bug (tui, api) — no unit test possible

Document manual repro steps in the PR description:

```markdown
## Steps to reproduce (before fix)

1. `GITHUB_TOKEN=... github-code-search query "foo" --org acme`
2. Press `↓` past the last result
3. Expected: cursor stays on last row / Expected: wraps to first row
4. Observed: cursor jumps to blank row
```

---

## Minimal fix principles

- **Touch only the root cause.** Do not opportunistically refactor neighbouring code in the same PR — it makes the fix harder to review and risks introducing new bugs.
- **Respect pure/IO layering**: a fix in `aggregate.ts` must not add a `console.log` call.
- **Type changes cascade**: if `src/types.ts` must change, run `bun run knip` to find all affected consumers and update them all in the same PR.
- **Regression comment**: if the root cause is non-obvious, add one line above the fix:
  ```typescript
  // Fix: short names ("repo") and qualified names ("org/repo") must both match — see issue #N
  ```

---

## Validation after fix

```bash
bun test               # the previously failing test now passes; full suite still green
bun run lint           # oxlint — zero errors
bun run format:check   # oxfmt — no formatting diff
bun run knip           # no unused exports or imports
bun run build.ts       # binary compiles without errors
```
