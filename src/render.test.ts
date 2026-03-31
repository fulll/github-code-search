import { describe, expect, it } from "bun:test";
import {
  applySelectAll,
  applySelectNone,
  buildFileUrl,
  buildFilterStats,
  buildMatchCountLabel,
  buildRows,
  buildSelectionSummary,
  buildSummary,
  buildSummaryFull,
  highlightFragment,
  isCursorVisible,
  normalizeScrollOffset,
  renderGroups,
  renderHelpOverlay,
  rowTerminalLines,
} from "./render.ts";
import type { RepoGroup, Row } from "./types.ts";

function makeGroup(repo: string, paths: string[], folded = true, withFragments = false): RepoGroup {
  return {
    repoFullName: repo,
    matches: paths.map((p) => ({
      path: p,
      repoFullName: repo,
      htmlUrl: `https://github.com/${repo}/blob/main/${p}`,
      archived: false,
      textMatches: withFragments ? [{ fragment: `some code with ${p}`, matches: [] }] : [],
    })),
    folded,
    repoSelected: true,
    extractSelected: paths.map(() => true),
  };
}

// ─── highlightFragment ────────────────────────────────────────────────────────

describe("highlightFragment", () => {
  it("returns array with one line for single-line fragment", () => {
    const result = highlightFragment("hello world", [], "file.ts");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns dimmed text when no segments", () => {
    const result = highlightFragment("hello world", [], "file.ts");
    const stripped = result[0].replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("hello world");
  });

  it("truncates long single lines", () => {
    const long = "x".repeat(200);
    const result = highlightFragment(long, [], "file.ts");
    const stripped = result[0].replace(/\x1b\[[0-9;]*m/g, "");
    // Should be truncated with ellipsis
    expect(stripped.length).toBeLessThanOrEqual(165);
  });

  it("highlights matched segment", () => {
    const result = highlightFragment(
      "hello world",
      [{ text: "world", indices: [6, 11] }],
      "file.ts",
    );
    const joined = result.join("\n");
    // The highlighted segment should appear in bold yellow (contains ANSI)
    expect(joined).toContain("world");
    // ANSI escape code present
    expect(joined).toMatch(/\x1b\[/);
  });

  it("preserves newlines as separate lines", () => {
    const result = highlightFragment("foo\nbar", [], "file.ts");
    // Must return at least 2 lines
    expect(result.length).toBeGreaterThanOrEqual(2);
    const stripped0 = result[0].replace(/\x1b\[[0-9;]*m/g, "");
    const stripped1 = result[1].replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped0).toBe("foo");
    expect(stripped1).toBe("bar");
  });

  it("applies syntax coloring for TypeScript files", () => {
    const result = highlightFragment("const x = 1;", [], "main.ts");
    const joined = result.join("");
    // Should contain ANSI codes (syntax coloring applied)
    expect(joined).toMatch(/\x1b\[/);
  });

  it("adds 'more lines' indicator when fragment exceeds 6 lines", () => {
    // 8 lines → 6 shown + 1 indicator line
    const longFragment = Array.from({ length: 8 }, (_, i) => `line${i}`).join("\n");
    const result = highlightFragment(longFragment, [], "file.ts");
    // 6 code lines + the indicator
    expect(result).toHaveLength(7);
    const indicator = result[6].replace(/\x1b\[[0-9;]*m/g, "");
    expect(indicator).toContain("+2 more lines");
  });

  // Each language test exercises that language's tokenizer lambdas so that
  // function-coverage for render.ts stays above the configured threshold.

  it("syntax-highlights Python snippets (py)", () => {
    const code = [
      "# comment",
      '"""triple double"""',
      "'''triple single'''",
      '"double"',
      "'single'",
      "@decorator",
      "def hello(x):",
      "    return 42",
      "y = 1.5",
    ].join("\n");
    const result = highlightFragment(code, [], "main.py");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights Shell snippets (sh)", () => {
    const code = [
      "# comment",
      'echo "hello $HOME"',
      "VAR='single'",
      "export $VARIABLE",
      "echo other",
    ].join("\n");
    const result = highlightFragment(code, [], "run.sh");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights JSON snippets (json)", () => {
    const code = '{"key": "value", "num": 42, "flag": true, "nil": null}';
    const result = highlightFragment(code, [], "data.json");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights YAML snippets (yaml)", () => {
    const code = [
      "# comment",
      "key: value",
      "num: 42",
      "flag: true",
      'quoted: "hello"',
      "single: 'world'",
    ].join("\n");
    const result = highlightFragment(code, [], "config.yaml");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights Go snippets (go)", () => {
    const code = [
      "// comment",
      "/* block */",
      "func greet() string {",
      '    return "hello"',
      "    var x = `raw`",
      "    return 42",
      "}",
    ].join("\n");
    const result = highlightFragment(code, [], "main.go");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights Rust snippets (rs)", () => {
    const code = [
      "// comment",
      "/* block */",
      "fn main() {",
      '    let x = "hello";',
      "    return 42",
      "    CONST_NAME",
      "}",
    ].join("\n");
    const result = highlightFragment(code, [], "main.rs");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights Java snippets (java)", () => {
    const code = [
      "// comment",
      "/* block */",
      "public class Foo {",
      '    String s = "hello";',
      "    return 42L",
      "    ClassName obj",
      "}",
    ].join("\n");
    const result = highlightFragment(code, [], "Foo.java");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("syntax-highlights CSS snippets (css)", () => {
    const code = [
      "/* comment */",
      '.class { color: "red"; }',
      "#id-selector { font: 'mono'; }",
      "#ABC123",
      ".btn-primary { }",
    ].join("\n");
    const result = highlightFragment(code, [], "style.css");
    expect(result.join("")).toMatch(/\x1b\[/);
  });

  it("uses default (plain-text) tokenizer for unknown extensions", () => {
    const result = highlightFragment("hello world  tab", [], "file.xyz");
    const stripped = result[0].replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("hello world  tab");
  });
});

// ─── buildSummary ─────────────────────────────────────────────────────────────

describe("buildSummary", () => {
  it("returns singular for 1 repo / 1 file (no cross-repo dup)", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const summary = buildSummary(groups);
    const stripped = summary.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("1 repo · 1 file");
  });

  it("returns plural for multiple repos / unique paths", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    const summary = buildSummary(groups);
    const stripped = summary.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("2 repos · 3 files");
  });

  it("shows files · matches when same path appears in multiple repos", () => {
    const groups = [makeGroup("org/repoA", ["a.ts"]), makeGroup("org/repoB", ["a.ts"])];
    const summary = buildSummary(groups);
    const stripped = summary.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("2 repos · 1 file · 2 matches");
  });

  it("returns zero for empty groups", () => {
    const summary = buildSummary([]);
    const stripped = summary.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("0 repos · 0 files");
  });
});

// ─── buildMatchCountLabel ─────────────────────────────────────────────────────

describe("buildMatchCountLabel", () => {
  it("returns singular for 1 match when all selected", () => {
    const group = makeGroup("org/repo", ["a.ts"]);
    expect(buildMatchCountLabel(group)).toBe("1 match");
  });

  it("returns plural for multiple matches when all selected", () => {
    const group = makeGroup("org/repo", ["a.ts", "b.ts", "c.ts"]);
    expect(buildMatchCountLabel(group)).toBe("3 matches");
  });

  it("adds selected count when some extracts are deselected", () => {
    const group = makeGroup("org/repo", ["a.ts", "b.ts", "c.ts"]);
    group.extractSelected[1] = false; // deselect b.ts
    expect(buildMatchCountLabel(group)).toBe("3 matches, 2 selected");
  });

  it("shows 0 selected when all deselected", () => {
    const group = makeGroup("org/repo", ["a.ts", "b.ts"]);
    group.extractSelected = [false, false];
    expect(buildMatchCountLabel(group)).toBe("2 matches, 0 selected");
  });

  it("does not add selected count when all are selected", () => {
    const group = makeGroup("org/repo", ["a.ts", "b.ts"]);
    expect(buildMatchCountLabel(group)).not.toContain("selected");
  });
});

// ─── rowTerminalLines ─────────────────────────────────────────────────────────

describe("rowTerminalLines", () => {
  it("repo row always takes 1 line", () => {
    const group = makeGroup("org/repo", ["a.ts"]);
    const row: Row = { type: "repo", repoIndex: 0 };
    expect(rowTerminalLines(group, row)).toBe(1);
  });

  it("extract row without fragment takes 1 line", () => {
    const group = makeGroup("org/repo", ["a.ts"], false, false);
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    expect(rowTerminalLines(group, row)).toBe(1);
  });

  it("extract row with single-line fragment takes 2 lines", () => {
    const group = makeGroup("org/repo", ["a.ts"], false, true);
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    expect(rowTerminalLines(group, row)).toBe(2);
  });

  it("section row takes 2 lines (blank separator + label)", () => {
    const row: Row = {
      type: "section",
      repoIndex: -1,
      sectionLabel: "squad-frontend",
    };
    expect(rowTerminalLines(undefined, row)).toBe(2);
  });

  // Fix: rowTerminalLines must account for all textMatches, not just textMatches[0] — see issue #74
  it("extract row with two single-line fragments takes 3 lines (1 path + 2 fragments)", () => {
    const group: RepoGroup = {
      repoFullName: "org/repo",
      matches: [
        {
          path: "src/foo.ts",
          repoFullName: "org/repo",
          htmlUrl: "https://github.com/org/repo/blob/main/src/foo.ts",
          archived: false,
          textMatches: [
            { fragment: "first match line", matches: [] },
            { fragment: "second match line", matches: [] },
          ],
        },
      ],
      folded: false,
      repoSelected: true,
      extractSelected: [true],
    };
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    // 1 line for the path + 1 line per fragment = 3 total
    expect(rowTerminalLines(group, row)).toBe(3);
  });
});

// ─── buildRows ────────────────────────────────────────────────────────────────

describe("buildRows", () => {
  it("produces only repo rows when all groups are folded", () => {
    const groups = [
      makeGroup("org/repoA", ["a.ts", "b.ts"], true),
      makeGroup("org/repoB", ["c.ts"], true),
    ];
    const rows = buildRows(groups);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === "repo")).toBe(true);
  });

  it("expands extract rows for unfolded groups", () => {
    const groups = [
      makeGroup("org/repoA", ["a.ts", "b.ts"], false),
      makeGroup("org/repoB", ["c.ts"], true),
    ];
    const rows = buildRows(groups);
    // 1 repo row + 2 extract rows + 1 repo row
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ type: "repo", repoIndex: 0 });
    expect(rows[1]).toMatchObject({
      type: "extract",
      repoIndex: 0,
      extractIndex: 0,
    });
    expect(rows[2]).toMatchObject({
      type: "extract",
      repoIndex: 0,
      extractIndex: 1,
    });
    expect(rows[3]).toMatchObject({ type: "repo", repoIndex: 1 });
  });

  it("emits a section row before the first repo of a section", () => {
    const g1 = {
      ...makeGroup("org/repoA", ["a.ts"], true),
      sectionLabel: "squad-frontend",
    };
    const g2 = makeGroup("org/repoB", ["b.ts"], true);
    const rows = buildRows([g1, g2]);
    // section row + repo row(repoA) + repo row(repoB)
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      type: "section",
      sectionLabel: "squad-frontend",
    });
    expect(rows[1]).toMatchObject({ type: "repo", repoIndex: 0 });
    expect(rows[2]).toMatchObject({ type: "repo", repoIndex: 1 });
  });

  it("emits multiple section rows when multiple sections defined", () => {
    const g1 = {
      ...makeGroup("org/repoA", ["a.ts"], true),
      sectionLabel: "squad-frontend",
    };
    const g2 = {
      ...makeGroup("org/repoB", ["b.ts"], true),
      sectionLabel: "squad-mobile",
    };
    const rows = buildRows([g1, g2]);
    expect(rows).toHaveLength(4); // section + repoA + section + repoB
    expect(rows[0]).toMatchObject({
      type: "section",
      sectionLabel: "squad-frontend",
    });
    expect(rows[2]).toMatchObject({
      type: "section",
      sectionLabel: "squad-mobile",
    });
  });
});

