import { describe, expect, it } from "bun:test";
import { segmentLineCol } from "./api.ts";
import {
  buildJsonOutput,
  buildMarkdownOutput,
  buildOutput,
  buildReplayCommand,
  buildReplayDetails,
  shortExtractRef,
  shortRepo,
} from "./output.ts";
import type { RepoGroup } from "./types.ts";

const ORG = "myorg";
const QUERY = "useFlag";

function makeGroup(
  repo: string,
  paths: string[],
  {
    repoSelected = true,
    extractSelected,
  }: { repoSelected?: boolean; extractSelected?: boolean[] } = {},
): RepoGroup {
  return {
    repoFullName: repo,
    matches: paths.map((p) => ({
      path: p,
      repoFullName: repo,
      htmlUrl: `https://github.com/${repo}/blob/main/${p}`,
      archived: false,
      textMatches: [],
    })),
    folded: true,
    repoSelected,
    extractSelected: extractSelected ?? paths.map(() => true),
  };
}

/** Helper: group where matches include text-match location info. */
function makeGroupWithMatches(
  repo: string,
  files: Array<{ path: string; line: number; col: number }>,
): RepoGroup {
  return {
    repoFullName: repo,
    matches: files.map(({ path, line, col }) => ({
      path,
      repoFullName: repo,
      htmlUrl: `https://github.com/${repo}/blob/main/${path}`,
      archived: false,
      textMatches: [
        {
          fragment: "some code snippet",
          matches: [{ text: "snippet", indices: [10, 17], line, col }],
        },
      ],
    })),
    folded: true,
    repoSelected: true,
    extractSelected: files.map(() => true),
  };
}

describe("shortRepo", () => {
  it("strips org prefix", () => {
    expect(shortRepo("myorg/repoA", ORG)).toBe("repoA");
  });

  it("leaves other orgs untouched", () => {
    expect(shortRepo("otherorg/repoA", ORG)).toBe("otherorg/repoA");
  });
});

describe("shortExtractRef", () => {
  it("strips org prefix from extract ref", () => {
    expect(shortExtractRef("myorg/repoA:src/foo.ts:0", ORG)).toBe("repoA:src/foo.ts:0");
  });
});

describe("buildReplayCommand", () => {
  it("generates base command", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(), new Set());
    expect(cmd).toContain(`github-code-search`);
    expect(cmd).toContain(`--org ${ORG}`);
    expect(cmd).toContain(`--no-interactive`);
  });

  it("starts with replay comment header", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(), new Set());
    expect(cmd).toContain("# Replay:");
  });

  it("command lines are directly runnable (no # prefix)", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(), new Set());
    const lines = cmd.split("\n");
    // Second line onward should NOT start with "# " (only first is a comment)
    const commandLines = lines.filter((l) => !l.startsWith("#"));
    expect(commandLines.length).toBeGreaterThan(0);
    expect(commandLines[0]).not.toMatch(/^#\s/);
  });

  it("includes deselected repo in --exclude-repositories", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { repoSelected: false })];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(), new Set());
    expect(cmd).toContain("--exclude-repositories repoA");
  });

  it("includes deselected extract in --exclude-extracts", () => {
    const groups = [
      makeGroup("myorg/repoA", ["a.ts", "b.ts"], {
        extractSelected: [true, false],
      }),
    ];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(), new Set());
    expect(cmd).toContain("--exclude-extracts repoA:b.ts:1");
  });

  it("does not double-add pre-existing exclusions", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { repoSelected: false })];
    const cmd = buildReplayCommand(groups, QUERY, ORG, new Set(["myorg/repoA"]), new Set());
    const count = (cmd.match(/repoA/g) ?? []).length;
    expect(count).toBe(1);
  });
});

describe("buildReplayDetails", () => {
  it("returns a <details> block with bash code fence", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const out = buildReplayDetails(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>replay command</summary>");
    expect(out).toContain("```bash");
    expect(out).toContain("</details>");
  });

  it("contains the runnable shell command (no # Replay: header)", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const out = buildReplayDetails(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("github-code-search");
    expect(out).toContain("--no-interactive");
    // The "# Replay:" comment header should NOT appear in the details block
    expect(out).not.toContain("# Replay:");
  });

  it("includes exclusion flags inside the code fence", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { repoSelected: false })];
    const out = buildReplayDetails(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("--exclude-repositories");
  });
});

