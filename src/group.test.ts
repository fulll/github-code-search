import { describe, expect, it } from "bun:test";
import { flattenTeamSections, groupByTeamPrefix } from "./group.ts";
import type { RepoGroup, TeamSection } from "./types.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGroup(repo: string, teams: string[] = []): RepoGroup {
  return {
    repoFullName: repo,
    matches: [],
    folded: true,
    repoSelected: true,
    extractSelected: [],
    teams,
  };
}

// ─── groupByTeamPrefix ────────────────────────────────────────────────────────

describe("groupByTeamPrefix — basic single prefix", () => {
  it("puts repos with one matching team each in individual sections", () => {
    const groups = [makeGroup("org/a", ["squad-frontend"]), makeGroup("org/b", ["squad-mobile"])];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    expect(sections).toHaveLength(2);
    const labels = sections.map((s) => s.label);
    expect(labels).toContain("squad-frontend");
    expect(labels).toContain("squad-mobile");
  });

  it("repos with no matching team go to 'other'", () => {
    const groups = [
      makeGroup("org/a", ["squad-frontend"]),
      makeGroup("org/b", ["chapter-backend"]),
    ];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    expect(sections).toHaveLength(2);
    const other = sections.find((s) => s.label === "other");
    expect(other).toBeDefined();
    expect(other!.groups[0].repoFullName).toBe("org/b");
  });

  it("returns empty array for no groups", () => {
    expect(groupByTeamPrefix([], ["squad-"])).toEqual([]);
  });

  it("returns 'other' section when prefix matches nothing", () => {
    const groups = [makeGroup("org/a", ["chapter-backend"])];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("other");
  });
});

describe("groupByTeamPrefix — multi-team repos", () => {
  it("repos with 1 matching team come before repos with 2 matching teams", () => {
    const groups = [
      makeGroup("org/both", ["squad-frontend", "squad-mobile"]),
      makeGroup("org/front-only", ["squad-frontend"]),
    ];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    // squad-frontend (1 match) must appear before squad-frontend + squad-mobile (2 matches)
    const labels = sections.map((s) => s.label);
    const singleIdx = labels.indexOf("squad-frontend");
    const pairIdx = labels.indexOf("squad-frontend + squad-mobile");
    expect(singleIdx).toBeGreaterThanOrEqual(0);
    expect(pairIdx).toBeGreaterThanOrEqual(0);
    expect(singleIdx).toBeLessThan(pairIdx);
  });

  it("section label for two matching teams is alphabetically joined with ' + '", () => {
    const groups = [makeGroup("org/r", ["squad-mobile", "squad-frontend"])];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    expect(sections[0].label).toBe("squad-frontend + squad-mobile");
  });

  it("repos sharing the same team combination are in the same section", () => {
    const groups = [
      makeGroup("org/a", ["squad-frontend", "squad-mobile"]),
      makeGroup("org/b", ["squad-mobile", "squad-frontend"]),
    ];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    expect(sections).toHaveLength(1);
    expect(sections[0].groups).toHaveLength(2);
  });
});

describe("groupByTeamPrefix — multiple prefixes", () => {
  it("processes prefixes in order; repos matched by first prefix don't appear under second", () => {
    const groups = [
      makeGroup("org/squad-a", ["squad-frontend"]),
      makeGroup("org/chapter-a", ["chapter-backend"]),
    ];
    const sections = groupByTeamPrefix(groups, ["squad-", "chapter-"]);

    const labels = sections.map((s) => s.label);
    expect(labels).toContain("squad-frontend");
    expect(labels).toContain("chapter-backend");
    // squad-frontend section must come before chapter-backend section
    expect(labels.indexOf("squad-frontend")).toBeLessThan(labels.indexOf("chapter-backend"));
  });

  it("repo matching both prefixes is assigned to the FIRST matching prefix only", () => {
    const groups = [makeGroup("org/r", ["squad-frontend", "chapter-backend"])];
    const sections = groupByTeamPrefix(groups, ["squad-", "chapter-"]);
    // Should be one section under squad-frontend only
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("squad-frontend");
  });

  it("full scenario: 1-squad, 2-squad, 1-chapter repos + other", () => {
    const groups = [
      makeGroup("org/a", ["squad-front"]),
      makeGroup("org/b", ["squad-back"]),
      makeGroup("org/c", ["squad-front", "squad-back"]),
      makeGroup("org/d", ["chapter-x"]),
      makeGroup("org/e", []), // no team
    ];
    const sections = groupByTeamPrefix(groups, ["squad-", "chapter-"]);
    const labels = sections.map((s) => s.label);

    // Single-squad sections come first (squad-back, squad-front — alphabetical)
    expect(labels[0]).toBe("squad-back");
    expect(labels[1]).toBe("squad-front");
    // Then the combined section
    expect(labels[2]).toBe("squad-back + squad-front");
    // Then the chapter section
    expect(labels[3]).toBe("chapter-x");
    // Then other
    expect(labels[4]).toBe("other");
  });

  it("sections within same count bucket are sorted alphabetically by label", () => {
    const groups = [makeGroup("org/z", ["squad-z"]), makeGroup("org/a", ["squad-a"])];
    const sections = groupByTeamPrefix(groups, ["squad-"]);
    const labels = sections.map((s) => s.label);
    expect(labels).toEqual(["squad-a", "squad-z"]);
  });
});

// ─── flattenTeamSections ──────────────────────────────────────────────────────

describe("flattenTeamSections", () => {
  it("marks first repo of each section with sectionLabel", () => {
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [makeGroup("org/a"), makeGroup("org/b")],
      },
      { label: "squad-mobile", groups: [makeGroup("org/c")] },
    ];
    const flat = flattenTeamSections(sections);
    expect(flat).toHaveLength(3);
    expect(flat[0].sectionLabel).toBe("squad-frontend");
    expect(flat[1].sectionLabel).toBeUndefined();
    expect(flat[2].sectionLabel).toBe("squad-mobile");
  });

  it("does not mutate original group objects", () => {
    const g = makeGroup("org/a");
    const sections: TeamSection[] = [{ label: "squad-x", groups: [g] }];
    flattenTeamSections(sections);
    expect((g as RepoGroup).sectionLabel).toBeUndefined();
  });

  it("removes pre-existing sectionLabel from non-first entries", () => {
    const g1 = { ...makeGroup("org/a"), sectionLabel: "old" };
    const g2 = { ...makeGroup("org/b"), sectionLabel: "old" };
    const sections: TeamSection[] = [{ label: "squad-x", groups: [g1, g2] }];
    const flat = flattenTeamSections(sections);
    expect(flat[0].sectionLabel).toBe("squad-x");
    expect(flat[1].sectionLabel).toBeUndefined();
  });

  it("returns empty array for empty sections", () => {
    expect(flattenTeamSections([])).toEqual([]);
  });
});