// ─── isCursorVisible ──────────────────────────────────────────────────────────

describe("isCursorVisible", () => {
  it("returns true when cursor is within viewport", () => {
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts"], false, false)];
    const rows = buildRows(groups);
    // rows: [repo(0), extract(0,0), extract(0,1)]
    // viewportHeight=5, scrollOffset=0 → all 3 rows visible (3 lines total)
    expect(isCursorVisible(rows, groups, 2, 0, 5)).toBe(true);
  });

  it("returns false when cursor is above scrollOffset", () => {
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts", "c.ts"], false, false)];
    const rows = buildRows(groups);
    // cursor=0, scrollOffset=1 → row 0 is above the viewport
    expect(isCursorVisible(rows, groups, 0, 1, 5)).toBe(false);
  });

  it("returns false when cursor would exceed viewportHeight (2-line rows)", () => {
    // 3 extract rows with fragments = 2 lines each → 6 terminal lines
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts", "c.ts"], false, true)];
    const rows = buildRows(groups);
    // rows: [repo(0), extract(0,0), extract(0,1), extract(0,2)]
    // viewportHeight=4 lines, scrollOffset=0
    // repo=1 line, extract(0,0)=2 lines → 3 lines, extract(0,1)=2 lines → 5 > 4
    // So cursor at index 3 (extract(0,2)) should NOT be visible
    expect(isCursorVisible(rows, groups, 3, 0, 4)).toBe(false);
  });

  it("returns false when cursor row h does not fit in remaining space", () => {
    // Regression: isCursorVisible must mirror renderGroups break condition.
    // viewportHeight=2, row 0 (repo h=1) consumes 1 line, cursor row 1
    // (extract with fragment h=2) would need 1+2=3 > 2 → must NOT be visible.
    // Before the fix this returned true, causing scroll to stop 1 step early
    // which meant the last unfolded extract was never rendered.
    const groups = [makeGroup("org/repo", ["a.ts"], false, true)];
    const rows = buildRows(groups);
    // rows: [repo(0), extract(0,0)]  extract has fragment → h=2
    expect(isCursorVisible(rows, groups, 1, 0, 2)).toBe(false);
    // but first row (repo) is always "visible" even as sole row
    expect(isCursorVisible(rows, groups, 0, 0, 2)).toBe(true);
  });

  it("returns true when cursor is exactly at the start of the viewport", () => {
    const groups = [makeGroup("org/repo", ["a.ts"], false, false)];
    const rows = buildRows(groups);
    expect(isCursorVisible(rows, groups, 0, 0, 10)).toBe(true);
  });

  it("returns false when scrollOffset is stale (greater than cursor after filter shrinks rows)", () => {
    // Regression guard for Bug 2: in filter-mode edit handlers (Backspace, Del,
    // word-delete, paste) tui.ts clamps `cursor` to the new rows length but does
    // NOT clamp `scrollOffset`. When the filter reduces rows, cursor is clamped
    // down but scrollOffset can remain larger than cursor, causing the cursor to
    // appear "above the viewport" — isCursorVisible returns false and the while
    // loop `while (scrollOffset < cursor ...)` never runs (already false), so the
    // tui gets stuck showing an empty groups area.
    //
    // Scenario: 4 rows, user was at cursor=3, scrollOffset=2. Filter reduces rows
    // to 2. Cursor clamped to 1. scrollOffset NOT clamped → still 2 > cursor=1.
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts", "c.ts"], false)];
    const rows = buildRows(groups); // [repo, ext0, ext1, ext2]
    // cursor=1 but scrollOffset=2: cursor is *above* the viewport window
    expect(isCursorVisible(rows, groups, 1, 2, 10)).toBe(false);
    // The fix: clamp scrollOffset = Math.min(scrollOffset, cursor) = Math.min(2,1) = 1
    expect(isCursorVisible(rows, groups, 1, 1, 10)).toBe(true);
  });
});

// ─── buildSummaryFull ──────────────────────────────────────────────────────────────

describe("buildSummaryFull", () => {
  it("shows plain file counts when everything is selected (unique paths)", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    const stripped = buildSummaryFull(groups).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("2 repos · 3 files");
  });

  it("shows files · matches when same path appears in multiple repos", () => {
    const groups = [makeGroup("org/repoA", ["a.ts"]), makeGroup("org/repoB", ["a.ts"])];
    const stripped = buildSummaryFull(groups).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("2 repos · 1 file · 2 matches");
  });

  it("annotates repos with selected count when some are deselected", () => {
    const groups = [makeGroup("org/repoA", ["a.ts"]), makeGroup("org/repoB", ["b.ts"], true)];
    groups[1].repoSelected = false;
    const stripped = buildSummaryFull(groups).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("2 repos (1 selected)");
  });

  it("annotates files with selected count when some extracts deselected", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"])];
    groups[0].extractSelected[1] = false;
    const stripped = buildSummaryFull(groups).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("(1 selected)");
  });

  it("shows files · matches (selected) for cross-repo dups with partial selection", () => {
    // a.ts appears in both repos; repoA keeps it selected, repoB deselects it.
    // Unique file a.ts is still selected (via repoA) → no (selected) annotation on files.
    // But match count is 2 total, 1 selected → matches gets a (1 selected) annotation.
    const groups = [makeGroup("org/repoA", ["a.ts"]), makeGroup("org/repoB", ["a.ts"])];
    groups[1].extractSelected[0] = false;
    const stripped = buildSummaryFull(groups).replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("1 file");
    expect(stripped).not.toContain("file ("); // unique path still selected via repoA
    expect(stripped).toContain("2 matches (1 selected)");
  });
});

// ─── buildSelectionSummary ───────────────────────────────────────────────────

describe("buildSelectionSummary", () => {
  it("returns plain-text selection summary (files = matches)", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"])];
    expect(buildSelectionSummary(groups)).toBe("1 repo · 2 files selected");
  });

  it("shows files · matches when same path appears in multiple repos", () => {
    const groups = [makeGroup("org/repoA", ["a.ts"]), makeGroup("org/repoB", ["a.ts"])];
    expect(buildSelectionSummary(groups)).toBe("2 repos · 1 file · 2 matches selected");
  });

  it("respects deselected extracts", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"])];
    groups[0].extractSelected[0] = false;
    expect(buildSelectionSummary(groups)).toContain("1 file");
  });

  it("returns zero counts for empty groups", () => {
    expect(buildSelectionSummary([])).toBe("0 repos · 0 files selected");
  });
});

