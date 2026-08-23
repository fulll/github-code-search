import { describe, it, expect } from "bun:test";
import {
  BASE_HEADER_LINES,
  FILTER_BAR_LINES_NORMAL,
  FILTER_BAR_LINES_ACTIVE,
  getHeaderLines,
  FOLD_COLUMN_START,
  FOLD_COLUMN_END,
  CHECKBOX_COLUMN_START,
  CHECKBOX_COLUMN_END,
  NAV_COLUMN_START,
  isClickInFoldZone,
  isClickInCheckboxZone,
  isClickInNavZone,
} from "./layout-constants.ts";

describe("render/layout-constants", () => {
  describe("header lines calculation", () => {
    it("should return base header lines when no filter is active", () => {
      expect(getHeaderLines(false, false)).toBe(BASE_HEADER_LINES);
      expect(getHeaderLines(false, false)).toBe(4);
    });

    it("should add filter bar lines when in normal filter mode", () => {
      expect(getHeaderLines(false, true)).toBe(BASE_HEADER_LINES + FILTER_BAR_LINES_NORMAL);
      expect(getHeaderLines(false, true)).toBe(5);
    });

    it("should add active filter bar lines when in filter input mode", () => {
      expect(getHeaderLines(true, false)).toBe(BASE_HEADER_LINES + FILTER_BAR_LINES_ACTIVE);
      expect(getHeaderLines(true, false)).toBe(6);
    });

    it("should prefer active filter mode over normal when both conditions present", () => {
      // In filter input mode, filterMode=true takes precedence
      expect(getHeaderLines(true, true)).toBe(BASE_HEADER_LINES + FILTER_BAR_LINES_ACTIVE);
      expect(getHeaderLines(true, true)).toBe(6);
    });
  });

  describe("fold zone detection", () => {
    it("should detect fold zone at columns 1-2", () => {
      expect(isClickInFoldZone(1)).toBe(true);
      expect(isClickInFoldZone(2)).toBe(true);
    });

    it("should not detect fold zone outside columns 1-2", () => {
      expect(isClickInFoldZone(0)).toBe(false);
      expect(isClickInFoldZone(3)).toBe(false);
      expect(isClickInFoldZone(4)).toBe(false);
    });
  });

  describe("checkbox zone detection", () => {
    it("should detect checkbox zone at columns 4-5", () => {
      expect(isClickInCheckboxZone(4)).toBe(true);
      expect(isClickInCheckboxZone(5)).toBe(true);
    });

    it("should detect checkbox zone beyond column 5 (full-width double-click)", () => {
      // Checkbox zone now extends from column 4 to infinity (full width from checkbox start)
      expect(isClickInCheckboxZone(6)).toBe(true);
      expect(isClickInCheckboxZone(100)).toBe(true);
    });

    it("should not detect checkbox zone before column 4", () => {
      expect(isClickInCheckboxZone(3)).toBe(false);
    });
  });

  describe("navigation zone detection", () => {
    it("should detect nav zone at column 6 and beyond", () => {
      expect(isClickInNavZone(6)).toBe(true);
      expect(isClickInNavZone(7)).toBe(true);
      expect(isClickInNavZone(100)).toBe(true);
    });

    it("should not detect nav zone before column 6", () => {
      expect(isClickInNavZone(5)).toBe(false);
      expect(isClickInNavZone(1)).toBe(false);
    });
  });

  describe("column constants", () => {
    it("should have non-overlapping zones", () => {
      // Fold and checkbox should not overlap
      expect(FOLD_COLUMN_END).toBeLessThan(CHECKBOX_COLUMN_START);
      // Checkbox and nav should not overlap
      expect(CHECKBOX_COLUMN_END).toBeLessThan(NAV_COLUMN_START);
    });

    it("should have sensible column ranges", () => {
      expect(FOLD_COLUMN_START).toBe(1);
      expect(FOLD_COLUMN_END).toBe(2);
      expect(CHECKBOX_COLUMN_START).toBe(4);
      expect(CHECKBOX_COLUMN_END).toBe(5);
      expect(NAV_COLUMN_START).toBe(6);
    });
  });
});
