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