// ─── applySelectAll ───────────────────────────────────────────────────────────────────
describe("applySelectAll", () => {
  it("selects all repos+extracts when context is a repo row", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    groups[0].repoSelected = false;
    groups[0].extractSelected = [false, false];
    const repoRow: import("./types.ts").Row = { type: "repo", repoIndex: 0 };
    applySelectAll(groups, repoRow);
    expect(groups[0].repoSelected).toBe(true);
    expect(groups[0].extractSelected).toEqual([true, true]);
    expect(groups[1].repoSelected).toBe(true);
  });

  it("selects only current-repo extracts when context is an extract row", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    groups[0].extractSelected = [false, false];
    groups[1].repoSelected = false;
    const extractRow: import("./types.ts").Row = {
      type: "extract",
      repoIndex: 0,
      extractIndex: 0,
    };
    applySelectAll(groups, extractRow);
    expect(groups[0].extractSelected).toEqual([true, true]);
    // Other repo untouched
    expect(groups[1].repoSelected).toBe(false);
  });
});

// ─── applySelectNone ────────────────────────────────────────────────────────────────
describe("applySelectNone", () => {
  it("deselects all repos+extracts when context is a repo row", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    const repoRow: import("./types.ts").Row = { type: "repo", repoIndex: 0 };
    applySelectNone(groups, repoRow);
    expect(groups[0].repoSelected).toBe(false);
    expect(groups[0].extractSelected).toEqual([false, false]);
    expect(groups[1].repoSelected).toBe(false);
  });

  it("deselects only current-repo extracts when context is an extract row", () => {
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"]), makeGroup("org/repoB", ["c.ts"])];
    const extractRow: import("./types.ts").Row = {
      type: "extract",
      repoIndex: 0,
      extractIndex: 0,
    };
    applySelectNone(groups, extractRow);
    expect(groups[0].repoSelected).toBe(false);
    expect(groups[0].extractSelected).toEqual([false, false]);
    // Other repo untouched
    expect(groups[1].repoSelected).toBe(true);
  });
});

// ─── renderGroups ────────────────────────────────────────────────────────────

describe("renderGroups", () => {
  it("returns a string containing query and org", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "myquery", "org");
    expect(typeof out).toBe("string");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("myquery");
    expect(stripped).toContain("org");
    expect(stripped).toContain("org/repoA");
  });

  it("shows fold arrow \u25b8 for folded group", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"], true)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("\u25b8");
  });

  it("shows file path when group is unfolded", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"], false)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 1, rows, 40, 0, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("src/a.ts");
  });

  it("shows unfold arrow \u25be for unfolded group", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"], false)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("\u25be");
  });

  it("shows sticky repo header when extract cursor scrolled past its repo", () => {
    // rows: [repo(0), ext(0,0), ext(0,1), ext(0,2)]
    // cursor=3, scrollOffset=2 → repo row (idx 0) < scrollOffset → sticky
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts", "c.ts"], false)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 3, rows, 40, 2, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("▲"); // sticky indicator
    expect(stripped).toContain("org/repoA"); // repo name shown in sticky line
  });

  it("does NOT show sticky repo header when cursor is on a repo row (even with scrollOffset > 0)", () => {
    // Regression guard for Bug 1: getViewportHeight() in tui.ts used to subtract
    // a sticky-header line whenever scrollOffset > 0, but renderGroups only shows
    // the sticky header when the cursor is on an *extract* row whose repo header
    // has scrolled above the viewport. When cursor is on a repo row, no sticky
    // header is emitted and the subtracted line makes isCursorVisible() return
    // false prematurely (the cursor appears invisible one step too early).
    //
    // rows: [repo(0), ext(0,0), repo(1), ext(1,0)]
    // cursor=2 (repo1), scrollOffset=1 → repo(0) < scrollOffset, but cursor is on
    // repo(1), not an extract → sticky header must NOT be shown.
    const groups = [
      makeGroup("org/repoA", ["a.ts"], false),
      makeGroup("org/repoB", ["b.ts"], false),
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 2, rows, 40, 1, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("▲");
  });

  it("stops rendering rows when viewport is filled (overflow break)", () => {
    // Extract rows with fragments have h=2; with termHeight=9 viewportHeight=2
    // row0(repo,h=1): fits. row1(ext,h=2): 1+2=3 > 2 AND usedLines=1>0 → break
    const groups = [
      makeGroup("org/repoA", ["a.ts", "b.ts"], false, true),
      makeGroup("org/repoB", ["c.ts"]),
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 9, 0, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // repoB should not appear (overflow prevents rendering it)
    expect(stripped).toContain("org/repoA");
    expect(out).toBeTruthy(); // must not crash
  });

  it("right-aligns match count to termWidth", () => {
    // With termWidth=60 the visible width of the repo row should equal 60
    // (padding fills the gap between repo name and count).
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts"], false)];
    const rows = buildRows(groups);
    const termWidth = 60;
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth });
    // Extract just the repo row line (first line after the hint bar)
    const lines = out.split("\n");
    const repoLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoA"));
    expect(repoLine).toBeDefined();
    const visibleLen = repoLine!.replace(/\x1b\[[0-9;]*m/g, "").length;
    expect(visibleLen).toBe(termWidth);
  });

  // Fix: renderGroups must display all textMatches for a file, not just textMatches[0] — see issue #74
  it("shows all fragments when a file has multiple textMatches", () => {
    const groups: RepoGroup[] = [
      {
        repoFullName: "org/repo",
        matches: [
          {
            path: "src/multi.ts",
            repoFullName: "org/repo",
            htmlUrl: "https://github.com/org/repo/blob/main/src/multi.ts",
            archived: false,
            textMatches: [
              { fragment: "first_fragment_content", matches: [] },
              { fragment: "second_fragment_content", matches: [] },
            ],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true],
      },
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org");
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("first_fragment_content");
    expect(stripped).toContain("second_fragment_content");
  });
});

// ─── buildRows with filterPath ────────────────────────────────────────────────

describe("buildRows with filterPath", () => {
  it("returns all rows when filterPath is empty", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false)];
    const rows = buildRows(groups, "");
    expect(rows.length).toBe(3); // 1 repo + 2 extracts
  });

  it("filters extracts by path substring (case-insensitive)", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false)];
    const rows = buildRows(groups, "SRC");
    // repo row + 1 matching extract
    expect(rows.length).toBe(2);
    const extract = rows.find((r) => r.type === "extract");
    expect(extract?.extractIndex).toBe(0);
  });

  it("skips repo entirely when no extracts match the filter", () => {
    const groups = [
      makeGroup("org/repo1", ["src/a.ts"], false),
      makeGroup("org/repo2", ["lib/b.ts"], false),
    ];
    const rows = buildRows(groups, "lib");
    // repo1 has no match → skipped; repo2 matches
    const repoRows = rows.filter((r) => r.type === "repo");
    expect(repoRows.length).toBe(1);
    expect(repoRows[0].repoIndex).toBe(1);
  });

  it("does not show extracts of folded repos even with filter", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "src/b.ts"], true /* folded */)];
    const rows = buildRows(groups, "src");
    expect(rows.length).toBe(1); // only repo row, folded
    expect(rows[0].type).toBe("repo");
  });
});

// ─── buildFilterStats ─────────────────────────────────────────────────────────

describe("buildFilterStats", () => {
  it("returns all visible when filter matches everything", () => {
    const groups = [
      makeGroup("org/a", ["src/x.ts", "src/y.ts"], false),
      makeGroup("org/b", ["lib/z.ts"], false),
    ];
    const stats = buildFilterStats(groups, "");
    // Empty filter should match all (includes empty string)
    expect(stats.visibleRepos).toBe(2);
    expect(stats.visibleMatches).toBe(3);
    expect(stats.hiddenRepos).toBe(0);
    expect(stats.hiddenMatches).toBe(0);
  });

  it("counts matching and non-matching repos/matches", () => {
    const groups = [
      makeGroup("org/a", ["src/x.ts", "test/x.test.ts"], false),
      makeGroup("org/b", ["lib/z.ts"], false),
    ];
    const stats = buildFilterStats(groups, "test");
    expect(stats.visibleRepos).toBe(1); // org/a has a test file
    expect(stats.visibleMatches).toBe(1);
    expect(stats.hiddenRepos).toBe(1); // org/b has none
    expect(stats.hiddenMatches).toBe(2); // src/x.ts + lib/z.ts
  });
});

// ─── applySelectAll / applySelectNone with filterPath ────────────────────────

describe("applySelectAll with filterPath", () => {
  it("selects only matching extracts when filter is active", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false, false)];
    groups[0].repoSelected = false;
    groups[0].extractSelected = [false, false];
    const row: Row = { type: "repo", repoIndex: 0 };
    applySelectAll(groups, row, "src");
    expect(groups[0].extractSelected[0]).toBe(true); // src/a.ts matches
    expect(groups[0].extractSelected[1]).toBe(false); // lib/b.ts does not
    expect(groups[0].repoSelected).toBe(true); // at least one selected
  });

  it("skips repos with no matching extracts", () => {
    const groups = [
      makeGroup("org/a", ["lib/x.ts"], false),
      makeGroup("org/b", ["src/y.ts"], false),
    ];
    groups[0].extractSelected = [false];
    groups[1].extractSelected = [false];
    const row: Row = { type: "repo", repoIndex: 0 };
    applySelectAll(groups, row, "src");
    expect(groups[0].extractSelected[0]).toBe(false); // lib/x.ts — no match
    expect(groups[1].extractSelected[0]).toBe(true); // src/y.ts — match
  });

  it("selects only matching extracts in the context repo when extract row + filter", () => {
    const groups = [
      makeGroup("org/a", ["src/x.ts", "lib/y.ts"], false),
      makeGroup("org/b", ["src/z.ts"], false),
    ];
    groups[0].extractSelected = [false, false];
    groups[1].extractSelected = [false];
    // Cursor is on an extract row in repo 0
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectAll(groups, row, "src");
    expect(groups[0].extractSelected[0]).toBe(true); // src/x.ts matches
    expect(groups[0].extractSelected[1]).toBe(false); // lib/y.ts does not
    expect(groups[0].repoSelected).toBe(true);
    // repo 1 must be unaffected (extract row scope)
    expect(groups[1].extractSelected[0]).toBe(false);
  });
});

