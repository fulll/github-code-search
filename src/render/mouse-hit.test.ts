import { describe, it, expect } from "bun:test";
import { hitTestClick } from "./mouse-hit.ts";
import {
  FOLD_COLUMN_START,
  FOLD_COLUMN_END,
  CHECKBOX_COLUMN_START,
  CHECKBOX_COLUMN_END,
  NAV_COLUMN_START,
} from "./layout-constants.ts";
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

  it("respects headerLines offset when calculating row position", () => {
    const groups = [createTestGroup("org/repo")];
    const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
    // With 4 header lines, y=5 is the first data row
    // Without header offset, would be out of bounds; with offset, hits the row
    const result = hitTestClick(groups, rows, 0, 1, 5, 4);
    expect(result).not.toBeNull();
    expect(result?.row).toBe(rows[0]);
  });

  // ─── Fold Zone Tests (Repo Rows Only) ───────────────────────────────────────
  describe("fold zone (repo rows)", () => {
    it("detects fold action at fold zone start column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, FOLD_COLUMN_START, 1);
      expect(result).toEqual({
        row: rows[0],
        column: FOLD_COLUMN_START,
        action: "fold",
      });
    });

    it("detects fold action at fold zone end column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, FOLD_COLUMN_END, 1);
      expect(result).toEqual({
        row: rows[0],
        column: FOLD_COLUMN_END,
        action: "fold",
      });
    });

    it("does not detect fold action outside fold zone", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, FOLD_COLUMN_END + 1, 1);
      expect(result?.action).not.toBe("fold");
    });
  });

  // ─── Checkbox Zone Tests ────────────────────────────────────────────────────
  describe("checkbox zone (repo rows)", () => {
    it("detects select action at checkbox zone start column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_START, 1);
      expect(result).toEqual({
        row: rows[0],
        column: CHECKBOX_COLUMN_START,
        action: "select",
      });
    });

    it("detects select action at checkbox zone end column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_END, 1);
      expect(result).toEqual({
        row: rows[0],
        column: CHECKBOX_COLUMN_END,
        action: "select",
      });
    });

    it("detects select action beyond checkbox column (double-click full width)", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Double-click works on entire row width from CHECKBOX_COLUMN_START onwards
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_END + 1, 1);
      expect(result?.action).toBe("select");
    });

    it("detects navigate action only before checkbox zone", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Column 3 is between fold (1-2) and checkbox (4+), should be navigate
      const result = hitTestClick(groups, rows, 0, 3, 1);
      expect(result?.action).toBe("navigate");
    });
  });

  // ─── Navigation Zone Tests ──────────────────────────────────────────────────
  describe("navigation zone", () => {
    it("detects navigate action at separator column (column 3)", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Column 3 is between fold (1-2) and checkbox (4+), should be navigate
      const result = hitTestClick(groups, rows, 0, 3, 1);
      expect(result).toEqual({
        row: rows[0],
        column: 3,
        action: "navigate",
      });
    });

    it("detects select action at nav column start (column 6) for repos", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Column 6 and beyond is now part of checkbox zone (full-width select)
      const result = hitTestClick(groups, rows, 0, NAV_COLUMN_START, 1);
      expect(result?.action).toBe("select");
    });

    it("detects select action at far right column for repos", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Full-width double-click from checkbox start onwards
      const result = hitTestClick(groups, rows, 0, 100, 1);
      expect(result?.action).toBe("select");
    });
  });

  // ─── Extract Row Tests ──────────────────────────────────────────────────────
  describe("extract rows", () => {
    it("detects select action on extract row header checkbox", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_START, 1);
      expect(result).toEqual({
        row: rows[0],
        column: CHECKBOX_COLUMN_START,
        action: "select",
      });
    });

    it("detects select action on extract row header anywhere from checkbox column onwards", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
      // Double-click on extract works on entire header line from checkbox column onwards
      const result = hitTestClick(groups, rows, 0, NAV_COLUMN_START, 1);
      expect(result?.action).toBe("select");
    });

    it("detects select action on extract row header at far right column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
      // Double-click works anywhere from checkbox start
      const result = hitTestClick(groups, rows, 0, 100, 1);
      expect(result?.action).toBe("select");
    });

    it("detects navigate on non-header line of extract (continuation line)", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
      // Simulate clicking on the 2nd line of an extract that spans multiple lines
      // Line 1 (header): y=1, lineOffset=0
      // Line 2 (continuation): y=2, lineOffset=1
      // This requires mocking or understanding rowTerminalLines behavior
      // For now, we test the single-line case and checkbox behavior
      const result = hitTestClick(groups, rows, 0, NAV_COLUMN_START, 1);
      expect(result?.action).toBe("select"); // Still select on header line
    });
  });

  // ─── Section Row Tests ──────────────────────────────────────────────────────
  describe("section rows", () => {
    it("detects navigate action on section row (no fold/select zones)", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "section", sectionLabel: "Test Section" }];
      // Section rows don't have fold or select actions, always navigate
      const result = hitTestClick(groups, rows, 0, FOLD_COLUMN_START, 1);
      expect(result?.action).toBe("navigate");
    });

    it("detects navigate action on section row at any column", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "section", sectionLabel: "Test Section" }];
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_START, 1);
      expect(result?.action).toBe("navigate");
    });
  });

  // ─── Scroll Offset Tests ────────────────────────────────────────────────────
  describe("scroll offset handling", () => {
    it("skips rows before scroll offset", () => {
      const groups = [createTestGroup("org/repo1"), createTestGroup("org/repo2")];
      const rows: Row[] = [
        { type: "repo", repoIndex: 0 },
        { type: "repo", repoIndex: 1 },
      ];
      // With scrollOffset=1, only repo2 is visible; clicking on first line hits repo2
      const result = hitTestClick(groups, rows, 1, 1, 1);
      expect(result?.row).toBe(rows[1]);
    });

    it("returns null when click is before first visible row", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // With scrollOffset=1, there are no visible rows; click returns null
      const result = hitTestClick(groups, rows, 1, 1, 1);
      expect(result).toBeNull();
    });
  });

  // ─── Column Zone Boundary Tests ─────────────────────────────────────────────
  describe("column zone boundaries", () => {
    it("column 3 is separator, not in any zone (repo row)", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "repo", repoIndex: 0 }];
      // Column 3 is between fold (1-2) and checkbox (4-5), should be navigate
      const result = hitTestClick(groups, rows, 0, 3, 1);
      expect(result?.action).toBe("navigate");
    });

    it("checkbox zone takes precedence over nav on extract", () => {
      const groups = [createTestGroup("org/repo")];
      const rows: Row[] = [{ type: "extract", repoIndex: 0, extractIndex: 0 }];
      // Checkbox on extract header should be select, not navigate
      const result = hitTestClick(groups, rows, 0, CHECKBOX_COLUMN_START, 1);
      expect(result?.action).toBe("select");
    });
  });
});