describe("buildMarkdownOutput", () => {
  it("includes selected repo and file link", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("myorg/repoA");
    expect(out).toContain("[src/foo.ts](https://github.com/myorg/repoA/blob/main/src/foo.ts)");
  });

  it("renders repo as bold bullet", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("- **myorg/repoA**");
    expect(out).toContain("(1 match)");
  });

  it("renders plural match count in repo bullet", () => {
    const groups = [makeGroup("myorg/repoA", ["src/a.ts", "src/b.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("(2 matches)");
  });

  it("emits ## section header when sectionLabel is set on the first repo of a section", () => {
    const groups = [
      {
        ...makeGroup("myorg/repoA", ["src/foo.ts"]),
        sectionLabel: "squad-frontend",
      },
      makeGroup("myorg/repoB", ["src/bar.ts"]),
    ];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("## squad-frontend");
    // repoB has no sectionLabel — no duplicate header
    const headerCount = (out.match(/^## /gm) ?? []).length;
    expect(headerCount).toBe(1);
  });

  it("emits a ## header per section when multiple sections are defined", () => {
    const groups = [
      { ...makeGroup("myorg/repoA", ["a.ts"]), sectionLabel: "squad-frontend" },
      { ...makeGroup("myorg/repoB", ["b.ts"]), sectionLabel: "squad-mobile" },
    ];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("## squad-frontend");
    expect(out).toContain("## squad-mobile");
    const headerCount = (out.match(/^## /gm) ?? []).length;
    expect(headerCount).toBe(2);
  });

  it("renders each file as an indented sub-bullet", () => {
    const groups = [makeGroup("myorg/repoA", ["src/a.ts", "src/b.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("  - [src/a.ts](https://github.com/myorg/repoA/blob/main/src/a.ts)");
    expect(out).toContain("  - [src/b.ts](https://github.com/myorg/repoA/blob/main/src/b.ts)");
  });

  it("omits deselected repos", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { repoSelected: false })];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).not.toContain("**myorg/repoA**");
  });

  it("omits repos where all extracts are deselected", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { extractSelected: [false] })];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).not.toContain("**myorg/repoA**");
  });

  it("always appends a replay command in a <details> block", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>replay command</summary>");
    expect(out).toContain("```bash");
    expect(out).toContain("</details>");
  });

  it("repo-only mode outputs only repo names without file links", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).toContain("myorg/repoA");
    expect(out).not.toContain("[src/foo.ts]");
  });

  it("repo-only mode appends a replay command in a <details> block", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>replay command</summary>");
  });

  it("repo-only mode returns newline-terminated list of repo names followed by replay", () => {
    const groups = [makeGroup("myorg/repoA", ["src/a.ts"]), makeGroup("myorg/repoB", ["src/b.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).toContain("myorg/repoA\nmyorg/repoB\n");
    expect(out).toContain("<details>");
    expect(out).toContain("<summary>replay command</summary>");
  });

  it("repo-only mode returns empty string when no groups are selected", () => {
    const groups = [makeGroup("myorg/repoA", ["src/a.ts"], { repoSelected: false })];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).toBe("");
  });

  it("prepends selection summary line in repo-and-matches mode", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("selected");
    const firstLine = out.split("\n")[0];
    expect(firstLine).toContain("selected");
  });

  it("does not prepend selection summary in repo-only mode", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).not.toContain("selected");
  });
});

describe("buildJsonOutput", () => {
  it("returns valid JSON", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildJsonOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("contains results array", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].repo).toBe("myorg/repoA");
    expect(parsed.results[0].matches[0].path).toBe("src/foo.ts");
  });

  it("omits deselected repos from results", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts"], { repoSelected: false })];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.results).toHaveLength(0);
  });

  it("includes query and org fields", () => {
    const groups: RepoGroup[] = [];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.query).toBe(QUERY);
    expect(parsed.org).toBe(ORG);
  });

  it("includes selection field with repo and match counts", () => {
    const groups = [makeGroup("myorg/repoA", ["a.ts", "b.ts"])];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.selection).toBeDefined();
    expect(parsed.selection.repos).toBe(1);
    expect(parsed.selection.matches).toBe(2);
  });

  it("selection field reflects partial deselections", () => {
    const groups = [
      makeGroup("myorg/repoA", ["a.ts", "b.ts"], {
        extractSelected: [true, false],
      }),
    ];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.selection.repos).toBe(1);
    expect(parsed.selection.matches).toBe(1);
  });

  it("repo-only mode omits matches field", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const parsed = JSON.parse(
      buildJsonOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only"),
    );
    expect(parsed.results[0].repo).toBe("myorg/repoA");
    expect(parsed.results[0].matches).toBeUndefined();
  });
});

