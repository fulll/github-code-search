import { describe, expect, it } from "bun:test";
import {
  applyTeamPick,
  flattenTeamSections,
  groupByTeamPrefix,
  moveRepoToSection,
  rebuildTeamSections,
  undoPickedRepo,
  undoSectionPick,
} from "./group.ts";
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
// ─── applyTeamPick ───────────────────────────────────────────────────────────────

describe("applyTeamPick — two-team combined section", () => {
  const sections: TeamSection[] = [
    { label: "squad-frontend", groups: [makeGroup("org/a", ["squad-frontend"])] },
    {
      label: "squad-frontend + squad-mobile",
      groups: [makeGroup("org/shared", ["squad-frontend", "squad-mobile"])],
    },
    { label: "squad-mobile", groups: [makeGroup("org/b", ["squad-mobile"])] },
  ];

  it("assigns repos to chosen team's existing section when it exists", () => {
    const result = applyTeamPick(sections, "squad-frontend + squad-mobile", "squad-frontend");
    const labels = result.map((s) => s.label);
    // Combined section removed
    expect(labels).not.toContain("squad-frontend + squad-mobile");
    // Repos moved into squad-frontend
    const fe = result.find((s) => s.label === "squad-frontend");
    expect(fe?.groups).toHaveLength(2);
    expect(fe?.groups.map((g) => g.repoFullName)).toContain("org/shared");
  });

  it("sets pickedFrom on moved repos with the original combined label", () => {
    const result = applyTeamPick(sections, "squad-frontend + squad-mobile", "squad-frontend");
    const fe = result.find((s) => s.label === "squad-frontend");
    // The repo that was originally in the combined section should have pickedFrom set
    const movedRepo = fe?.groups.find((g) => g.repoFullName === "org/shared");
    expect(movedRepo?.pickedFrom).toBe("squad-frontend + squad-mobile");
    // Repos that were already in squad-frontend should not have pickedFrom set
    const originalRepo = fe?.groups.find((g) => g.repoFullName === "org/a");
    expect(originalRepo?.pickedFrom).toBeUndefined();
  });

  it("creates a new section when chosen team has no existing section", () => {
    const isolated: TeamSection[] = [
      {
        label: "squad-frontend + squad-mobile",
        groups: [makeGroup("org/shared")],
      },
    ];
    const result = applyTeamPick(isolated, "squad-frontend + squad-mobile", "squad-frontend");
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("squad-frontend");
    expect(result[0].groups[0].repoFullName).toBe("org/shared");
  });

  it("returns sections unchanged when combinedLabel is not found", () => {
    const result = applyTeamPick(sections, "squad-ops + squad-mobile", "squad-ops");
    expect(result).toBe(sections);
  });

  it("preserves the order of other sections and inserts new section at the same position", () => {
    const s: TeamSection[] = [
      { label: "squad-a", groups: [makeGroup("org/a")] },
      { label: "squad-a + squad-b", groups: [makeGroup("org/shared")] },
      { label: "squad-c", groups: [makeGroup("org/c")] },
    ];
    // Pick squad-b which has no existing section — new section inserted at index 1
    const result = applyTeamPick(s, "squad-a + squad-b", "squad-b");
    expect(result.map((r) => r.label)).toEqual(["squad-a", "squad-b", "squad-c"]);
  });
});

describe("applyTeamPick — three-team combined section", () => {
  it("resolves a three-team section to a single team", () => {
    const sections: TeamSection[] = [
      {
        label: "squad-a + squad-b + squad-c",
        groups: [makeGroup("org/shared")],
      },
    ];
    const result = applyTeamPick(sections, "squad-a + squad-b + squad-c", "squad-b");
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("squad-b");
  });
});

// ─── rebuildTeamSections ───────────────────────────────────────────────────────────

