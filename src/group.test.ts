import { describe, expect, it } from "bun:test";
import {
  applyTeamPick,
  applyTeamPickInTree,
  autoPickTeamsByCommonPrefix,
  excludeTeamsByPrefix,
  findCombinedSectionPaths,
  flattenTeamHierarchy,
  flattenTeamSections,
  groupByTeamHierarchy,
  groupByTeamPrefix,
  moveRepoToSection,
  moveRepoToSectionInTree,
  rebuildTeamHierarchy,
  rebuildTeamSections,
  parseTeamPrefixChains,
  resolvePickTeamAssignment,
  undoPickedRepo,
  undoPickedRepoInTree,
  undoSectionPick,
  undoSectionPickInTree,
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

// ─── excludeTeamsByPrefix ─────────────────────────────────────────────────────

describe("excludeTeamsByPrefix", () => {
  it("removes teams matching an excluded prefix, keeps the rest", () => {
    const groups = [makeGroup("org/a", ["chapter-secops", "chapter-validators-core"])];
    const result = excludeTeamsByPrefix(groups, ["chapter-validators-"]);
    expect(result[0].teams).toEqual(["chapter-secops"]);
  });

  it("supports multiple exclude prefixes", () => {
    const groups = [
      makeGroup("org/a", ["chapter-secops", "chapter-validators-core", "chapter-architect-a"]),
    ];
    const result = excludeTeamsByPrefix(groups, ["chapter-validators-", "chapter-architect-"]);
    expect(result[0].teams).toEqual(["chapter-secops"]);
  });

  it("leaves teams unchanged when no team matches any exclude prefix", () => {
    const groups = [makeGroup("org/a", ["chapter-secops"])];
    const result = excludeTeamsByPrefix(groups, ["chapter-validators-"]);
    expect(result[0].teams).toEqual(["chapter-secops"]);
  });

  it("returns a repo with an empty teams array when every team is excluded", () => {
    const groups = [makeGroup("org/a", ["chapter-validators-core", "chapter-validators-client"])];
    const result = excludeTeamsByPrefix(groups, ["chapter-validators-"]);
    expect(result[0].teams).toEqual([]);
  });

  it("is a no-op (same reference) when excludePrefixes is empty", () => {
    const groups = [makeGroup("org/a", ["chapter-secops"])];
    expect(excludeTeamsByPrefix(groups, [])).toBe(groups);
  });

  it("does not mutate the input groups or their teams array", () => {
    const groups = [makeGroup("org/a", ["chapter-secops", "chapter-validators-core"])];
    const before = JSON.stringify(groups);
    excludeTeamsByPrefix(groups, ["chapter-validators-"]);
    expect(JSON.stringify(groups)).toBe(before);
  });

  it("reduces a combined section to a single-team section once ambiguity is removed", () => {
    const groups = [
      makeGroup("org/a", ["chapter-secops", "chapter-validators-core"]),
      makeGroup("org/b", ["chapter-secops"]),
    ];
    const filtered = excludeTeamsByPrefix(groups, ["chapter-validators-"]);
    const sections = groupByTeamPrefix(filtered, ["chapter-"]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("chapter-secops");
    expect(sections[0].groups.map((g) => g.repoFullName).toSorted()).toEqual(["org/a", "org/b"]);
  });
});

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

  it("fix (#issue: chapter-architect mega-combo): drops redundant sub-teams from a matching-team set before forming the combo label", () => {
    // Reported behaviour: a repo tagged with a broad team (chapter-architect)
    // AND several of its own narrower variants (chapter-architect-a,
    // chapter-architect-b, ...) used to form an unwieldy N-way combined
    // section listing every variant. Since the broader team already implies
    // membership in each narrower one for grouping purposes, the narrower
    // ones are now dropped from the matching set, leaving only the genuinely
    // unrelated team (chapter-head-of-frontend) alongside the broad one.
    const groups = [
      makeGroup("org/a", [
        "chapter-architect",
        "chapter-architect-a",
        "chapter-architect-b",
        "chapter-architect-c",
        "chapter-architect-d",
        "chapter-architect-mobile",
        "chapter-architect-nodejs",
        "chapter-architect-php",
        "chapter-architect-python",
        "chapter-head-of-frontend",
      ]),
    ];
    const sections = groupByTeamPrefix(groups, ["chapter-"]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("chapter-architect + chapter-head-of-frontend");
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

// ─── groupByTeamHierarchy ─────────────────────────────────────────────────────

describe("groupByTeamHierarchy — single-level chain (parity with groupByTeamPrefix)", () => {
  it("behaves like groupByTeamPrefix for a single 1-level chain", () => {
    const groups = [makeGroup("org/a", ["squad-frontend"]), makeGroup("org/b", ["squad-mobile"])];
    const sections = groupByTeamHierarchy(groups, [["squad-"]]);
    const labels = sections.map((s) => s.label);
    expect(labels).toContain("squad-frontend");
    expect(labels).toContain("squad-mobile");
    expect(sections.every((s) => (s.level ?? 0) === 0)).toBe(true);
  });

  it("returns empty array for no groups and no chains", () => {
    expect(groupByTeamHierarchy([], [])).toEqual([]);
  });

  it("repos matching no chain at all go to a top-level 'other'", () => {
    const groups = [makeGroup("org/a", ["squad-frontend"]), makeGroup("org/b", ["chapter-x"])];
    const sections = groupByTeamHierarchy(groups, [["squad-"]]);
    const other = sections.find((s) => s.label === "other");
    expect(other).toBeDefined();
    expect(other!.level).toBe(0);
    expect(other!.groups[0].repoFullName).toBe("org/b");
  });
});

describe("groupByTeamHierarchy — 2-level chain", () => {
  it("groups by the first prefix, then sub-groups each section by the second", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["tribe-a", "squad-b"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("tribe-a");
    expect(sections[0].level).toBe(0);
    expect(sections[0].groups).toEqual([]); // subdivided, not a leaf
    const childLabels = (sections[0].children ?? []).map((c) => c.label).toSorted();
    expect(childLabels).toEqual(["squad-a", "squad-b"]);
    for (const child of sections[0].children ?? []) {
      expect(child.level).toBe(1);
    }
  });

  it("repos with no match at the second level fall into a nested 'other'", () => {
    const groups = [makeGroup("org/a", ["tribe-a"])]; // no squad- team
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const child = sections[0].children ?? [];
    expect(child.map((c) => c.label)).toEqual(["other"]);
    expect(child[0].level).toBe(1);
    expect(child[0].groups[0].repoFullName).toBe("org/a");
  });

  it("supports a 3-level chain recursively", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "chapter-fe"])];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-", "chapter-"]]);
    const l1 = sections[0];
    const l2 = l1.children![0];
    const l3 = l2.children![0];
    expect(l1.label).toBe("tribe-a");
    expect(l2.label).toBe("squad-a");
    expect(l3.label).toBe("chapter-fe");
    expect([l1.level, l2.level, l3.level]).toEqual([0, 1, 2]);
    expect(l3.groups.map((g) => g.repoFullName)).toEqual(["org/a"]);
  });
});

describe("groupByTeamHierarchy — multiple independent chains", () => {
  it("processes each chain sequentially against the remaining pool", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["chapter-backend"]),
      makeGroup("org/c", []),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["chapter-"]]);
    const labels = sections.map((s) => s.label);
    expect(labels).toEqual(["tribe-a", "chapter-backend", "other"]);
    expect(sections[2].groups[0].repoFullName).toBe("org/c");
  });

  it("fix (#issue: tribe-/squad-,chapter- precedence): a repo matching ONLY a 2nd-level prefix (squad-) is claimed by that level as a fallback, not left invisible to the chain", () => {
    // Reported behaviour: `fulll/demat-workers` (team squad-c, no tribe-
    // team) used to end up under a `chapter-` combined section instead of
    // under `tribe-/squad-` as its `--group-by-team-prefix
    // tribe-/squad-,chapter-` position would suggest — chain[0] (tribe-) was
    // a hard requirement before squad- was even tried. Every level of a
    // chain is now tried in order against what earlier levels of *that same
    // chain* haven't claimed, so a squad--only repo is captured directly by
    // that chain instead of falling through to a later chain or "other".
    const groups = [
      makeGroup("org/demat-workers", [
        "squad-c",
        "chapter-validators-client",
        "chapter-validators-core",
      ]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["chapter-"]]);
    const squadC = sections.find((s) => s.label === "squad-c");
    expect(squadC).toBeDefined();
    expect(squadC!.level).toBe(0);
    expect(squadC!.groups.map((g) => g.repoFullName)).toEqual(["org/demat-workers"]);
    expect(sections.map((s) => s.label)).not.toContain("other");
    expect(sections.some((s) => s.label.includes("chapter-validators"))).toBe(false);
  });
});