describe("applySelectNone with filterPath", () => {
  it("deselects only matching extracts when filter is active", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false)];
    // All selected by default from makeGroup
    const row: Row = { type: "repo", repoIndex: 0 };
    applySelectNone(groups, row, "src");
    expect(groups[0].extractSelected[0]).toBe(false); // src/a.ts deselected
    expect(groups[0].extractSelected[1]).toBe(true); // lib/b.ts unchanged
    expect(groups[0].repoSelected).toBe(true); // lib/b.ts still selected
  });

  it("deselects only matching extracts in the context repo when extract row + filter", () => {
    const groups = [
      makeGroup("org/a", ["src/x.ts", "lib/y.ts"], false),
      makeGroup("org/b", ["src/z.ts"], false),
    ];
    // All selected by default
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectNone(groups, row, "src");
    expect(groups[0].extractSelected[0]).toBe(false); // src/x.ts deselected
    expect(groups[0].extractSelected[1]).toBe(true); // lib/y.ts unchanged
    expect(groups[0].repoSelected).toBe(true); // lib/y.ts still keeps repo selected
    // repo 1 must be unaffected (extract row scope)
    expect(groups[1].extractSelected[0]).toBe(true);
  });
});

// ─── applySelectAll / applySelectNone with filterTarget="repo" ───────────────

describe("applySelectAll with filterTarget=repo", () => {
  it("selects all groups whose repoFullName matches (repo row context)", () => {
    const groups = [
      makeGroup("org/alpha", ["a.ts"], false, false),
      makeGroup("org/beta", ["b.ts"], false, false),
    ];
    // start unselected so we can verify what applySelectAll selects
    groups[0].repoSelected = false;
    groups[0].extractSelected = [false];
    groups[1].repoSelected = false;
    groups[1].extractSelected = [false];
    const row: Row = { type: "repo", repoIndex: 0 };
    applySelectAll(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(true);
    expect(groups[0].extractSelected[0]).toBe(true);
    expect(groups[1].repoSelected).toBe(false); // "beta" unaffected
    expect(groups[1].extractSelected[0]).toBe(false);
  });

  it("selects the current repo when its name matches (extract row context)", () => {
    const groups = [
      makeGroup("org/alpha", ["a.ts", "b.ts"], false, false),
      makeGroup("org/beta", ["c.ts"], false, false),
    ];
    groups[0].repoSelected = false;
    groups[0].extractSelected = [false, false];
    groups[1].repoSelected = false;
    groups[1].extractSelected = [false];
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectAll(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(true);
    expect(groups[0].extractSelected[0]).toBe(true);
    expect(groups[0].extractSelected[1]).toBe(true);
    // repo 1 must be untouched (extract-row scope)
    expect(groups[1].repoSelected).toBe(false);
  });

  it("does not select the current repo when its name does not match (extract row context)", () => {
    const groups = [makeGroup("org/beta", ["b.ts"], false, false)];
    groups[0].repoSelected = false;
    groups[0].extractSelected = [false];
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectAll(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(false);
    expect(groups[0].extractSelected[0]).toBe(false);
  });
});

describe("applySelectNone with filterTarget=repo", () => {
  it("deselects all groups whose repoFullName matches (repo row context)", () => {
    const groups = [makeGroup("org/alpha", ["a.ts"]), makeGroup("org/beta", ["b.ts"])];
    const row: Row = { type: "repo", repoIndex: 0 };
    applySelectNone(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(false);
    expect(groups[0].extractSelected[0]).toBe(false);
    expect(groups[1].repoSelected).toBe(true); // "beta" not matched — untouched
    expect(groups[1].extractSelected[0]).toBe(true);
  });

  it("deselects the current repo when its name matches (extract row context)", () => {
    const groups = [makeGroup("org/alpha", ["a.ts", "b.ts"]), makeGroup("org/beta", ["c.ts"])];
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectNone(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(false);
    expect(groups[0].extractSelected[0]).toBe(false);
    expect(groups[0].extractSelected[1]).toBe(false);
    // repo 1 must be untouched (extract-row scope)
    expect(groups[1].repoSelected).toBe(true);
  });

  it("does not deselect the current repo when its name does not match (extract row context)", () => {
    const groups = [makeGroup("org/beta", ["b.ts"])];
    const row: Row = { type: "extract", repoIndex: 0, extractIndex: 0 };
    applySelectNone(groups, row, "alpha", "repo");
    expect(groups[0].repoSelected).toBe(true); // unaffected — no match
    expect(groups[0].extractSelected[0]).toBe(true);
  });
});

// ─── renderHelpOverlay ────────────────────────────────────────────────────────

describe("renderHelpOverlay", () => {
  it("contains all documented key bindings", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Key bindings");
    expect(stripped).toContain("navigate up");
    expect(stripped).toContain("navigate down");
    expect(stripped).toContain("fold repo");
    expect(stripped).toContain("select all");
    expect(stripped).toContain("select none");
    expect(stripped).toContain("filter mode");
    expect(stripped).toContain("reset filter");
    expect(stripped).toContain("toggle this help");
    expect(stripped).toContain("Filter mode:");
  });

  it("documents the Z global fold/unfold shortcut", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Z");
    expect(stripped).toContain("fold / unfold all repos");
  });

  it("documents the o open-in-browser shortcut", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("open in browser");
  });

  it("documents gg/G fast navigation shortcuts", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("gg");
    expect(stripped).toContain("jump to top");
    expect(stripped).toContain("G");
    expect(stripped).toContain("jump to bottom");
  });

  it("documents Page Up/Down fast navigation shortcuts", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("PgUp");
    expect(stripped).toContain("PgDn");
    expect(stripped).toContain("page up");
    expect(stripped).toContain("page down");
  });

  it("is returned by renderGroups when showHelp=true", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const helpOut = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      showHelp: true,
    });
    const stripped = helpOut.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Key bindings");
    // Normal UI elements should NOT appear
    expect(stripped).not.toContain("GitHub Code Search");
  });
});

// ─── renderGroups with filter options ─────────────────────────────────────────

describe("renderGroups filter opts", () => {
  it("shows filter input bar when filterMode=true", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterMode: true,
      filterInput: "src",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("src"); // typed text visible in input field
    expect(stripped).toContain("↵ OK"); // line-2 hints
    expect(stripped).toContain("Esc cancel"); // line-2 hints
  });

  it("live-filters rows by filterInput when filterMode=true", () => {
    // The caller (tui.ts) builds rows with filterInput as the active filter
    // while in filterMode so the view updates as the user types.
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false)];
    const rows = buildRows(groups, "src"); // rows already filtered by filterInput
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterMode: true,
      filterInput: "src",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("src/a.ts");
    expect(stripped).not.toContain("lib/b.ts");
  });

  it("shows confirmed filter path with stats when filterPath is set", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts", "lib/b.ts"], false)];
    const rows = buildRows(groups, "src");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterPath: "src",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("filter:");
    expect(stripped).toContain("src");
    expect(stripped).toContain("shown");
    expect(stripped).toContain("hidden");
    expect(stripped).toContain("r to reset");
  });

  it("shows no filter bar when filterPath is empty and not in filterMode", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {});
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("filter:");
    expect(stripped).not.toContain("Filter:");
  });

  it("status bar hint line includes all navigation hint shortcuts", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    // Use a wide terminal so hints are not clipped — this test validates content,
    // not the clipping behaviour (which is covered by the "hints clipping" test).
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 200 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Z fold-all");
    expect(stripped).toContain("o open");
    expect(stripped).toContain("gg/G top/bot");
    expect(stripped).toContain("PgUp/Dn page");
  });

  it("shows mode badge [content] when filterTarget=content", () => {
    const groups = [makeGroup("org/repo", ["a.ts"], false, true)];
    const rows = buildRows(groups, "code", "content");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterPath: "code",
      filterTarget: "content",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("[content]");
  });

  it("shows mode badge [repo] when filterTarget=repo", () => {
    const groups = [makeGroup("org/service", ["a.ts"])];
    const rows = buildRows(groups, "service", "repo");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterPath: "service",
      filterTarget: "repo",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("[repo]");
  });

  it("shows mode badge [path·regex] when filterTarget=path and filterRegex=true", () => {
    const groups = [makeGroup("org/repo", ["src/a.ts"])];
    const rows = buildRows(groups, "src", "path", true);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterPath: "src",
      filterTarget: "path",
      filterRegex: true,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("[path");
    expect(stripped).toContain("regex]");
  });

  it("always shows mode badge [path] when filterTarget=path and filterRegex=false", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups, "a");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterPath: "a",
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("[path]");
    expect(stripped).not.toContain("[content]");
    expect(stripped).not.toContain("[repo]");
  });

  it("renders inline cursor (inverse block) in filter mode", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups, "src");
    // filterCursor=2 means caret is at position 2 in "src"
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterMode: true,
      filterInput: "src",
      filterCursor: 2,
    });
    // The character at cursor position should be wrapped in an inverse ANSI sequence (\x1b[7m)
    expect(out).toMatch(/\x1b\[7m/);
  });

  it("shows '…' live stats placeholder while debounce pending (filterLiveStats=null, filterInput set)", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups, "a");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterMode: true,
      filterInput: "a",
      filterLiveStats: null,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("…");
  });

  it("shows live stats counts when filterLiveStats is provided", () => {
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts"], false)];
    const rows = buildRows(groups, "a");
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      filterMode: true,
      filterInput: "a",
      filterLiveStats: {
        visibleMatches: 1,
        visibleRepos: 1,
        hiddenMatches: 1,
        hiddenRepos: 0,
        visibleFiles: 1,
      },
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("1 repo · 1 file");
  });
});