describe("rebuildTeamSections", () => {
  it("reconstructs sections from a flat RepoGroup[] produced by flattenTeamSections", () => {
    const original: TeamSection[] = [
      { label: "squad-frontend", groups: [makeGroup("org/a"), makeGroup("org/b")] },
      { label: "squad-mobile", groups: [makeGroup("org/c")] },
    ];
    const flat = flattenTeamSections(original);
    const rebuilt = rebuildTeamSections(flat);
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0].label).toBe("squad-frontend");
    expect(rebuilt[0].groups).toHaveLength(2);
    expect(rebuilt[1].label).toBe("squad-mobile");
    expect(rebuilt[1].groups).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(rebuildTeamSections([])).toEqual([]);
  });
});

// ─── moveRepoToSection ────────────────────────────────────────────────────────

function makeSimpleGroup(repo: string, teams: string[] = []): RepoGroup {
  return {
    repoFullName: repo,
    matches: [],
    folded: true,
    repoSelected: true,
    extractSelected: [],
    teams,
  };
}

describe("moveRepoToSection", () => {
  it("moves a repo to an existing target section", () => {
    const sections: TeamSection[] = [
      {
        label: "squad-frontend + squad-mobile",
        groups: [makeSimpleGroup("org/shared", ["squad-frontend", "squad-mobile"])],
      },
      { label: "squad-mobile", groups: [makeSimpleGroup("org/b", ["squad-mobile"])] },
    ];
    const flat = flattenTeamSections(sections);
    const result = moveRepoToSection(flat, "org/shared", "squad-mobile");
    const labels = [...new Set(result.filter((g) => g.sectionLabel).map((g) => g.sectionLabel))];
    expect(labels).not.toContain("squad-frontend + squad-mobile");
    expect(labels).toContain("squad-mobile");
    expect(result.find((g) => g.repoFullName === "org/shared")).toBeDefined();
  });

  it("creates a new section when target team has no existing section", () => {
    const sections: TeamSection[] = [
      { label: "squad-frontend + squad-mobile", groups: [makeSimpleGroup("org/shared")] },
    ];
    const flat = flattenTeamSections(sections);
    const result = moveRepoToSection(flat, "org/shared", "squad-mobile");
    expect(result.find((g) => g.sectionLabel === "squad-mobile")).toBeDefined();
  });

  it("is a no-op when the repo does not exist", () => {
    const sections: TeamSection[] = [
      { label: "squad-frontend", groups: [makeSimpleGroup("org/a")] },
    ];
    const flat = flattenTeamSections(sections);
    const result = moveRepoToSection(flat, "org/nonexistent", "squad-mobile");
    expect(result).toBe(flat);
  });
});

// ─── undoPickedRepo ───────────────────────────────────────────────────────────

function makePicked(
  repo: string,
  pickedFrom: string,
  currentSection: string,
  teams: string[] = [],
): RepoGroup {
  return {
    repoFullName: repo,
    matches: [],
    folded: true,
    repoSelected: true,
    extractSelected: [],
    teams,
    pickedFrom,
    sectionLabel: currentSection,
  };
}

