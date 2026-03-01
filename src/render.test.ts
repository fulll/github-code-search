import { describe, expect, it } from "bun:test";
import {
  applySelectAll,
  applySelectNone,
  buildFilterStats,
  buildMatchCountLabel,
  buildRows,
  buildSelectionSummary,
  buildSummary,
  buildSummaryFull,
  highlightFragment,
  isCursorVisible,
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

  it("status bar hint line includes Z fold-all and o open shortcuts", () => {
    const groups = [makeGroup("org/repo", ["a.ts"])];
    const rows = buildRows(groups);
    const out = renderGroups(groups, 0, rows, 40, 0, "q", "org", {});
    const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Z fold-all");
    expect(stripped).toContain("o open");
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