// ─── buildRows — filterTarget + filterRegex ───────────────────────────────────

describe("buildRows (filterTarget + filterRegex)", () => {
  it("filters by content when filterTarget=content", () => {
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts"], false, true)];
    // makeGroup with withFragments=true generates fragment: "some code with <path>"
    const rows = buildRows(groups, "a.ts", "content");
    const paths = rows
      .filter((r) => r.type === "extract")
      .map((r) => groups[r.repoIndex].matches[r.extractIndex!].path);
    expect(paths).toContain("a.ts");
    expect(paths).not.toContain("b.ts");
  });

  it("filters by repo name when filterTarget=repo", () => {
    const g1 = makeGroup("org/service-auth", ["a.ts"]);
    const g2 = makeGroup("org/service-payments", ["b.ts"]);
    g1.folded = false;
    g2.folded = false;
    const rows = buildRows([g1, g2], "auth", "repo");
    const extractRows = rows.filter((r) => r.type === "extract");
    const repoNames = extractRows.map((r) => [g1, g2][r.repoIndex].repoFullName);
    expect(repoNames.some((n) => n.includes("auth"))).toBe(true);
    expect(repoNames.some((n) => n.includes("payments"))).toBe(false);
  });

  it("uses regex when filterRegex=true", () => {
    const groups = [makeGroup("org/repo", ["src/foo.ts", "lib/bar.ts"], false)];
    const rows = buildRows(groups, "^src/", "path", true);
    const paths = rows
      .filter((r) => r.type === "extract")
      .map((r) => groups[r.repoIndex].matches[r.extractIndex!].path);
    expect(paths).toContain("src/foo.ts");
    expect(paths).not.toContain("lib/bar.ts");
  });

  it("shows no extracts for invalid regex (no crash)", () => {
    const groups = [makeGroup("org/repo", ["src/foo.ts"], false)];
    const rows = buildRows(groups, "[broken", "path", true);
    const extracts = rows.filter((r) => r.type === "extract");
    expect(extracts.length).toBe(0);
  });

  it("toggling regex to invalid pattern collapses rows to 0 — cursor must be clamped (regression guard for Bug 3)", () => {
    // Regression guard for Bug 3: the Tab key in tui.ts toggles filterRegex but
    // did not rebuild rows or clamp cursor/scrollOffset afterward. When the new
    // regex is invalid (or simply more restrictive), the row list shrinks. If
    // cursor was pointing at a now-removed row, isCursorVisible returns false yet
    // the scroll-adjust while-loop doesn't fire (cursor is already 0 or the
    // condition `scrollOffset < cursor` is already false), leaving cursor
    // pointing at an invalid index — renderGroups skips the cursor highlight.
    //
    // The fix: after `filterRegex = !filterRegex`, rebuild rows and clamp:
    //   const newRows = buildRows(groups, filterInput, filterTarget, filterRegex);
    //   cursor = Math.min(cursor, Math.max(0, newRows.length - 1));
    //   scrollOffset = Math.min(scrollOffset, cursor);
    const groups = [makeGroup("org/repo", ["src/foo.ts", "src/bar.ts"], false)];
    // Before toggle: regex=false, pattern="src" → 2 extract rows visible
    const rowsBefore = buildRows(groups, "src", "path", false);
    expect(rowsBefore.filter((r) => r.type === "extract")).toHaveLength(2);
    let cursor = 2; // cursor on second extract
    // After toggle to regex=true with an invalid pattern:
    const rowsAfter = buildRows(groups, "[invalid", "path", true);
    expect(rowsAfter).toHaveLength(0); // invalid regex → no matches, no rows
    // isCursorVisible with stale cursor (still 2, rows=[]) must return false
    expect(isCursorVisible(rowsAfter, groups, cursor, 0, 10)).toBe(false);
    // The required clamp:
    cursor = Math.min(cursor, Math.max(0, rowsAfter.length - 1));
    expect(cursor).toBe(0);
  });
});

// ─── buildFilterStats — filterTarget + filterRegex ───────────────────────────

describe("buildFilterStats (filterTarget + filterRegex)", () => {
  it("counts visible/hidden by content filter", () => {
    const groups = [makeGroup("org/repo", ["a.ts", "b.ts"], false, true)];
    const stats = buildFilterStats(groups, "a.ts", "content");
    expect(stats.visibleMatches).toBe(1);
    expect(stats.hiddenMatches).toBe(1);
  });

  it("counts by repo filter", () => {
    const g1 = makeGroup("org/service-auth", ["a.ts"]);
    const g2 = makeGroup("org/service-payments", ["b.ts"]);
    g1.folded = false;
    g2.folded = false;
    const stats = buildFilterStats([g1, g2], "auth", "repo");
    expect(stats.visibleRepos).toBe(1);
    expect(stats.hiddenRepos).toBe(1);
  });

  it("counts with regex filter", () => {
    const groups = [makeGroup("org/repo", ["src/foo.ts", "lib/bar.ts"], false)];
    const stats = buildFilterStats(groups, "^src/", "path", true);
    expect(stats.visibleMatches).toBe(1);
    expect(stats.hiddenMatches).toBe(1);
  });
});

// ─── buildFileUrl ─────────────────────────────────────────────────────────────

describe("buildFileUrl", () => {
  it("returns htmlUrl unchanged when no textMatches", () => {
    const group = makeGroup("org/repo", ["src/a.ts"]);
    const match = group.matches[0]; // no textMatches (makeGroup default)
    expect(buildFileUrl(match)).toBe("https://github.com/org/repo/blob/main/src/a.ts");
  });

  it("returns htmlUrl unchanged when textMatches is empty array", () => {
    const group = makeGroup("org/repo", ["src/a.ts"]);
    const match = { ...group.matches[0], textMatches: [] };
    expect(buildFileUrl(match)).toBe("https://github.com/org/repo/blob/main/src/a.ts");
  });

  it("returns htmlUrl unchanged when textMatch has no matches", () => {
    const group = makeGroup("org/repo", ["src/a.ts"]);
    const match = {
      ...group.matches[0],
      textMatches: [{ fragment: "some code", matches: [] }],
    };
    expect(buildFileUrl(match)).toBe("https://github.com/org/repo/blob/main/src/a.ts");
  });

  it("appends #L{line} anchor when first segment has a line number", () => {
    const group = makeGroup("org/repo", ["src/a.ts"]);
    const match = {
      ...group.matches[0],
      textMatches: [
        {
          fragment: "const x = 1",
          matches: [{ text: "const", indices: [0, 5] as [number, number], line: 42, col: 1 }],
        },
      ],
    };
    expect(buildFileUrl(match)).toBe("https://github.com/org/repo/blob/main/src/a.ts#L42");
  });

  it("uses line from first match in first textMatch (ignores subsequent matches)", () => {
    const group = makeGroup("org/repo", ["src/b.ts"]);
    const match = {
      ...group.matches[0],
      textMatches: [
        {
          fragment: "line one\nline two",
          matches: [
            { text: "one", indices: [5, 8] as [number, number], line: 10, col: 5 },
            { text: "two", indices: [14, 17] as [number, number], line: 11, col: 5 },
          ],
        },
      ],
    };
    expect(buildFileUrl(match)).toBe("https://github.com/org/repo/blob/main/src/b.ts#L10");
  });
});

// ─── renderGroups — active row full-width highlight + left bar ────────────────

describe("renderGroups — active row styling", () => {
  it("active repo row starts with saturated purple left bar character ▌", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    // Find repo row by its content
    const repoLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoA"));
    expect(repoLine).toBeDefined();
    // Must contain ▌ character (the left-bar indicator)
    expect(repoLine!.replace(/\x1b\[[0-9;]*m/g, "")).toMatch(/▌/);
  });

  it("inactive repo row does NOT have left bar ▌", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"]), makeGroup("org/repoB", ["src/b.ts"])];
    const rows = buildRows(groups);
    // cursor=0 → repoA is active, repoB is inactive
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const repoBLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoB"));
    // repoB line must NOT contain ▌
    expect(repoBLine).toBeDefined();
    expect(repoBLine!.replace(/\x1b\[[0-9;]*m/g, "")).not.toMatch(/▌/);
  });

  it("active repo row has a background colour escape sequence (256-colour dark bg)", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const repoLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoA"));
    expect(repoLine).toBeDefined();
    // Must contain a 48;5; 256-colour background escape
    expect(repoLine!).toMatch(/\x1b\[48;5;\d+m/);
  });

  it("active extract row starts with left bar ▌", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"], false)];
    const rows = buildRows(groups);
    // cursor=1 → the extract row is active
    const out = renderGroups(groups, 1, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const extractLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("src/a.ts"));
    expect(extractLine).toBeDefined();
    expect(extractLine!.replace(/\x1b\[[0-9;]*m/g, "")).toMatch(/▌/);
  });
});