// ─── segmentLineCol ───────────────────────────────────────────────────────────

describe("segmentLineCol", () => {
  it("returns line 1 col 1 for offset 0", () => {
    expect(segmentLineCol("hello world", 0)).toEqual({ line: 1, col: 1 });
  });

  it("counts lines correctly across newlines", () => {
    const fragment = "line1\nline2\nline3";
    // 'line2' starts at offset 6
    expect(segmentLineCol(fragment, 6)).toEqual({ line: 2, col: 1 });
  });

  it("computes column within a line", () => {
    const fragment = "abc\ndef";
    // 'e' is at offset 5 → line 2, col 2
    expect(segmentLineCol(fragment, 5)).toEqual({ line: 2, col: 2 });
  });

  it("handles offset at end of fragment", () => {
    const fragment = "abc";
    expect(segmentLineCol(fragment, 3)).toEqual({ line: 1, col: 4 });
  });
});

// ─── VS Code path:line:col annotation in markdown ────────────────────────────

describe("buildMarkdownOutput — line/col annotation", () => {
  it("formats file link as [path:line:col](url#Lline) when location is available", () => {
    const groups = [makeGroupWithMatches("myorg/repoA", [{ path: "src/foo.ts", line: 3, col: 5 }])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("[src/foo.ts:3:5](");
    expect(out).toContain("#L3)");
  });

  it("uses plain [path](url) link when no text matches", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set());
    expect(out).toContain("[src/foo.ts](");
    expect(out).not.toMatch(/\[src\/foo\.ts:\d+:\d+\]/);
  });

  it("does not add location suffix in repo-only mode", () => {
    const groups = [makeGroupWithMatches("myorg/repoA", [{ path: "src/foo.ts", line: 3, col: 5 }])];
    const out = buildMarkdownOutput(groups, QUERY, ORG, new Set(), new Set(), "repo-only");
    expect(out).not.toContain("[src/foo.ts:3:5]");
  });
});

// ─── JSON line/col fields ─────────────────────────────────────────────────────

describe("buildJsonOutput — line/col fields", () => {
  it("includes line and col in match when text match is present", () => {
    const groups = [makeGroupWithMatches("myorg/repoA", [{ path: "src/foo.ts", line: 2, col: 8 }])];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.results[0].matches[0].line).toBe(2);
    expect(parsed.results[0].matches[0].col).toBe(8);
  });

  it("omits line and col when no text matches", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const parsed = JSON.parse(buildJsonOutput(groups, QUERY, ORG, new Set(), new Set()));
    expect(parsed.results[0].matches[0].line).toBeUndefined();
    expect(parsed.results[0].matches[0].col).toBeUndefined();
  });
});

// ─── buildOutput dispatcher ──────────────────────────────────────────────────

describe("buildOutput", () => {
  it("dispatches to JSON when format is json", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildOutput(groups, QUERY, ORG, new Set(), new Set(), "json");
    expect(() => JSON.parse(out)).not.toThrow();
    const parsed = JSON.parse(out);
    expect(parsed.query).toBe(QUERY);
    expect(parsed.results).toBeDefined();
  });

  it("dispatches to markdown when format is text", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildOutput(groups, QUERY, ORG, new Set(), new Set(), "text");
    expect(out).toContain("- **myorg/repoA**");
  });

  it("passes repo-only outputType to JSON dispatcher", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildOutput(groups, QUERY, ORG, new Set(), new Set(), "json", "repo-only");
    const parsed = JSON.parse(out);
    expect(parsed.results[0].matches).toBeUndefined();
  });

  it("passes repo-only outputType to text dispatcher", () => {
    const groups = [makeGroup("myorg/repoA", ["src/foo.ts"])];
    const out = buildOutput(groups, QUERY, ORG, new Set(), new Set(), "text", "repo-only");
    expect(out).not.toContain("[src/foo.ts]");
    expect(out).toContain("myorg/repoA");
  });
});