describe("undoPickedRepo", () => {
  it("restores a picked repo back to its original combined section", () => {
    // squad-frontend + squad-mobile was picked to squad-frontend
    const groups: RepoGroup[] = [
      { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
      {
        repoFullName: "org/repoB",
        matches: [],
        folded: true,
        repoSelected: true,
        extractSelected: [],
        teams: [],
        pickedFrom: "squad-frontend + squad-mobile",
      },
    ];
    const result = undoPickedRepo(groups, 0);
    const a = result.find((g) => g.repoFullName === "org/repoA");
    expect(a).toBeDefined();
    expect(a!.pickedFrom).toBeUndefined();
    // Must appear in the restored combined section
    const sectionRow = result.find((g) => g.sectionLabel === "squad-frontend + squad-mobile");
    expect(sectionRow).toBeDefined();
    expect(sectionRow!.repoFullName).toBe("org/repoA");
  });

  it("no-op when repo has no pickedFrom", () => {
    const groups: RepoGroup[] = [
      {
        repoFullName: "org/repoA",
        matches: [],
        folded: true,
        repoSelected: true,
        extractSelected: [],
        teams: [],
      },
    ];
    const result = undoPickedRepo(groups, 0);
    expect(result).toBe(groups); // same reference — no change
  });

  it("drops the current section when it becomes empty after undo", () => {
    const groups: RepoGroup[] = [
      { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
    ];
    const result = undoPickedRepo(groups, 0);
    // squad-frontend section should be gone (it had only repoA)
    const frontendSection = result.find((g) => g.sectionLabel === "squad-frontend");
    expect(frontendSection).toBeUndefined();
    // Combined section should exist
    const combinedSection = result.find((g) => g.sectionLabel === "squad-frontend + squad-mobile");
    expect(combinedSection).toBeDefined();
  });

  it("appends to the existing combined section if it already exists", () => {
    // repoA was picked to squad-frontend, but the combined section still has repoC
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [{ ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") }],
      },
      {
        label: "squad-frontend + squad-mobile",
        groups: [
          {
            repoFullName: "org/repoC",
            matches: [],
            folded: true,
            repoSelected: true,
            extractSelected: [],
            teams: ["squad-frontend", "squad-mobile"],
          },
        ],
      },
    ];
    const flat = flattenTeamSections(sections);
    const repoAIndex = flat.findIndex((g) => g.repoFullName === "org/repoA");
    const result = undoPickedRepo(flat, repoAIndex);
    const combinedGroups = (() => {
      let inCombined = false;
      const repos: string[] = [];
      for (const g of result) {
        if (g.sectionLabel === "squad-frontend + squad-mobile") inCombined = true;
        else if (g.sectionLabel !== undefined) inCombined = false;
        if (inCombined) repos.push(g.repoFullName);
      }
      return repos;
    })();
    expect(combinedGroups).toContain("org/repoA");
    expect(combinedGroups).toContain("org/repoC");
  });

  it("inserts new combined section before 'other' when other exists", () => {
    // repoA was picked to squad-frontend; repoB lives in "other"
    // After undo, the new combined section must appear before "other"
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [
          { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
        ],
      },
      {
        label: "other",
        groups: [
          {
            repoFullName: "org/repoB",
            matches: [],
            folded: true,
            repoSelected: true,
            extractSelected: [],
            teams: [],
          },
        ],
      },
    ];
    const flat = flattenTeamSections(sections);
    const repoAIndex = flat.findIndex((g) => g.repoFullName === "org/repoA");
    const result = undoPickedRepo(flat, repoAIndex);
    const sectionLabels = result
      .filter((g) => g.sectionLabel !== undefined)
      .map((g) => g.sectionLabel);
    const combinedIdx = sectionLabels.indexOf("squad-frontend + squad-mobile");
    const otherIdx = sectionLabels.indexOf("other");
    expect(combinedIdx).not.toBe(-1);
    expect(otherIdx).not.toBe(-1);
    // Combined section must come before "other"
    expect(combinedIdx).toBeLessThan(otherIdx);
  });
});

// ─── moveRepoToSection ────────────────────────────────────────────────────────

describe("moveRepoToSection — insert before other", () => {
  it("inserts new target section before 'other' when other exists", () => {
    // repoA (picked from combined) is moved to a new team section that doesn't exist yet
    // "other" section is present — new section must appear before it
    const sections: TeamSection[] = [
      {
        label: "squad-frontend + squad-mobile",
        groups: [
          {
            ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend + squad-mobile"),
            pickedFrom: undefined,
          },
        ],
      },
      {
        label: "other",
        groups: [
          {
            repoFullName: "org/repoB",
            matches: [],
            folded: true,
            repoSelected: true,
            extractSelected: [],
            teams: [],
          },
        ],
      },
    ];
    // Manually set pickedFrom so move is realistic
    const flat = flattenTeamSections(sections).map((g) =>
      g.repoFullName === "org/repoA" ? { ...g, pickedFrom: "squad-frontend + squad-mobile" } : g,
    );
    const result = moveRepoToSection(flat, "org/repoA", "squad-mobile");
    const sectionLabels = result
      .filter((g) => g.sectionLabel !== undefined)
      .map((g) => g.sectionLabel);
    const mobileIdx = sectionLabels.indexOf("squad-mobile");
    const otherIdx = sectionLabels.indexOf("other");
    expect(mobileIdx).not.toBe(-1);
    expect(otherIdx).not.toBe(-1);
    // New squad-mobile section must come before "other"
    expect(mobileIdx).toBeLessThan(otherIdx);
  });
});

// ─── undoSectionPick ──────────────────────────────────────────────────────────

describe("undoSectionPick", () => {
  it("no-op when no repos have the matching pickedFrom", () => {
    const groups: RepoGroup[] = [
      {
        repoFullName: "org/repoA",
        matches: [],
        folded: true,
        repoSelected: true,
        extractSelected: [],
        teams: [],
      },
    ];
    const result = undoSectionPick(groups, "squad-frontend + squad-mobile");
    expect(result).toBe(groups); // same reference — no change
  });

  it("restores all repos with matching pickedFrom to the combined section", () => {
    // Two repos were both picked to different teams from the same combined section
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [
          { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
        ],
      },
      {
        label: "squad-mobile",
        groups: [
          { ...makePicked("org/repoB", "squad-frontend + squad-mobile", "squad-mobile") },
        ],
      },
    ];
    const flat = flattenTeamSections(sections);
    const result = undoSectionPick(flat, "squad-frontend + squad-mobile");

    // Both repos should appear in the restored combined section
    const combinedSection = result.find((g) => g.sectionLabel === "squad-frontend + squad-mobile");
    expect(combinedSection).toBeDefined();
    const inCombined = (() => {
      let collecting = false;
      const repos: string[] = [];
      for (const g of result) {
        if (g.sectionLabel === "squad-frontend + squad-mobile") collecting = true;
        else if (g.sectionLabel !== undefined) collecting = false;
        if (collecting) repos.push(g.repoFullName);
      }
      return repos;
    })();
    expect(inCombined).toContain("org/repoA");
    expect(inCombined).toContain("org/repoB");
    // pickedFrom must be stripped
    for (const g of result) {
      expect(g.pickedFrom).toBeUndefined();
    }
    // Source sections should be gone (empty after restore)
    expect(result.find((g) => g.sectionLabel === "squad-frontend")).toBeUndefined();
    expect(result.find((g) => g.sectionLabel === "squad-mobile")).toBeUndefined();
  });

  it("inserts restored combined section before 'other'", () => {
    // repoA was picked from combined to squad-frontend; repoB is in "other"
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [
          { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
        ],
      },
      {
        label: "other",
        groups: [
          {
            repoFullName: "org/repoB",
            matches: [],
            folded: true,
            repoSelected: true,
            extractSelected: [],
            teams: [],
          },
        ],
      },
    ];
    const flat = flattenTeamSections(sections);
    const result = undoSectionPick(flat, "squad-frontend + squad-mobile");
    const sectionLabels = result
      .filter((g) => g.sectionLabel !== undefined)
      .map((g) => g.sectionLabel);
    const combinedIdx = sectionLabels.indexOf("squad-frontend + squad-mobile");
    const otherIdx = sectionLabels.indexOf("other");
    expect(combinedIdx).not.toBe(-1);
    expect(otherIdx).not.toBe(-1);
    expect(combinedIdx).toBeLessThan(otherIdx);
  });

  it("appends to existing combined section when it still has other repos", () => {
    // repoA was picked to squad-frontend, but repoC still lives in the combined section
    const sections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [
          { ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") },
        ],
      },
      {
        label: "squad-frontend + squad-mobile",
        groups: [
          {
            repoFullName: "org/repoC",
            matches: [],
            folded: true,
            repoSelected: true,
            extractSelected: [],
            teams: ["squad-frontend", "squad-mobile"],
          },
        ],
      },
    ];
    const flat = flattenTeamSections(sections);
    const result = undoSectionPick(flat, "squad-frontend + squad-mobile");
    const inCombined = (() => {
      let collecting = false;
      const repos: string[] = [];
      for (const g of result) {
        if (g.sectionLabel === "squad-frontend + squad-mobile") collecting = true;
        else if (g.sectionLabel !== undefined) collecting = false;
        if (collecting) repos.push(g.repoFullName);
      }
      return repos;
    })();
    expect(inCombined).toContain("org/repoA");
    expect(inCombined).toContain("org/repoC");
  });
});