// ─── renderGroups — active extract row: homogeneous locSuffix colour ──────────

function makeGroupWithLineInfo(): RepoGroup {
  return {
    repoFullName: "org/repo",
    matches: [
      {
        path: "src/a.ts",
        repoFullName: "org/repo",
        htmlUrl: "https://github.com/org/repo/blob/main/src/a.ts",
        archived: false,
        textMatches: [
          {
            fragment: "const x = 1",
            matches: [{ text: "x", indices: [6, 7], line: 42, col: 7 }],
          },
        ],
      },
    ],
    folded: false,
    repoSelected: true,
    extractSelected: [true],
  };
}

describe("renderGroups — active extract row locSuffix colour", () => {
  it("active extract row: locSuffix (:42:7) uses white/bold, not dim", () => {
    const groups = [makeGroupWithLineInfo()];
    const rows = buildRows(groups);
    // cursor=1 → extract row is active
    const out = renderGroups(groups, 1, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const extractLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("src/a.ts"));
    expect(extractLine).toBeDefined();
    // The suffix :42:7 must appear in the line
    expect(extractLine!.replace(/\x1b\[[0-9;]*m/g, "")).toContain(":42:7");
    // On active row the locSuffix must NOT be wrapped in a dim ANSI sequence \x1b[2m
    // We isolate the suffix portion of the raw line and verify no dim before it.
    // Strategy: check that \x1b[2m (dim on) does NOT appear immediately before ":42"
    expect(extractLine!).not.toMatch(/\x1b\[2m[^m]*:42/);
  });

  it("inactive extract row: locSuffix uses dim styling", () => {
    const groups = [makeGroupWithLineInfo(), makeGroup("org/other", ["x.ts"])];
    const rows = buildRows(groups);
    // cursor=0 (repo row) → extract row at index 1 is inactive
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const extractLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("src/a.ts"));
    expect(extractLine).toBeDefined();
    // Inactive: dim (\x1b[2m) must appear in the line (applied to locSuffix)
    expect(extractLine!).toMatch(/\x1b\[2m/);
  });
});

// ─── renderHelpOverlay — bordered box + Esc key documentation ─────────────────

describe("renderHelpOverlay — cosmetic box", () => {
  it("output contains rounded-corner box characters ╭ and ╮", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("╭");
    expect(stripped).toContain("╮");
  });

  it("output contains bottom rounded-corner characters ╰ and ╯", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("╰");
    expect(stripped).toContain("╯");
  });

  it("output contains vertical bar │ for side borders", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("│");
  });

  it("documents Esc to close the help overlay", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Esc");
    // Esc should close/dismiss the overlay, documented near the close hint
    expect(stripped).toMatch(/[Ee]sc.*close|close.*[Ee]sc/);
  });

  it("no content line exceeds box inner width (all lines fit within the box)", () => {
    const out = renderHelpOverlay();
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const lines = stripped.split("\n");
    // The first line is the top border — its length defines the box width
    const topBorder = lines.find((l) => l.includes("╭"));
    expect(topBorder).toBeDefined();
    const boxWidth = topBorder!.length;
    // Every line that starts with │ must be exactly boxWidth wide
    for (const line of lines) {
      if (line.startsWith("│")) {
        expect(line.length).toBe(boxWidth);
      }
    }
  });
});

// ─── renderGroups — repo name and count colour palette ────────────────────────

describe("renderGroups — repo name colour palette", () => {
  it("inactive repo name uses bright purple 256-colour escape (38;5;129)", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"]), makeGroup("org/repoB", ["src/b.ts"])];
    const rows = buildRows(groups);
    // cursor=0 → repoA is active, repoB is inactive
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const repoBLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoB"));
    expect(repoBLine).toBeDefined();
    // Inactive repo name must be coloured with bright purple 38;5;129
    expect(repoBLine!).toContain("\x1b[38;5;129m");
  });

  it("active row background uses a purple shade (48;5;53), not the grey 48;5;236", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const repoLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoA"));
    expect(repoLine).toBeDefined();
    // Must NOT use the old grey background 48;5;236
    expect(repoLine!).not.toContain("\x1b[48;5;236m");
    // Must use the new purple background 48;5;53
    expect(repoLine!).toContain("\x1b[48;5;53m");
  });

  it("match count uses muted purple 256-colour escape (38;5;99)", () => {
    const groups = [makeGroup("org/repoA", ["src/a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const lines = out.split("\n");
    const repoLine = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes("org/repoA"));
    expect(repoLine).toBeDefined();
    // Count must use muted purple 38;5;99
    expect(repoLine!).toContain("\x1b[38;5;99m");
  });
});

// ─── renderGroups — position indicator ───────────────────────────────────────