describe("groupByTeamHierarchy — combining overlapping team names", () => {
  it("combines a longer team name with a shorter one that is its prefix into one section", () => {
    const groups = [makeGroup("org/a", ["tribe-a"]), makeGroup("org/b", ["tribe-a-p1"])];
    const sections = groupByTeamHierarchy(groups, [["tribe-"]]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("tribe-a + tribe-a-p1");
    expect(sections[0].level).toBe(0);
    expect(sections[0].children).toBeUndefined();
    expect(sections[0].groups.map((g) => g.repoFullName).toSorted()).toEqual(["org/a", "org/b"]);
  });

  it("combines a cascading chain of 3 overlapping names into one section", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a"]),
      makeGroup("org/b", ["tribe-a-p1"]),
      makeGroup("org/c", ["tribe-a-p1-x"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-"]]);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("tribe-a + tribe-a-p1 + tribe-a-p1-x");
    expect(sections[0].groups.map((g) => g.repoFullName).toSorted()).toEqual([
      "org/a",
      "org/b",
      "org/c",
    ]);
  });

  it("does not combine unrelated single-team labels", () => {
    const groups = [makeGroup("org/a", ["squad-front"]), makeGroup("org/b", ["squad-back"])];
    const sections = groupByTeamHierarchy(groups, [["squad-"]]);
    const labels = sections.map((s) => s.label);
    expect(labels).toContain("squad-front");
    expect(labels).toContain("squad-back");
  });

  it("does not combine already-combined ('a + b') or 'other' sections into the overlap cluster", () => {
    const groups = [makeGroup("org/a", ["squad-front", "squad-back"]), makeGroup("org/b", [])];
    const sections = groupByTeamHierarchy(groups, [["squad-"]]);
    const combined = sections.find((s) => s.label === "squad-back + squad-front");
    expect(combined).toBeDefined();
    const other = sections.find((s) => s.label === "other");
    expect(other).toBeDefined();
  });

  it("omits the children field entirely on leaf sections instead of an empty array", () => {
    const groups = [makeGroup("org/a", ["squad-front"])];
    const sections = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(sections[0].children).toBeUndefined();
  });

  it("splits a combined overlap section by the next chain level", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a"]),
      makeGroup("org/b", ["tribe-a-p1", "squad-mobile"]),
      makeGroup("org/c", ["tribe-a", "squad-b"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    expect(sections).toHaveLength(1);
    const parent = sections[0];
    expect(parent.label).toBe("tribe-a + tribe-a-p1");
    // Fully subdivided by the squad- level — none of its own repos are left flat.
    expect(parent.groups).toEqual([]);
    const childLabels = (parent.children ?? []).map((c) => c.label).toSorted();
    expect(childLabels).toEqual(["other", "squad-b", "squad-mobile"]);
    const squadB = parent.children!.find((c) => c.label === "squad-b")!;
    expect(squadB.groups.map((g) => g.repoFullName)).toEqual(["org/c"]);
    const squadMobile = parent.children!.find((c) => c.label === "squad-mobile")!;
    expect(squadMobile.groups.map((g) => g.repoFullName)).toEqual(["org/b"]);
    const other = parent.children!.find((c) => c.label === "other")!;
    expect(other.groups.map((g) => g.repoFullName)).toEqual(["org/a"]);
  });

  it("fix (#issue: tribe-/squad- + overlapping name): combining no longer inserts an EXTRA heading level beyond the declared chain depth", () => {
    // Reported behaviour: `--group-by-team-prefix tribe-/squad-` (a 2-level
    // chain) used to render 3 heading levels — `tribe-a` /
    // `tribe-a-security-p1` / `squad-d` — instead of the 2 the chain
    // declares. Overlapping single-team labels are now combined into one
    // section instead of nested, so the chain's own `/squad-` depth is the
    // only extra level that can appear.
    const groups = [
      makeGroup("org/parent-only", ["tribe-a"]),
      makeGroup("org/leaf", ["tribe-a-security-p1", "squad-d"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("tribe-a + tribe-a-security-p1");
    expect(tree[0].level).toBe(0);
    const childLabels = (tree[0].children ?? []).map((c) => c.label).toSorted();
    expect(childLabels).toEqual(["other", "squad-d"]);
    const squadD = tree[0].children!.find((c) => c.label === "squad-d")!;
    expect(squadD.level).toBe(1);
    expect(squadD.groups.map((g) => g.repoFullName)).toEqual(["org/leaf"]);
    const other = tree[0].children!.find((c) => c.label === "other")!;
    expect(other.groups.map((g) => g.repoFullName)).toEqual(["org/parent-only"]);
  });

  it("fix (#issue: tribe-/squad- + overlapping name): --pick-team-auto fully resolves the combined section to a single heading", () => {
    // End-to-end confirmation: combining (this describe block) plus
    // --pick-team-auto together produce exactly "## tribe-a", with no
    // "## tribe-a-security-p1" heading at any level, as requested.
    const groups = [
      makeGroup("org/parent-only", ["tribe-a"]),
      makeGroup("org/leaf", ["tribe-a-security-p1", "squad-d"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].label).toBe("tribe-a");
    expect(findCombinedSectionPaths(resolved)).toEqual([]);
  });
});

// ─── flattenTeamHierarchy ─────────────────────────────────────────────────────

describe("flattenTeamHierarchy", () => {
  it("tags the first repo of a 2-level leaf with both ancestor headings", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["tribe-a", "squad-a"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const flat = flattenTeamHierarchy(sections);
    expect(flat).toHaveLength(2);
    expect(flat[0].sectionPath).toEqual([
      { label: "tribe-a", level: 0 },
      { label: "squad-a", level: 1 },
    ]);
    expect(flat[1].sectionPath).toBeUndefined();
  });

  it("does not repeat an unchanged ancestor heading for a sibling leaf", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["tribe-a", "squad-b"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const flat = flattenTeamHierarchy(sections);
    // First leaf (alphabetically squad-a comes first) gets both headings
    expect(flat[0].sectionPath).toEqual([
      { label: "tribe-a", level: 0 },
      { label: "squad-a", level: 1 },
    ]);
    // Second leaf shares the "tribe-a" ancestor — only the new heading is listed
    expect(flat[1].sectionPath).toEqual([{ label: "squad-b", level: 1 }]);
  });

  it("emits a full new path when moving to an unrelated top-level chain", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["chapter-backend"]),
    ];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["chapter-"]]);
    const flat = flattenTeamHierarchy(sections);
    expect(flat[1].sectionPath).toEqual([{ label: "chapter-backend", level: 0 }]);
  });

  it("flattens a combined overlap section as a single heading for both constituent repos", () => {
    // "tribe-a" and "tribe-a-p1" are combined into one "tribe-a + tribe-a-p1"
    // section (see combining tests) — both repos share that single heading.
    const groups = [makeGroup("org/a", ["tribe-a"]), makeGroup("org/b", ["tribe-a-p1"])];
    const sections = groupByTeamHierarchy(groups, [["tribe-"]]);
    const flat = flattenTeamHierarchy(sections);
    expect(flat.map((g) => g.repoFullName)).toEqual(["org/a", "org/b"]);
    expect(flat[0].sectionPath).toEqual([{ label: "tribe-a + tribe-a-p1", level: 0 }]);
    expect(flat[1].sectionPath).toBeUndefined();
  });

  it("does not mutate the input tree", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a"])];
    const sections = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const before = JSON.stringify(sections);
    flattenTeamHierarchy(sections);
    expect(JSON.stringify(sections)).toBe(before);
  });

  it("returns an empty array for an empty tree", () => {
    expect(flattenTeamHierarchy([])).toEqual([]);
  });
});

// ─── rebuildTeamHierarchy ──────────────────────────────────────────────────────

describe("rebuildTeamHierarchy", () => {
  it("round-trips a 2-level tree through flattenTeamHierarchy", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["tribe-a", "squad-b"]),
    ];
    const original = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const rebuilt = rebuildTeamHierarchy(flattenTeamHierarchy(original));
    expect(rebuilt).toEqual(original);
  });

  it("round-trips a tree where a node has both own groups and children (overlap parent)", () => {
    const groups = [makeGroup("org/a", ["tribe-a"]), makeGroup("org/b", ["tribe-a-p1"])];
    const original = groupByTeamHierarchy(groups, [["tribe-"]]);
    const rebuilt = rebuildTeamHierarchy(flattenTeamHierarchy(original));
    expect(rebuilt).toEqual(original);
  });

  it("round-trips multiple independent top-level chains", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["chapter-backend"]),
      makeGroup("org/c", []),
    ];
    const original = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["chapter-"]]);
    const rebuilt = rebuildTeamHierarchy(flattenTeamHierarchy(original));
    expect(rebuilt).toEqual(original);
  });

  it("returns an empty array for an empty input", () => {
    expect(rebuildTeamHierarchy([])).toEqual([]);
  });
});

