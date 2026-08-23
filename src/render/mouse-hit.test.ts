import { describe, it, expect } from "bun:test";
import { hitTestClick } from "./mouse-hit.ts";
import type { RepoGroup, Row } from "../types.ts";

function createTestGroup(name: string, repoSelected = true): RepoGroup {
  return {
    repoFullName: name,
    repoSelected,
    folded: false,
    matches: [
      {
        filePath: "src/test.ts",
        textMatches: [],
        extractSelected: false,
      },
    ],
    extractSelected: [false],
    pickedFrom: undefined,
    sectionLabel: undefined,
  };
}

describe("hitTestClick", () => {
  it("returns null for click out of bounds (y below rows)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 1, 100);
    expect(result).toBeNull();
  });

  it("returns null for click out of bounds (y at 0)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 1, 0);
    expect(result).toBeNull();
  });

  it("detects fold action on repo row arrow column (1-indexed column 1)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    // Column 1 (1-indexed terminal) is the arrow emoji (occupies 2 visual columns)
    const result = hitTestClick(groups, rows, 0, 1, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 1,
      action: "fold",
    });
  });

  it("detects fold action on repo row arrow column (1-indexed column 2, part of emoji)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    // Column 2 (1-indexed terminal) is also part of the arrow emoji
    const result = hitTestClick(groups, rows, 0, 2, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 2,
      action: "fold",
    });
  });

  it("detects select action on repo row checkbox column (1-indexed column 4)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    // Column 4 (1-indexed terminal) is the checkbox emoji (occupies columns 4-5 visually)
    const result = hitTestClick(groups, rows, 0, 4, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 4,
      action: "select",
    });
  });

  it("detects select action on repo row checkbox column (1-indexed column 5, part of emoji)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    // Column 5 (1-indexed terminal) is also part of the checkbox emoji
    const result = hitTestClick(groups, rows, 0, 5, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 5,
      action: "select",
    });
  });

  it("detects navigate action on repo row elsewhere (column 10)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 10, 1); // column 10, row 1
    expect(result).toEqual({
      row: rows[0],
      column: 10,
      action: "navigate",
    });
  });

  it("detects select action on extract row checkbox", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
    // Column 4 (1-indexed terminal) is the checkbox emoji on extract rows too
    const result = hitTestClick(groups, rows, 0, 4, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 4,
      action: "select",
    });
  });

  it("detects select action on extract row anywhere in header except fold zone", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
    // Column 6+ on extract header allows double-click selection anywhere on the line
    const result = hitTestClick(groups, rows, 0, 6, 1);
    expect(result).toEqual({
      row: rows[0],
      column: 6,
      action: "select",
    });
  });

  it("detects navigate action on extract fragment line (not header)", () => {
    // Create a test group with an extract that has text matches (creates multiple lines)
    const groups: RepoGroup[] = [
      {
        repoFullName: "org/repo",
        repoSelected: true,
        folded: false,
        matches: [
          {
            filePath: "src/test.ts",
            textMatches: [
              {
                fragment: "line1\nline2\nline3",
                matchIndices: [0, 4],
              },
            ],
            extractSelected: false,
          },
        ],
        extractSelected: [false],
        pickedFrom: undefined,
        sectionLabel: undefined,
      },
    ];
    const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
    // With 3 lines in the fragment, extract should have >1 line total
    // y=2 means clickedLineOffset=1 (on a fragment line, not the header)
    const result = hitTestClick(groups, rows, 0, 4, 2);
    // On fragment line, even if x=4, the row is returned with navigate action
    expect(result?.row.type).toBe("extract");
    expect(result?.action).toBe("navigate");
  });

  it("handles multiple rows and identifies the correct row", () => {
    const groups = [createTestGroup("org/repoA"), createTestGroup("org/repoB")];
    const rows: Row[] = [
      { type: "repo", repoIndex: 0 },
      { type: "repo", repoIndex: 1 },
    ];
    // Row 1 is repoA, row 2 is repoB
    const result = hitTestClick(groups, rows, 0, 4, 2); // column 4, row 2
    expect(result?.row.repoIndex).toBe(1);
    expect(result?.action).toBe("select");
  });

  it("handles section rows (no special action)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [
      { type: "section", repoIndex: -1, sectionLabel: "section-a" },
      { type: "repo", repoIndex: 0 },
    ];
    const result = hitTestClick(groups, rows, 0, 1, 1); // section row, fold zone
    expect(result?.row.type).toBe("section");
    expect(result?.action).toBe("navigate");
  });

  it("respects scrollOffset when identifying rows", () => {
    const groups = [
      createTestGroup("org/repoA"),
      createTestGroup("org/repoB"),
      createTestGroup("org/repoC"),
    ];
    const rows: Row[] = [
      { type: "repo", repoIndex: 0 },
      { type: "repo", repoIndex: 1 },
      { type: "repo", repoIndex: 2 },
    ];
    // With scrollOffset=1, row 0 is not visible. Click on visual line 1 should hit row 1.
    const result = hitTestClick(groups, rows, 1, 4, 1); // column 4 (checkbox), line 1
    expect(result?.row.repoIndex).toBe(1);
  });
});