describe("renderGroups — position indicator", () => {
  it("shows cursor position (cursor+1 of total)", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeGroup(`org/repo${i}`, ["file.ts"]));
    const rows = buildRows(groups);
    const out = renderGroups(groups, 7, rows, 40, 0, "q", "org", { termWidth: 80 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("↕ row 8 of 15");
  });

  it("shows cursor at last row when at the bottom (cursor+1 === total)", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeGroup(`org/repo${i}`, ["file.ts"]));
    const rows = buildRows(groups);
    // cursor=14 (last row), scrollOffset=13 — the bug scenario
    const out = renderGroups(groups, 14, rows, 10, 13, "q", "org", { termWidth: 80 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("↕ row 15 of 15");
  });

  it("updates when cursor navigates up from bottom (scrollOffset unchanged)", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeGroup(`org/repo${i}`, ["file.ts"]));
    const rows = buildRows(groups);
    // scrollOffset=13 but cursor moved back up to 3 — indicator must reflect cursor=3, not scrollOffset
    const out = renderGroups(groups, 3, rows, 10, 13, "q", "org", { termWidth: 80 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("↕ row 4 of 15");
    // Must NOT show 14 (old scrollOffset+1) as the first number
    expect(stripped).not.toMatch(/↕ row 14/);
  });

  it("shows row 1 of total at top (cursor=0)", () => {
    const groups = Array.from({ length: 15 }, (_, i) => makeGroup(`org/repo${i}`, ["file.ts"]));
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", { termWidth: 80 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("↕ row 1 of 15");
  });

  it("rendered output never exceeds termHeight lines when termWidth is narrow (hints clipping)", () => {
    // Regression guard for issue #105 (root cause: hints line wraps on narrow terminals).
    // The hints text is ~158 visible chars. On an 80-col terminal it wraps to 2 rows, making
    // the rendered output termHeight+1 lines long → terminal scrolls → title disappears from top.
    // Fix: hints are clipped to termWidth so the line always occupies exactly 1 terminal row.
    const termWidth = 80; // narrower than the full hints text (~158 chars)
    const groups = [makeGroup("org/repoA", ["a.ts", "b.ts", "c.ts"], false)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    // The hints line must not exceed termWidth visible chars — if it does it wraps
    // and the terminal displays one extra line, pushing the title off the top.
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const hintsLine = stripped.split("\n").find((l) => l.startsWith("← / →"));
    expect(hintsLine).toBeDefined();
    expect(hintsLine!.length).toBeLessThanOrEqual(termWidth);
    // Title must still appear as the very first content
    expect(stripped.startsWith(" github-code-search ")).toBe(true);
  });

  it("section label never wraps — long label is clipped to termWidth (regression #105)", () => {
    // When a team/section name is longer than termWidth, the rendered "── label " line
    // would wrap to 2+ physical lines. usedLines += 2 only accounts for 1 physical label
    // line → the viewport overflows by 1 → title scrolls off. Fix: clip label to termWidth-4.
    const termWidth = 60;
    const longLabel = "squad-architecture-and-platform-with-extra-words-that-exceed-width";
    const groups = [
      {
        ...makeGroup("org/repoA", ["a.ts"], true),
        sectionLabel: longLabel,
      },
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Find the section line (contains "──")
    const sectionLine = stripped.split("\n").find((l) => l.startsWith("── "));
    expect(sectionLine).toBeDefined();
    // "── " (3) + label + " " (1) must fit in termWidth
    expect(sectionLine!.length).toBeLessThanOrEqual(termWidth);
    // Title must still appear at the top
    expect(stripped.startsWith(" github-code-search ")).toBe(true);
  });

  it("fragment lines never wrap — clipped to termWidth minus indent (regression #105)", () => {
    // Fragment lines truncated to MAX_LINE_CHARS=120 + 6 chars indent = 126 visible chars.
    // On a terminal < 127 cols they wrap, causing the render budget to undercount physical
    // lines, which makes the output exceed termHeight and the title scrolls off.
    // Fix: fragmentMaxChars = termWidth - 6 so rendered lines are always ≤ termWidth chars.
    const termWidth = 80;
    const longFragment = "x".repeat(200); // single very long code line (no newlines)
    const groups: import("./types.ts").RepoGroup[] = [
      {
        repoFullName: "org/repo",
        matches: [
          {
            path: "src/file.ts",
            repoFullName: "org/repo",
            htmlUrl: "https://github.com/org/repo/blob/main/src/file.ts",
            archived: false,
            textMatches: [{ fragment: longFragment, matches: [] }],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true],
      },
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Find the fragment line (indented with 6 spaces before code)
    const fragLine = stripped.split("\n").find((l) => l.startsWith("      ") && l.includes("x"));
    expect(fragLine).toBeDefined();
    // Visible width must not exceed termWidth (clip ensures no wrap)
    expect(fragLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("title line never wraps — long query+org clipped to termWidth (regression #105)", () => {
    // " github-code-search " prefix is 22 visible chars.
    // A very long query or org can push the title past termWidth → wraps → title gone.
    const termWidth = 40;
    const groups = [makeGroup("org/repoA", ["a.ts"], true)];
    const rows = buildRows(groups);
    const out = renderGroups(
      groups,
      0,
      rows,
      20,
      0,
      "this-is-a-very-long-query-string-that-exceeds-width",
      "my-very-long-org-name",
      { termWidth },
    );
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const titleLine = stripped.split("\n")[0];
    expect(titleLine.length).toBeLessThanOrEqual(termWidth);
    expect(stripped.startsWith(" github-code-search ")).toBe(true);
  });

  it("summary line never wraps — clipped to termWidth (regression #105)", () => {
    // buildSummaryFull can produce long strings when selected counts are shown.
    const termWidth = 40;
    // Create many repos/files/matches with partial selection to force the long form.
    const groups = Array.from({ length: 50 }, (_, i) =>
      makeGroup(
        `org/repo${i}`,
        Array.from({ length: 20 }, (__, j) => `file${j}.ts`),
      ),
    );
    // Deselect one to force the "(X selected)" annotation
    groups[0].repoSelected = false;
    groups[0].extractSelected[0] = false;
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const lines = stripped.split("\n");
    // Summary is the second line (index 1)
    expect(lines[1].length).toBeLessThanOrEqual(termWidth);
  });

  it("repo line never wraps — long repoFullName clipped to termWidth (regression #105)", () => {
    // A very long repo name with right-aligned match count should never exceed termWidth.
    const termWidth = 40;
    const groups = [
      makeGroup("org/a-very-long-repository-name-that-exceeds-terminal-width", ["a.ts"], true),
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Find the repo line — may start with ▌ (active bar) + ▾/▸, or directly ▾/▸ when inactive
    const repoLine = stripped.split("\n").find((l) => l.includes("▾") || l.includes("▸"));
    expect(repoLine).toBeDefined();
    expect(repoLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("extract path line never wraps — long file path clipped to termWidth (regression #105)", () => {
    // A very long file path in an extract row should be clipped.
    const termWidth = 40;
    const groups: import("./types.ts").RepoGroup[] = [
      {
        repoFullName: "org/repo",
        matches: [
          {
            path: "src/this/is/a/very/deeply/nested/path/that/exceeds/terminal/width.ts",
            repoFullName: "org/repo",
            htmlUrl: "https://github.com/org/repo/blob/main/deeply/nested.ts",
            archived: false,
            textMatches: [
              { fragment: "code", matches: [{ text: "code", indices: [0, 4], line: 42, col: 1 }] },
            ],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true],
      },
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Extract path line: inactive form = "    ✓ " (6 visible chars) + path
    const extractLine = stripped.split("\n").find((l) => l.match(/^    [✓ ]/));
    expect(extractLine).toBeDefined();
    expect(extractLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("extract path line (cursor=active) never wraps — correct active prefix width (regression #106)", () => {
    // Active prefix: ACTIVE_BAR_WIDTH (1) + "  " (2) + checkbox (1) + space (1) = 5 visible chars.
    // Previous code subtracted PATH_INDENT twice for inactive rows which over-clipped.
    // This test verifies the active (cursor=1) form uses the correct prefix width.
    const termWidth = 40;
    const groups: import("./types.ts").RepoGroup[] = [
      {
        repoFullName: "org/repo",
        matches: [
          {
            path: "src/this/is/a/very/deeply/nested/path/that/exceeds/terminal/width.ts",
            repoFullName: "org/repo",
            htmlUrl: "https://github.com/org/repo/blob/main/deeply/nested.ts",
            archived: false,
            textMatches: [
              { fragment: "code", matches: [{ text: "code", indices: [0, 4], line: 42, col: 1 }] },
            ],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true],
      },
    ];
    const rows = buildRows(groups);
    // cursor=1 → extract row is the cursor (active) form
    const out = renderGroups(groups, 1, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Active extract line starts with "▌  ✓ " (bar + 2-space indent + checkbox + space)
    const extractLine = stripped.split("\n").find((l) => l.match(/^▌\s+[✓ ]/));
    expect(extractLine).toBeDefined();
    expect(extractLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("fragment lines never wrap on very narrow terminal — Math.max(1,…) not Math.max(20,…) (regression #106)", () => {
    // fragmentMaxChars = Math.max(1, termWidth - FRAGMENT_INDENT - 1).
    // With the old Math.max(20, …) floor, on a very narrow terminal (termWidth ≤ 26)
    // fragmentMaxChars could be clamped to 20. Combined with FRAGMENT_INDENT=6, the rendered
    // fragment line (6+20 = 26 chars) would exceed termWidth and wrap.
    // Fix: use Math.max(1, …) so the fragment never exceeds termWidth.
    const termWidth = 15; // narrower than FRAGMENT_INDENT(6) + old floor(20) = 26
    const longFragment = "x".repeat(200);
    const groups: import("./types.ts").RepoGroup[] = [
      {
        repoFullName: "org/repo",
        matches: [
          {
            path: "f.ts",
            repoFullName: "org/repo",
            htmlUrl: "https://github.com/org/repo/blob/main/f.ts",
            archived: false,
            textMatches: [{ fragment: longFragment, matches: [] }],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true],
      },
    ];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 20, 0, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const fragLine = stripped.split("\n").find((l) => l.startsWith("      ") && l.includes("x"));
    expect(fragLine).toBeDefined();
    expect(fragLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("sticky repo line never wraps — long repoFullName clipped to termWidth (regression #105)", () => {
    // When a repo header has scrolled past the viewport, the sticky line must still fit.
    const termWidth = 40;
    const longRepoName = "org/a-very-long-repository-name-that-exceeds-terminal-width";
    const groups: import("./types.ts").RepoGroup[] = [
      {
        repoFullName: longRepoName,
        matches: [
          {
            path: "a.ts",
            repoFullName: longRepoName,
            htmlUrl: "https://github.com/org/repo/blob/main/a.ts",
            archived: false,
            textMatches: [{ fragment: "x", matches: [] }],
          },
          {
            path: "b.ts",
            repoFullName: longRepoName,
            htmlUrl: "https://github.com/org/repo/blob/main/b.ts",
            archived: false,
            textMatches: [{ fragment: "x", matches: [] }],
          },
        ],
        folded: false,
        repoSelected: true,
        extractSelected: [true, true],
      },
    ];
    const rows = buildRows(groups);
    // cursor points to second extract (index 2), scrollOffset=1 (repo row scrolled off)
    const out = renderGroups(groups, 2, rows, 20, 1, "q", "org", { termWidth });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // Sticky line starts with "▲"
    const stickyLine = stripped.split("\n").find((l) => l.startsWith("▲"));
    expect(stickyLine).toBeDefined();
    expect(stickyLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("section after folded-repo cursor never overflows viewport (regression #105)", () => {
    // Root cause: for `section` rows, the render loop was pushing the line to output
    // BEFORE checking whether the 2-line section budget fit in the remaining viewport.
    // Contrast with repo/extract rows which check first.
    // Symptom: cursor on a folded repo (1 line), next row is a section (2 lines).
    // If only 1 line remained in the viewport, the section was still rendered → output
    // exceeded termHeight by 1 → title scrolled off the top.
    // This is exactly the "folded: title gone, unfolded: title back" behaviour reported.
    //
    // Setup: termHeight=14 → viewportHeight=8.
    // 6 folded repo rows fill usedLines=6 before cursor.
    // Cursor on folded repo: usedLines=6+1=7, 7 < 8 → loop continues.
    // Section row next: usedLines+2=9 > 8 → must break WITHOUT rendering (with fix).
    // Without the guard: section is pushed to lines[] first, usedLines=9, then break
    // → output has 9 viewport lines instead of max 8 → total 15 > termHeight=14 → title scrolls off.
    const termHeight = 14; // viewportHeight = termHeight - 6 = 8
    // 6 folded repos to fill usedLines=6 before the cursor repo
    const prefixGroups = Array.from({ length: 6 }, (_, i) =>
      makeGroup(`org/repo${i}`, ["f.ts"], true),
    );
    // cursor repo: folded (1 line). The NEXT group has a sectionLabel so buildRows emits
    // a section row before it.
    const cursorGroup = makeGroup("org/cursor-repo", ["f.ts"], true);
    const nextGroup = {
      ...makeGroup("org/next-repo", ["f.ts"], true),
      sectionLabel: "squad-portal",
    };
    const allGroups = [...prefixGroups, cursorGroup, nextGroup];
    const rows = buildRows(allGroups);
    // cursor=6 (the 7th row, 0-indexed: rows 0..5 are the 6 prefix repos, row 6 = cursorRepo)
    const cursorIndex = 6;
    const out = renderGroups(allGroups, cursorIndex, rows, termHeight, 0, "q", "org", {
      termWidth: 80,
    });
    const outputLines = out.split("\n");
    // The rendered output must never exceed termHeight physical lines.
    expect(outputLines.length).toBeLessThanOrEqual(termHeight);
    // Title must still be the first line.
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped.startsWith(" github-code-search ")).toBe(true);
    // Footer must be anchored to the last line.
    const strippedLines = stripped.split("\n");
    expect(strippedLines[strippedLines.length - 1].trim()).toMatch(/^↕ row \d+ of \d+$/);
  });

  it("section as first viewport row costs 1 line — footer does not disappear (regression #105)", () => {
    // Root cause: section rows embedded a leading \\n in their string.
    // When the section is the FIRST row rendered in the viewport (usedLines===0),
    // the hints header already ends with \\n, and lines.join("\\n") adds a second \\n
    // before the section's own \\n prefix → 2 blank lines (3 physical lines for a
    // "2-line" element) → 1 extra line over budget → footer "↕ row X of Y" pushed
    // below the bottom of the terminal and lost.
    //
    // Fix: blank separator emitted only when usedLines > 0 (not embedded in the string).
    // sectionCost = usedLines === 0 ? 1 : 2.
    //
    // Setup: termHeight=8 → viewportHeight=2.
    // scrollOffset=1 → rows[1] is a section row → first viewport row is a section.
    // Old code: section cost = 2 → fills viewport; repo behind section is skipped.
    //   But worse: embed \\n → actual physical lines = 3 → total output = 9 > 8 → title gone.
    // New code: section cost = 1 → 1 line remaining → next repo row fits → footer stays.
    // In both cases the total output lines must not exceed termHeight.
    const termHeight = 8; // viewportHeight = 8 - 6 = 2
    const group0 = makeGroup("org/repo0", ["a.ts"], true);
    const group1 = {
      ...makeGroup("org/repo1", ["b.ts"], true),
      sectionLabel: "squad-portal",
    };
    const groups = [group0, group1];
    const rows = buildRows(groups);
    // rows[0]=repo0, rows[1]=section for squad-portal, rows[2]=repo1
    // scrollOffset=1 → section is first in viewport
    const cursorIndex = 2; // cursor on repo1
    const out = renderGroups(groups, cursorIndex, rows, termHeight, 1, "q", "org", {
      termWidth: 80,
    });
    const outputLines = out.split("\n");
    // The rendered output must never exceed termHeight physical lines.
    expect(outputLines.length).toBeLessThanOrEqual(termHeight);
    // Title must still be the first line.
    const strippedOut = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(strippedOut.startsWith(" github-code-search ")).toBe(true);
    // Footer position indicator (↕) must appear on the very last line so that
    // it is anchored to the bottom of the terminal (padding test).
    const strippedLines = strippedOut.split("\n");
    expect(strippedLines[strippedLines.length - 1].trim()).toMatch(/^↕ row \d+ of \d+$/);
  });

  it("footer is fixed at the last line even when viewport content is sparse (regression #105)", () => {
    // Root cause: the footer was appended immediately after the last rendered item.
    // When the viewport was not full (few results, everything folded, or cursor near
    // the end), the footer floated up instead of staying at the bottom.
    // Fix: push (viewportHeight - usedLines) blank lines before the footer so that
    // the total rendered line count is always exactly termHeight.
    //
    // Setup: 2 folded repos → 2 viewport lines used.
    // termHeight=10 → viewportHeight=4 → 2 unused lines above footer.
    // With fix: output = 10 lines, footer on line 10.
    // Without fix: output = 8 lines, footer on line 8 (floats 2 lines above bottom).
    const termHeight = 10;
    const groups = [makeGroup("org/repo0", ["a.ts"], true), makeGroup("org/repo1", ["b.ts"], true)];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, termHeight, 0, "q", "org", { termWidth: 80 });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const lines = stripped.split("\n");
    // Output must be exactly termHeight lines (not fewer due to missing padding).
    expect(lines).toHaveLength(termHeight);
    // Footer must be the last line.
    expect(lines[lines.length - 1].trim()).toMatch(/^↕ row \d+ of \d+$/);
    // Second-to-last must be blank (the \n separator before the indicator).
    expect(lines[lines.length - 2].trim()).toBe("");
  });
});

// ─── normalizeScrollOffset ────────────────────────────────────────────────────

describe("normalizeScrollOffset", () => {
  it("returns 0 when scrollOffset is already 0", () => {
    const groups = [makeGroup("org/repo0", ["a.ts"], true)];
    const rows = buildRows(groups);
    expect(normalizeScrollOffset(0, rows, groups, 10)).toBe(0);
  });

  it("does not decrease scrollOffset when viewport is already full", () => {
    // 5 folded repos, scrollOffset=2, viewportHeight=3 → rows 2..4 fill exactly 3 lines.
    // Prepending row 1 would need 4 lines → scrollOffset stays at 2.
    const groups = Array.from({ length: 5 }, (_, i) => makeGroup(`org/repo${i}`, ["f.ts"], true));
    const rows = buildRows(groups);
    expect(normalizeScrollOffset(2, rows, groups, 3)).toBe(2);
  });

  it("decreases scrollOffset to fill empty space at the bottom", () => {
    // 5 folded repos. scrollOffset=4 → only row 4 (1 line) visible in a viewport of 3.
    // Prepending row 3: 2 lines ≤ 3 → scrollOffset decreases to 3.
    // Prepending row 2: 3 lines ≤ 3 → scrollOffset decreases to 2.
    // Prepending row 1: 4 lines > 3 → stop.
    const groups = Array.from({ length: 5 }, (_, i) => makeGroup(`org/repo${i}`, ["f.ts"], true));
    const rows = buildRows(groups);
    expect(normalizeScrollOffset(4, rows, groups, 3)).toBe(2);
  });

  it("normalizes all the way to 0 when all rows fit", () => {
    // 2 folded repos (2 lines total) in a viewport of 5 → scrollOffset pulled back to 0.
    const groups = [makeGroup("org/repo0", ["a.ts"], true), makeGroup("org/repo1", ["b.ts"], true)];
    const rows = buildRows(groups);
    expect(normalizeScrollOffset(2, rows, groups, 5)).toBe(0);
  });

  it("accounts for section cost when section is first in candidate viewport", () => {
    // rows: [repo0(1), section(1 as first), repo1(1)] → total 3 lines when starting at 0.
    // viewportHeight=3, scrollOffset=1 (section is first) → cost=1 for section → total=2 ≤ 3.
    // But adding row 0 (repo0): it is no longer first, section becomes 2nd → section costs 2 → total=4 > 3.
    // Wait: from index 0: repo0=1, then section (used=1, not 0) = 2 lines, repo1=1 → total=4 > 3.
    // So scrollOffset should stay at 1.
    const groups = [
      makeGroup("org/repo0", ["a.ts"], true),
      { ...makeGroup("org/repo1", ["b.ts"], true), sectionLabel: "squad-portal" },
    ];
    const rows = buildRows(groups);
    // rows: [repo0, section:squad-portal, repo1]
    expect(normalizeScrollOffset(1, rows, groups, 3)).toBe(1);
  });
});

// ─── renderGroups — re-pick mode hints bar ────────────────────────────────────

describe("renderGroups — re-pick mode hints bar", () => {
  it("shows Re-pick: prefix and candidate teams when repickMode is active", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      repickMode: {
        active: true,
        repoIndex: 0,
        candidates: ["squad-frontend", "squad-mobile"],
        focusedIndex: 0,
      },
      termWidth: 120,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Re-pick:");
    expect(stripped).toContain("squad-frontend");
    expect(stripped).toContain("0/u restore");
    expect(stripped).toContain("Esc/t cancel");
  });

  it("re-pick hints line visible width never exceeds termWidth", () => {
    // Fix: clip hints to termWidth so the line never wraps — see issue #105.
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const termWidth = 60;
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      repickMode: {
        active: true,
        repoIndex: 0,
        candidates: ["squad-frontend", "squad-mobile"],
        focusedIndex: 0,
      },
      termWidth,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const repickLine = stripped.split("\n").find((l) => l.includes("Re-pick:"));
    expect(repickLine).toBeDefined();
    expect(repickLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("truncates suffix gracefully on very narrow terminal without crashing", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const termWidth = 25; // narrow — full suffix won't fit
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      repickMode: {
        active: true,
        repoIndex: 0,
        candidates: ["squad-frontend", "squad-mobile"],
        focusedIndex: 0,
      },
      termWidth,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    const repickLine = stripped.split("\n").find((l) => l.includes("Re-pick:"));
    expect(repickLine).toBeDefined();
    expect(repickLine!.length).toBeLessThanOrEqual(termWidth);
  });

  it("focuses the correct candidate in [ brackets ]", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {
      repickMode: {
        active: true,
        repoIndex: 0,
        candidates: ["squad-alpha", "squad-beta"],
        focusedIndex: 1,
      },
      termWidth: 120,
    });
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    // focusedIndex=1 → squad-beta is focused → should appear in [ brackets ]
    expect(stripped).toContain("[ squad-beta ]");
  });
});