// ─── applyTeamPickInTree ────────────────────────────────────────────────────────

describe("applyTeamPickInTree", () => {
  it("behaves like applyTeamPick for a top-level (depth-1) path", () => {
    const flatSections: TeamSection[] = [
      { label: "squad-frontend", groups: [makeGroup("org/a", ["squad-frontend"])] },
      {
        label: "squad-frontend + squad-mobile",
        groups: [makeGroup("org/shared", ["squad-frontend", "squad-mobile"])],
      },
    ];
    const viaFlat = applyTeamPick(flatSections, "squad-frontend + squad-mobile", "squad-frontend");
    const viaTree = applyTeamPickInTree(
      flatSections,
      ["squad-frontend + squad-mobile"],
      "squad-frontend",
    );
    expect(viaTree).toEqual(viaFlat);
  });

  it("reassigns a nested combined section to a sibling at the same depth", () => {
    const groups = [
      makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"]),
      makeGroup("org/a", ["tribe-a", "squad-a"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const updated = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const gamme = updated.find((s) => s.label === "tribe-a")!;
    const childLabels = (gamme.children ?? []).map((c) => c.label);
    expect(childLabels).not.toContain("squad-a + squad-b");
    const squadA = gamme.children!.find((c) => c.label === "squad-a")!;
    expect(squadA.groups.map((g) => g.repoFullName).toSorted()).toEqual(["org/a", "org/shared"]);
  });

  it("tags moved repos with pickedFrom = joined path", () => {
    const groups = [makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const updated = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const gamme = updated.find((s) => s.label === "tribe-a")!;
    const squadA = gamme.children!.find((c) => c.label === "squad-a")!;
    expect(squadA.groups[0].pickedFrom).toBe("tribe-a > squad-a + squad-b");
  });

  it("creates a new sibling section when the chosen team has none yet", () => {
    const groups = [makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const updated = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-b");
    const gamme = updated.find((s) => s.label === "tribe-a")!;
    expect(gamme.children!.map((c) => c.label)).toContain("squad-b");
  });

  it("is a no-op when a path segment is not found", () => {
    const groups = [makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const result = applyTeamPickInTree(tree, ["nope", "squad-a + squad-b"], "squad-a");
    expect(result).toEqual(tree);
  });

  it("preserves the picked section's own children (does not drop the subtree)", () => {
    // Regression: a top-level combined section ("tribe-b + tribe-b-p1") that
    // was already subdivided by the next chain level (squad-) must keep its
    // nested children when picked — only its own (now empty) `groups` were
    // carried over before the fix, silently dropping every repo nested
    // underneath. Each repo has only ONE tribe- team (never both), so the
    // combined section is formed by combineOverlappingLabels across the two
    // repos, not collapsed away by the redundant-sub-team reduction.
    const groups = [
      makeGroup("org/a", ["tribe-b", "squad-core", "squad-mobile"]),
      makeGroup("org/b", ["tribe-b-p1"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const combined = tree.find((s) => s.label.includes(" + "))!;
    expect(combined.label).toBe("tribe-b + tribe-b-p1");
    expect(combined.groups).toEqual([]); // fully subdivided by squad- before the pick
    expect(combined.children).toHaveLength(2); // "squad-core + squad-mobile" and "other"

    const updated = applyTeamPickInTree(tree, [combined.label], "tribe-b");

    expect(updated.map((s) => s.label)).not.toContain(combined.label);
    const picked = updated.find((s) => s.label === "tribe-b")!;
    expect(picked).toBeDefined();
    expect(picked.children).toHaveLength(2);
    const squadChild = picked.children!.find((c) => c.label === "squad-core + squad-mobile")!;
    expect(squadChild.groups.map((g) => g.repoFullName)).toEqual(["org/a"]);
    const otherChild = picked.children!.find((c) => c.label === "other")!;
    expect(otherChild.groups.map((g) => g.repoFullName)).toEqual(["org/b"]);
    // Every repo in the moved subtree is tagged, not just the top node's own groups.
    expect(squadChild.groups[0].pickedFrom).toBe(combined.label);
    expect(otherChild.groups[0].pickedFrom).toBe(combined.label);
  });

  it("returns sections unchanged for an empty combinedPath", () => {
    const groups = [makeGroup("org/a")];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(applyTeamPickInTree(tree, [], "squad-a")).toBe(tree);
  });
});

// ─── undoSectionPickInTree ──────────────────────────────────────────────────────

describe("undoSectionPickInTree", () => {
  it("restores every repo tagged with the matching pickedFrom back to the combined section", () => {
    const groups = [
      makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"]),
      makeGroup("org/a", ["tribe-a", "squad-a"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const picked = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const restored = undoSectionPickInTree(picked, "tribe-a > squad-a + squad-b");
    const gamme = restored.find((s) => s.label === "tribe-a")!;
    const childLabels = gamme.children!.map((c) => c.label).toSorted();
    expect(childLabels).toEqual(["squad-a", "squad-a + squad-b"]);
    const combined = gamme.children!.find((c) => c.label === "squad-a + squad-b")!;
    expect(combined.groups.map((g) => g.repoFullName)).toEqual(["org/shared"]);
    expect(combined.groups[0].pickedFrom).toBeUndefined();
  });

  it("drops a section left empty after the restore", () => {
    const groups = [makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const picked = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const restored = undoSectionPickInTree(picked, "tribe-a > squad-a + squad-b");
    const gamme = restored.find((s) => s.label === "tribe-a")!;
    // squad-a only ever held the moved repo — it must be gone after the restore.
    expect(gamme.children!.map((c) => c.label)).not.toContain("squad-a");
  });

  it("is a no-op when no repo has a matching pickedFrom", () => {
    const groups = [makeGroup("org/a", ["squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(undoSectionPickInTree(tree, "nope")).toBe(tree);
  });

  it("behaves like undoSectionPick for a top-level (depth-1) path", () => {
    const flatSections: TeamSection[] = [
      {
        label: "squad-frontend",
        groups: [{ ...makeGroup("org/shared"), pickedFrom: "squad-frontend + squad-mobile" }],
      },
    ];
    const viaFlat = undoSectionPick(
      flattenTeamSections(flatSections),
      "squad-frontend + squad-mobile",
    );
    const viaTree = flattenTeamHierarchy(
      undoSectionPickInTree(
        rebuildTeamHierarchy(flattenTeamSections(flatSections)),
        "squad-frontend + squad-mobile",
      ),
    );
    expect(viaTree.map((g) => g.repoFullName)).toEqual(viaFlat.map((g) => g.repoFullName));
  });
});

// ─── moveRepoToSectionInTree ────────────────────────────────────────────────────

describe("moveRepoToSectionInTree", () => {
  it("moves a repo to a sibling under the given parent path", () => {
    const groups = [
      makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"]),
      makeGroup("org/a", ["tribe-a", "squad-a"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const picked = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const moved = moveRepoToSectionInTree(picked, "org/shared", ["tribe-a"], "squad-b");
    const gamme = moved.find((s) => s.label === "tribe-a")!;
    const squadB = gamme.children!.find((c) => c.label === "squad-b")!;
    expect(squadB.groups.map((g) => g.repoFullName)).toEqual(["org/shared"]);
    const squadA = gamme.children!.find((c) => c.label === "squad-a")!;
    expect(squadA.groups.map((g) => g.repoFullName)).toEqual(["org/a"]);
  });

  it("creates the target section when it doesn't exist yet", () => {
    const groups = [makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const picked = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const moved = moveRepoToSectionInTree(picked, "org/shared", ["tribe-a"], "squad-c");
    const gamme = moved.find((s) => s.label === "tribe-a")!;
    expect(gamme.children!.map((c) => c.label)).toContain("squad-c");
  });

  it("is a no-op when the repo is not found anywhere in the tree", () => {
    const groups = [makeGroup("org/a", ["squad-a"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(moveRepoToSectionInTree(tree, "org/does-not-exist", [], "squad-b")).toBe(tree);
  });
});

// ─── undoPickedRepoInTree ───────────────────────────────────────────────────────

describe("undoPickedRepoInTree", () => {
  it("restores a single picked repo back to its original combined section", () => {
    const groups = [
      makeGroup("org/shared", ["tribe-a", "squad-a", "squad-b"]),
      makeGroup("org/a", ["tribe-a", "squad-a"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const picked = applyTeamPickInTree(tree, ["tribe-a", "squad-a + squad-b"], "squad-a");
    const restored = undoPickedRepoInTree(picked, "org/shared");
    const gamme = restored.find((s) => s.label === "tribe-a")!;
    const combined = gamme.children!.find((c) => c.label === "squad-a + squad-b")!;
    expect(combined.groups.map((g) => g.repoFullName)).toEqual(["org/shared"]);
    expect(combined.groups[0].pickedFrom).toBeUndefined();
    // The other repo that was also moved stays picked.
    const squadA = gamme.children!.find((c) => c.label === "squad-a")!;
    expect(squadA.groups.map((g) => g.repoFullName)).toEqual(["org/a"]);
  });

  it("is a no-op for a repo with no pickedFrom", () => {
    const groups = [makeGroup("org/a", ["squad-a"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(undoPickedRepoInTree(tree, "org/a")).toBe(tree);
  });

  it("is a no-op when the repo is not found", () => {
    const groups = [makeGroup("org/a", ["squad-a"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(undoPickedRepoInTree(tree, "org/does-not-exist")).toBe(tree);
  });
});

// ─── findCombinedSectionPaths ───────────────────────────────────────────────────

describe("findCombinedSectionPaths", () => {
  it("finds a top-level combined section", () => {
    const groups = [makeGroup("org/a", ["squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(findCombinedSectionPaths(tree)).toEqual([["squad-a + squad-b"]]);
  });

  it("finds a nested combined section with its full ancestor path", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    expect(findCombinedSectionPaths(tree)).toEqual([["tribe-a", "squad-a + squad-b"]]);
  });

  it("returns an empty array when there is no combined section", () => {
    const groups = [makeGroup("org/a", ["squad-a"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(findCombinedSectionPaths(tree)).toEqual([]);
  });

  it("finds multiple combined sections across different branches", () => {
    const groups = [
      makeGroup("org/a", ["tribe-x", "squad-a", "squad-b"]),
      makeGroup("org/b", ["tribe-y", "chapter-a", "chapter-b"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["tribe-"]]);
    // Both repos start with a different top-level "tribe-" match, so this
    // exercises two independent combined sections at the same nested depth.
    const paths = findCombinedSectionPaths(tree);
    expect(paths).toContainEqual(["tribe-x", "squad-a + squad-b"]);
  });
});

// ─── autoPickTeamsByCommonPrefix ───────────────────────────────────────────────

describe("autoPickTeamsByCommonPrefix", () => {
  it("resolves a combined section to the team that is a prefix of the other", () => {
    const groups = [makeGroup("org/a", ["tribe-a"]), makeGroup("org/b", ["tribe-a-p1"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-"]]);
    expect(findCombinedSectionPaths(tree)).toEqual([["tribe-a + tribe-a-p1"]]);

    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(findCombinedSectionPaths(resolved)).toEqual([]);
    const winner = resolved.find((s) => s.label === "tribe-a")!;
    expect(winner.groups.map((g) => g.repoFullName).toSorted()).toEqual(["org/a", "org/b"]);
  });

  it("leaves a combined section unresolved when no team is a prefix of the others", () => {
    const groups = [makeGroup("org/a", ["squad-frontend", "squad-mobile"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(findCombinedSectionPaths(resolved)).toEqual([["squad-frontend + squad-mobile"]]);
  });

  it("picks the shortest common-prefix team among 3+ combined teams", () => {
    const groups = [
      makeGroup("org/a", ["tribe-x"]),
      makeGroup("org/b", ["tribe-x-y"]),
      makeGroup("org/c", ["tribe-x-y-z"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-"]]);
    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(findCombinedSectionPaths(resolved)).toEqual([]);
    expect(resolved.map((s) => s.label)).toEqual(["tribe-x"]);
  });

  it("resolves independently at a nested (non-top-level) depth", () => {
    const groups = [
      makeGroup("org/a", ["tribe-a", "squad-a"]),
      makeGroup("org/b", ["tribe-a", "squad-a-legacy"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(findCombinedSectionPaths(resolved)).toEqual([]);
    const gamme = resolved.find((s) => s.label === "tribe-a")!;
    const child = (gamme.children ?? []).find((c) => c.label === "squad-a")!;
    expect(child).toBeDefined();
    expect(child.groups.map((g) => g.repoFullName).toSorted()).toEqual(["org/a", "org/b"]);
  });

  it("an explicit --pick-team resolution is left untouched (no longer combined) when auto-pick runs after", () => {
    const groups = [makeGroup("org/a", ["squad-frontend", "squad-mobile"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    const picked = applyTeamPickInTree(tree, ["squad-frontend + squad-mobile"], "squad-frontend");
    const resolved = autoPickTeamsByCommonPrefix(picked);
    expect(resolved).toEqual(picked);
  });

  it("is a pure function — does not mutate the input tree", () => {
    const groups = [makeGroup("org/a", ["tribe-a"]), makeGroup("org/b", ["tribe-a-p1"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-"]]);
    const before = JSON.stringify(tree);
    autoPickTeamsByCommonPrefix(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it("returns the tree unchanged when there is no combined section", () => {
    const groups = [makeGroup("org/a", ["squad-front"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    expect(autoPickTeamsByCommonPrefix(tree)).toEqual(tree);
  });

  it("investigation (#issue: chapter-secops not merging): does NOT merge combos that only share SOME members but no candidate is a literal prefix of every other candidate", () => {
    // Reported expectation: "chapter-secops + chapter-validators-core",
    // "chapter-head-of-frontend + chapter-secops + chapter-validators-core"
    // and "chapter-secops + chapter-validators + chapter-validators-core"
    // should all collapse under "chapter-secops". None of the distinct team
    // names here is a literal string-prefix of every other one in its own
    // combo (secops vs validators-core vs validators vs head-of-frontend), so
    // the "one candidate is a prefix of all others" strategy correctly leaves
    // them combined and unresolved — merging them further would require a
    // different algorithm (cluster by shared team membership across combos),
    // which is out of scope for this strategy. Note org/c's own combo is
    // already reduced from 3-way to 2-way by dropRedundantSubTeams, since
    // chapter-validators-core is a redundant sub-team of chapter-validators
    // (both present on org/c) — a real improvement, just not full merging.
    const groups = [
      makeGroup("org/a", ["chapter-secops", "chapter-validators-core"]),
      makeGroup("org/b", ["chapter-head-of-frontend", "chapter-secops", "chapter-validators-core"]),
      makeGroup("org/c", ["chapter-secops", "chapter-validators", "chapter-validators-core"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["chapter-"]]);
    const resolved = autoPickTeamsByCommonPrefix(tree);
    expect(
      findCombinedSectionPaths(resolved)
        .map((p) => p[0])
        .toSorted(),
    ).toEqual(
      [
        "chapter-head-of-frontend + chapter-secops + chapter-validators-core",
        "chapter-secops + chapter-validators",
        "chapter-secops + chapter-validators-core",
      ].toSorted(),
    );
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
        groups: [{ ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") }],
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
            ...makePicked(
              "org/repoA",
              "squad-frontend + squad-mobile",
              "squad-frontend + squad-mobile",
            ),
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
        groups: [{ ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") }],
      },
      {
        label: "squad-mobile",
        groups: [{ ...makePicked("org/repoB", "squad-frontend + squad-mobile", "squad-mobile") }],
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
        groups: [{ ...makePicked("org/repoA", "squad-frontend + squad-mobile", "squad-frontend") }],
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

// ─── parseTeamPrefixChains ──────────────────────────────────────────────────────

describe("parseTeamPrefixChains", () => {
  it("parses a single flat prefix into a 1-level chain", () => {
    expect(parseTeamPrefixChains("squad-")).toEqual({ chains: [["squad-"]], warnings: [] });
  });

  it("parses comma-separated prefixes into independent 1-level chains", () => {
    expect(parseTeamPrefixChains("squad-,chapter-")).toEqual({
      chains: [["squad-"], ["chapter-"]],
      warnings: [],
    });
  });

  it("parses a slash-separated chain into a multi-level chain", () => {
    expect(parseTeamPrefixChains("tribe-/squad-")).toEqual({
      chains: [["tribe-", "squad-"]],
      warnings: [],
    });
  });

  it("parses a mix of a 2-level chain and an independent 1-level chain", () => {
    expect(parseTeamPrefixChains("tribe-/squad-,chapter-")).toEqual({
      chains: [["tribe-", "squad-"], ["chapter-"]],
      warnings: [],
    });
  });

  it("trims whitespace around prefixes and levels", () => {
    expect(parseTeamPrefixChains(" tribe- / squad- , chapter- ")).toEqual({
      chains: [["tribe-", "squad-"], ["chapter-"]],
      warnings: [],
    });
  });

  it("drops an empty chain from a leading, trailing, or double comma, with a warning", () => {
    const { chains, warnings } = parseTeamPrefixChains(",squad-,,chapter-,");
    expect(chains).toEqual([["squad-"], ["chapter-"]]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.includes("empty chain segment"))).toBe(true);
  });

  it("drops an empty level from a leading, trailing, or double slash, with a warning", () => {
    const { chains, warnings } = parseTeamPrefixChains("/tribe-//squad-/");
    expect(chains).toEqual([["tribe-", "squad-"]]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("empty prefix level");
  });

  it("returns no chains and no warnings for an empty string", () => {
    // Not a realistic CLI input (the caller checks truthiness first), but
    // must not throw.
    expect(parseTeamPrefixChains("")).toEqual({
      chains: [],
      warnings: ['--group-by-team-prefix: ignoring empty chain segment in ""'],
    });
  });
});

// ─── resolvePickTeamAssignment ──────────────────────────────────────────────────

describe("resolvePickTeamAssignment", () => {
  it("resolves a bare label that is unambiguous in the tree", () => {
    const groups = [makeGroup("org/a", ["squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-a + squad-b=squad-a");
    expect(result).toEqual({ path: ["squad-a + squad-b"], chosen: "squad-a" });
  });

  it("resolves a nested bare label by finding it anywhere in the tree", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-a + squad-b=squad-a");
    expect(result).toEqual({ path: ["tribe-a", "squad-a + squad-b"], chosen: "squad-a" });
  });

  it("accepts an explicit fully-qualified path (parent > combined)", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const result = resolvePickTeamAssignment(tree, "tribe-a > squad-a + squad-b=squad-b");
    expect(result).toEqual({ path: ["tribe-a", "squad-a + squad-b"], chosen: "squad-b" });
  });

  it("rejects an explicit path whose parent segment doesn't exist in the tree", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    const result = resolvePickTeamAssignment(tree, "wrong-parent > squad-a + squad-b=squad-a");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("no combined section found");
    expect((result as { error: string }).error).toContain("tribe-a > squad-a + squad-b");
  });

  it("rejects an explicit path pointing at a section that no longer exists after an earlier pick", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a", "squad-b"])];
    let tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    // First pick resolves (and removes) the only combined section.
    const first = resolvePickTeamAssignment(tree, "tribe-a > squad-a + squad-b=squad-a");
    if ("error" in first) throw new Error("unexpected error in test setup");
    tree = applyTeamPickInTree(tree, first.path, first.chosen);
    // Re-using the same (now stale) explicit path must be rejected, not silently no-op.
    const second = resolvePickTeamAssignment(tree, "tribe-a > squad-a + squad-b=squad-a");
    expect("error" in second).toBe(true);
  });

  it("errors when the = separator is missing", () => {
    const tree = groupByTeamHierarchy([makeGroup("org/a", ["squad-a"])], [["squad-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-a + squad-b");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("missing the =");
  });

  it("errors when the combined or chosen side is empty", () => {
    const tree = groupByTeamHierarchy([makeGroup("org/a", ["squad-a"])], [["squad-"]]);
    const result = resolvePickTeamAssignment(tree, "=squad-a");
    expect("error" in result).toBe(true);
  });

  it("errors with the available combined sections when the bare label is not found", () => {
    const groups = [makeGroup("org/a", ["squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-x + squad-y=squad-x");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("squad-a + squad-b");
  });

  it("errors when the bare label is ambiguous across multiple branches", () => {
    const groups = [
      makeGroup("org/a", ["tribe-x", "squad-a", "squad-b"]),
      makeGroup("org/b", ["tribe-y", "squad-a", "squad-b"]),
    ];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"], ["tribe-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-a + squad-b=squad-a");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("ambiguous");
  });

  it("errors when the combined label is not a multi-team section", () => {
    const groups = [makeGroup("org/a", ["tribe-a", "squad-a"])];
    const tree = groupByTeamHierarchy(groups, [["tribe-", "squad-"]]);
    // Explicit path pointing at a genuine (non-combined) section.
    const result = resolvePickTeamAssignment(tree, "tribe-a > squad-a=squad-a");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("not a multi-team section");
  });

  it("errors when the chosen team is not one of the combined candidates", () => {
    const groups = [makeGroup("org/a", ["squad-a", "squad-b"])];
    const tree = groupByTeamHierarchy(groups, [["squad-"]]);
    const result = resolvePickTeamAssignment(tree, "squad-a + squad-b=squad-c");
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("Allowed choices");
  });
});
