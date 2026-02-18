import { describe, expect, it } from "bun:test";
import { aggregate, extractRef, normaliseExtractRef, normaliseRepo } from "./aggregate.ts";
import type { CodeMatch } from "./types.ts";

const ORG = "myorg";

describe("normaliseRepo", () => {
  it("keeps full name unchanged", () => {
    expect(normaliseRepo(ORG, "myorg/repoA")).toBe("myorg/repoA");
  });

  it("prepends org to short name", () => {
    expect(normaliseRepo(ORG, "repoA")).toBe("myorg/repoA");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseRepo(ORG, "  repoA  ")).toBe("myorg/repoA");
  });
});

describe("normaliseExtractRef", () => {
  it("normalises short ref", () => {
    expect(normaliseExtractRef(ORG, "repoA:src/foo.ts:0")).toBe("myorg/repoA:src/foo.ts:0");
  });

  it("keeps full ref unchanged", () => {
    expect(normaliseExtractRef(ORG, "myorg/repoA:src/foo.ts:2")).toBe("myorg/repoA:src/foo.ts:2");
  });

  it("returns raw if no colon separator", () => {
    expect(normaliseExtractRef(ORG, "nocolon")).toBe("nocolon");
  });
});

describe("extractRef", () => {
  it("formats correctly", () => {
    expect(extractRef("myorg/repoA", "src/foo.ts", 3)).toBe("myorg/repoA:src/foo.ts:3");
  });
});

// ─── aggregate ───────────────────────────────────────────────────────────────

function makeMatch(repo: string, path: string, archived = false): CodeMatch {
  return {
    path,
    repoFullName: repo,
    htmlUrl: `https://github.com/${repo}/blob/main/${path}`,
    archived,
    textMatches: [],
  };
}

describe("aggregate", () => {
  it("groups matches by repo", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts"),
      makeMatch("myorg/repoA", "src/b.ts"),
      makeMatch("myorg/repoB", "src/c.ts"),
    ];

    const groups = aggregate(matches, new Set(), new Set());
    expect(groups).toHaveLength(2);
    expect(groups[0].repoFullName).toBe("myorg/repoA");
    expect(groups[0].matches).toHaveLength(2);
    expect(groups[1].repoFullName).toBe("myorg/repoB");
    expect(groups[1].matches).toHaveLength(1);
  });

  it("excludes repos in excludedRepos", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts"),
      makeMatch("myorg/repoB", "src/b.ts"),
    ];

    const groups = aggregate(matches, new Set(["myorg/repoA"]), new Set());
    expect(groups).toHaveLength(1);
    expect(groups[0].repoFullName).toBe("myorg/repoB");
  });

  it("excludes individual extracts", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts"),
      makeMatch("myorg/repoA", "src/b.ts"),
    ];

    // The second match (index 1 in the original list for repoA) should be excluded
    const groups = aggregate(matches, new Set(), new Set(["myorg/repoA:src/b.ts:1"]));
    expect(groups[0].matches).toHaveLength(1);
    expect(groups[0].matches[0].path).toBe("src/a.ts");
  });

  it("sets all extracts selected by default", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts"),
      makeMatch("myorg/repoA", "src/b.ts"),
    ];
    const groups = aggregate(matches, new Set(), new Set());
    expect(groups[0].extractSelected).toEqual([true, true]);
    expect(groups[0].repoSelected).toBe(true);
  });

  it("sets folded to true by default", () => {
    const groups = aggregate([makeMatch("myorg/repoA", "a.ts")], new Set(), new Set());
    expect(groups[0].folded).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(aggregate([], new Set(), new Set())).toEqual([]);
  });

  it("filters out archived repos by default (includeArchived = false)", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts", false),
      makeMatch("myorg/repoB", "src/b.ts", true), // archived
    ];
    const groups = aggregate(matches, new Set(), new Set());
    expect(groups).toHaveLength(1);
    expect(groups[0].repoFullName).toBe("myorg/repoA");
  });

  it("includes archived repos when includeArchived = true", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/repoA", "src/a.ts", false),
      makeMatch("myorg/repoB", "src/b.ts", true), // archived
    ];
    const groups = aggregate(matches, new Set(), new Set(), true);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.repoFullName)).toContain("myorg/repoB");
  });

  it("filters archived even when all matches from that repo are archived", () => {
    const matches: CodeMatch[] = [
      makeMatch("myorg/archivedRepo", "src/a.ts", true),
      makeMatch("myorg/archivedRepo", "src/b.ts", true),
    ];
    const groups = aggregate(matches, new Set(), new Set());
    expect(groups).toHaveLength(0);
  });
});
