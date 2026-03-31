import { describe, expect, it } from "bun:test";
import { renderTeamPickHeader } from "./team-pick.ts";

// Strip ANSI escape codes for snapshot comparison.
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// ─── renderTeamPickHeader ─────────────────────────────────────────────────────

describe("renderTeamPickHeader — focused team rendering", () => {
  it("renders the focused team with [ ] brackets", () => {
    const result = strip(renderTeamPickHeader(["squad-frontend", "squad-mobile"], 0));
    expect(result).toContain("[ squad-frontend ]");
  });

  it("non-focused teams appear without brackets", () => {
    const result = strip(renderTeamPickHeader(["squad-frontend", "squad-mobile"], 0));
    expect(result).toContain("squad-mobile");
    expect(result).not.toMatch(/\[\s*squad-mobile\s*\]/);
  });

  it("focusedIndex 1 highlights the second team", () => {
    const result = strip(renderTeamPickHeader(["squad-frontend", "squad-mobile"], 1));
    expect(result).toContain("[ squad-mobile ]");
    expect(result).not.toMatch(/\[\s*squad-frontend\s*\]/);
  });

  it("works with three candidate teams", () => {
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b", "squad-c"], 1));
    expect(result).toContain("[ squad-b ]");
    expect(result).toContain("squad-a");
    expect(result).toContain("squad-c");
  });

  it("emits ANSI codes (picocolors active due to FORCE_COLOR=1 in test-setup)", () => {
    const result = renderTeamPickHeader(["squad-frontend", "squad-mobile"], 0);
    // Focused team should have bold/colour codes; non-focused should have dim codes
    expect(result).toMatch(/\x1b\[/);
  });

  it("returns the focused team surrounded by brackets when only one candidate", () => {
    const result = strip(renderTeamPickHeader(["squad-only"], 0));
    expect(result).toBe("[ squad-only ]");
  });
});

describe("renderTeamPickHeader — maxWidth clipping", () => {
  it("returns the full bar when maxWidth is undefined", () => {
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b"], 0));
    expect(result).toBe("[ squad-a ]  squad-b");
  });

  it("returns the full bar when it fits within maxWidth", () => {
    // "[ squad-a ]  squad-b" = 20 visible chars
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b"], 0, 20));
    expect(result).toBe("[ squad-a ]  squad-b");
  });

  it("clips and appends … when focused=0 and bar exceeds maxWidth", () => {
    // "[ squad-a ]" = 11 chars; "  squad-b" = 9 more = 20 total; limit to 15
    // Window=[0,0]: items(11) + right-ellipsis(3) = 14 ≤ 15 → show "[ squad-a ]  …"
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b"], 0, 15));
    expect(result).toContain("[ squad-a ]");
    expect(result).toContain("…");
    expect(result).not.toContain("squad-b");
  });

  it("omits … when even the ellipsis does not fit (maxWidth=0)", () => {
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b"], 0, 0));
    expect(result).not.toContain("…");
    expect(result).toBe("");
  });

  it("clips three candidates to two + ellipsis when focused=0", () => {
    // "[ squad-a ]" = 11, "  squad-b" = 9 → 20; "  …" = 3 → need ≥ 23
    // With maxWidth=23: squad-a + squad-b (20) + right-ellipsis (3) = 23 ✓; squad-c hidden
    const result = strip(renderTeamPickHeader(["squad-a", "squad-b", "squad-c"], 0, 23));
    expect(result).toContain("[ squad-a ]");
    expect(result).toContain("squad-b");
    expect(result).toContain("…");
    expect(result).not.toContain("squad-c");
  });
});

// ─── renderTeamPickHeader — windowed scrolling (focused always visible) ────────

describe("renderTeamPickHeader — windowed scrolling", () => {
  it("shows left ellipsis when focused is not the first candidate", () => {
    // candidates=["A","B","C"], focused=2, maxWidth=10
    // "[ C ]"=5; window=[2,2]: items(5)+left(3)+right(0)=8 ≤ 10 ✓
    // Try expand left to 1: items(5+2+1=8)+left(3)=11 > 10 ✗ → A not included
    // Result: "…  [ C ]" (8 chars)
    const result = strip(renderTeamPickHeader(["A", "B", "C"], 2, 10));
    expect(result).toContain("[ C ]");
    expect(result.startsWith("…")).toBe(true); // left ellipsis
    expect(result).not.toContain("  A"); // A hidden on left
  });

  it("shows both ellipses when focused is in the middle and candidates overflow both sides", () => {
    // 5 equal-width candidates ("tm1"–"tm5", each 3 chars); focused=2; maxWidth=16
    // "[ tm3 ]"=7; + right(3)=10; + left(3)=13; expand right: 7+SEP+3=12 → 12+3+3=18>16
    // window=[2,2]; totalWidth=7+3+3=13 ≤ 16; both ellipses shown → "…  [ tm3 ]  …" (13 chars)
    const result = strip(renderTeamPickHeader(["tm1", "tm2", "tm3", "tm4", "tm5"], 2, 16));
    expect(result).toContain("[ tm3 ]");
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("tm1");
    expect(result).not.toContain("tm5");
  });

  it("focused team is always visible regardless of focusedIndex", () => {
    const teams = ["squad-a", "squad-b", "squad-c", "squad-d", "squad-e"];
    // Use a narrow maxWidth so not all teams fit at once
    const maxWidth = 22;
    for (let i = 0; i < teams.length; i++) {
      const result = strip(renderTeamPickHeader(teams, i, maxWidth));
      expect(result).toContain(`[ ${teams[i]} ]`);
      expect(result.length).toBeLessThanOrEqual(maxWidth);
    }
  });

  it("window shifts rightward as focusedIndex increases", () => {
    const teams = ["A", "B", "C", "D", "E"]; // 1 char each
    // "[ X ]"=5 chars; with maxWidth=10: items(5)+right(3)=8 OR left(3)+items(5)=8
    // Window holds 1 item at a time with ellipses
    const result0 = strip(renderTeamPickHeader(teams, 0, 10));
    const result4 = strip(renderTeamPickHeader(teams, 4, 10));
    // First focused: no left ellipsis
    expect(result0.startsWith("…")).toBe(false);
    expect(result0).toContain("[ A ]");
    // Last focused: no right ellipsis
    expect(result4.endsWith("…")).toBe(false);
    expect(result4).toContain("[ E ]");
  });

  it("shows the focused item clipped when it alone exceeds maxWidth", () => {
    // "[ very-long-team-name ]" = 23 chars > maxWidth=10 → clip
    const result = strip(renderTeamPickHeader(["very-long-team-name"], 0, 10));
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith("…")).toBe(true);
  });

  it("expands to fill available space symmetrically around focused", () => {
    // 5 teams of 3 chars each; focused=2 (middle)
    const teams = ["tm1", "tm2", "tm3", "tm4", "tm5"];
    // maxWidth=30: "…  tm2  [ tm3 ]  tm4  …" = 3+3+2+7+2+3+3=23 ≤ 30 → add tm1 on left
    // Let's use a width where all 5 fit: widths=[3,3,7,3,3], SEP between=(4*2)=8, total=19
    const result = strip(renderTeamPickHeader(teams, 2, 30));
    expect(result).toContain("tm1");
    expect(result).toContain("tm2");
    expect(result).toContain("[ tm3 ]");
    expect(result).toContain("tm4");
    expect(result).toContain("tm5");
    expect(result).not.toContain("…"); // all teams fit → no ellipsis
  });
});
