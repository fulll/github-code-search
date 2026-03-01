import { describe, expect, it } from "bun:test";
import { makeExtractMatcher, makeRepoMatcher } from "./filter-match.ts";
import type { CodeMatch, RepoGroup } from "../types.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMatch(path: string, fragments: string[] = []): CodeMatch {
  return {
    path,
    repoFullName: "org/repo",
    htmlUrl: `https://github.com/org/repo/blob/main/${path}`,
    archived: false,
    textMatches: fragments.map((f) => ({ fragment: f, matches: [] })),
  };
}

function makeGroup(repoFullName: string): RepoGroup {
  return {
    repoFullName,
    matches: [],
    folded: false,
    repoSelected: true,
    extractSelected: [],
  };
}

// ─── makeExtractMatcher — path target ─────────────────────────────────────────

describe("makeExtractMatcher (path)", () => {
  it("empty pattern always matches", () => {
    const fn = makeExtractMatcher("", "path", false);
    expect(fn(makeMatch("src/foo.ts"))).toBe(true);
  });

  it("substring match is case-insensitive", () => {
    const fn = makeExtractMatcher("FOO", "path", false);
    expect(fn(makeMatch("src/foo.ts"))).toBe(true);
    expect(fn(makeMatch("src/bar.ts"))).toBe(false);
  });

  it("regex match works", () => {
    const fn = makeExtractMatcher("^src/", "path", true);
    expect(fn(makeMatch("src/foo.ts"))).toBe(true);
    expect(fn(makeMatch("lib/foo.ts"))).toBe(false);
  });

  it("regex match is case-insensitive", () => {
    const fn = makeExtractMatcher("FOO\\.ts$", "path", true);
    expect(fn(makeMatch("src/foo.ts"))).toBe(true);
  });

  it("invalid regex → always false (no crash)", () => {
    const fn = makeExtractMatcher("[broken", "path", true);
    expect(fn(makeMatch("src/foo.ts"))).toBe(false);
  });
});

// ─── makeExtractMatcher — content target ─────────────────────────────────────

describe("makeExtractMatcher (content)", () => {
  it("empty pattern always matches", () => {
    const fn = makeExtractMatcher("", "content", false);
    expect(fn(makeMatch("src/foo.ts", ["hello world"]))).toBe(true);
  });

  it("matches against fragment text", () => {
    const fn = makeExtractMatcher("hello", "content", false);
    expect(fn(makeMatch("src/foo.ts", ["hello world"]))).toBe(true);
    expect(fn(makeMatch("src/foo.ts", ["goodbye world"]))).toBe(false);
  });

  it("matches any fragment when multiple present", () => {
    const fn = makeExtractMatcher("secret", "content", false);
    const m = makeMatch("file.ts", ["first fragment", "second with secret"]);
    expect(fn(m)).toBe(true);
  });

  it("returns false when no fragments", () => {
    const fn = makeExtractMatcher("hello", "content", false);
    expect(fn(makeMatch("src/foo.ts", []))).toBe(false);
  });

  it("regex match against fragment", () => {
    const fn = makeExtractMatcher("const \\w+", "content", true);
    expect(fn(makeMatch("f.ts", ["const x = 1"]))).toBe(true);
    expect(fn(makeMatch("f.ts", ["let y = 2"]))).toBe(false);
  });

  it("invalid regex → always false", () => {
    const fn = makeExtractMatcher("[broken", "content", true);
    expect(fn(makeMatch("f.ts", ["hello"]))).toBe(false);
  });
});

// ─── makeRepoMatcher ─────────────────────────────────────────────────────────

describe("makeRepoMatcher", () => {
  it("empty pattern always matches", () => {
    const fn = makeRepoMatcher("", false);
    expect(fn(makeGroup("org/service-a"))).toBe(true);
  });

  it("substring match on repoFullName", () => {
    const fn = makeRepoMatcher("service", false);
    expect(fn(makeGroup("org/service-a"))).toBe(true);
    expect(fn(makeGroup("org/other"))).toBe(false);
  });

  it("case-insensitive substring match", () => {
    const fn = makeRepoMatcher("SERVICE", false);
    expect(fn(makeGroup("org/service-a"))).toBe(true);
  });

  it("regex match on repoFullName", () => {
    const fn = makeRepoMatcher("^org/service", true);
    expect(fn(makeGroup("org/service-a"))).toBe(true);
    expect(fn(makeGroup("other/service-a"))).toBe(false);
  });

  it("invalid regex → always false", () => {
    const fn = makeRepoMatcher("[broken", true);
    expect(fn(makeGroup("org/repo"))).toBe(false);
  });

  it("matches short repo name without org prefix", () => {
    const fn = makeRepoMatcher("service-a", false);
    expect(fn(makeGroup("org/service-a"))).toBe(true);
  });
});
