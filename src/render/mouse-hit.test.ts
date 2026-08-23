import { describe, it, expect } from "bun:test";
import { hitTestClick, type ClickTarget } from "./mouse-hit.ts";
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
    const result = hitTestClick(groups, rows, 0, 0, 100);
    expect(result).toBeNull();
  });

  it("returns null for click out of bounds (y at 0)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 0, 0);
    expect(result).toBeNull();
  });

  it("detects fold action on repo row arrow column", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 0, 1); // column 0, row 1
    expect(result).toEqual({
      row: rows[0],
      column: 0,
      action: "fold",
    });
  });

  it("detects select action on repo row checkbox column", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 2, 1); // column 2, row 1
    expect(result).toEqual({
      row: rows[0],
      column: 2,
      action: "select",
    });
  });

  it("detects navigate action on repo row elsewhere", () => {
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
    const result = hitTestClick(groups, rows, 0, 2, 1); // column 2, row 1
    expect(result).toEqual({
      row: rows[0],
      column: 2,
      action: "select",
    });
  });

  it("detects navigate action on extract row elsewhere", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
    const result = hitTestClick(groups, rows, 0, 10, 1); // column 10, row 1
    expect(result).toEqual({
      row: rows[0],
      column: 10,
      action: "navigate",
    });
  });

  it("handles multiple rows and identifies the correct row", () => {
    const groups = [createTestGroup("org/repoA"), createTestGroup("org/repoB")];
    const rows: Row[] = [
      { type: "repo", repoIndex: 0 },
      { type: "repo", repoIndex: 1 },
    ];
    // Row 1 is repoA, row 2 is repoB
    const result = hitTestClick(groups, rows, 0, 2, 2); // column 2, row 2
    expect(result?.row.repoIndex).toBe(1);
    expect(result?.action).toBe("select");
  });

  it("handles section rows (no special action)", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [
      { type: "section", repoIndex: -1, sectionLabel: "section-a" },
      { type: "repo", repoIndex: 0 },
    ];
    const result = hitTestClick(groups, rows, 0, 0, 1); // section row
    expect(result?.row.type).toBe("section");
    expect(result?.action).toBe("navigate");
  });
});
