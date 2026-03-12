import { describe, expect, it } from "bun:test";
import { buildApiQuery, isRegexQuery } from "./regex.ts";

// ─── isRegexQuery ─────────────────────────────────────────────────────────────

describe("isRegexQuery", () => {
  it("returns true for a bare regex token", () => {
    expect(isRegexQuery("/from.*axios/")).toBe(true);
  });

  it("returns true for a regex with flags", () => {
    expect(isRegexQuery("/pattern/i")).toBe(true);
  });

  it("returns true for a query mixing qualifiers and regex", () => {
    expect(isRegexQuery('filename:package.json /["\'"]axios["\'"]:/')).toBe(true);
  });

  it("returns false for a plain text query", () => {
    expect(isRegexQuery("from axios")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isRegexQuery("")).toBe(false);
  });

  it("returns false for a qualifier-only query", () => {
    expect(isRegexQuery("filename:package.json")).toBe(false);
  });

  it("returns false when /pattern/flags is not end-bounded (e.g. /useState/iSomething)", () => {
    // Regression: the token must be followed by whitespace or end-of-string;
    // a suffix of non-flag characters must not be silently swallowed.
    expect(isRegexQuery("/useState/iSomething")).toBe(false);
  });

  it("returns false for /pattern/e ('e' is not a valid JS RegExp flag)", () => {
    expect(isRegexQuery("/pattern/e")).toBe(false);
  });
});

// ─── buildApiQuery ────────────────────────────────────────────────────────────

describe("buildApiQuery — plain text passthrough", () => {
  it("returns input unchanged when no regex token", () => {
    const r = buildApiQuery("plain text query");
    expect(r.apiQuery).toBe("plain text query");
    expect(r.regexFilter).toBeNull();
    expect(r.warn).toBeUndefined();
  });

  it("/useState/iSomething is NOT treated as a regex token (boundary regression)", () => {
    // 'iSomething' is not a valid flag sequence — the token should not match.
    const r = buildApiQuery("/useState/iSomething");
    expect(r.apiQuery).toBe("/useState/iSomething");
    expect(r.regexFilter).toBeNull();
  });

  it("/pattern/e is NOT treated as a regex token ('e' is not a valid JS RegExp flag)", () => {
    const r = buildApiQuery("/pattern/e");
    expect(r.apiQuery).toBe("/pattern/e");
    expect(r.regexFilter).toBeNull();
  });
});

describe("buildApiQuery — longest literal extraction", () => {
  it("/from.*['\"]axios/ → axios", () => {
    const r = buildApiQuery("/from.*['\"]axios/");
    expect(r.apiQuery).toBe("axios");
    expect(r.regexFilter).toEqual(/from.*['"]axios/);
    expect(r.warn).toBeUndefined();
  });

  it("/useState/ → useState (trivial literal)", () => {
    const r = buildApiQuery("/useState/");
    expect(r.apiQuery).toBe("useState");
    expect(r.regexFilter).toEqual(/useState/);
  });

  it("/require\\(['\"']old-lib['\"]\\)/ → old-lib", () => {
    const r = buildApiQuery("/require\\(['\"]old-lib['\"]\\)/");
    expect(r.apiQuery).toBe("old-lib");
    expect(r.regexFilter).not.toBeNull();
  });
});

describe("buildApiQuery — top-level alternation → OR", () => {
  it("/TODO|FIXME|HACK/ → TODO OR FIXME OR HACK", () => {
    const r = buildApiQuery("/TODO|FIXME|HACK/");
    expect(r.apiQuery).toBe("TODO OR FIXME OR HACK");
    expect(r.regexFilter).toEqual(/TODO|FIXME|HACK/);
    expect(r.warn).toBeUndefined();
  });

  it("/a|bc/ — short branches (< 3 chars each) fall back to longest literal and warn", () => {
    // branches: "a" (1 char) and "bc" (2 chars) — both < 3 → fall back to
    // longestLiteralSequence("a|bc") → "bc" (2 chars) < 3 → warn + empty term
    const r = buildApiQuery("/a|bc/");
    expect(r.warn).toBeDefined();
    expect(r.apiQuery).toBe("");
    expect(r.regexFilter).not.toBeNull();
  });

  it("/\\\\|foo/ — escaped backslash before | → | is top-level → falls back to longest literal 'foo'", () => {
    // Pattern \\|foo: \\ is an escaped backslash (matches literal \), | is top-level.
    // splitTopLevelAlternation gives ["\\", "foo"]; "\\" yields no useful literal
    // so branchTerms fails the every->=1 check and we fall back to longestLiteralSequence.
    const r = buildApiQuery("/\\\\|foo/");
    expect(r.apiQuery).toBe("foo");
    expect(r.regexFilter).not.toBeNull();
  });
});

describe("buildApiQuery — partial alternation falls back to longest literal", () => {
  it("/(import|require).*someLongLib/ → someLongLib", () => {
    const r = buildApiQuery("/(import|require).*someLongLib/");
    // The alternation is nested inside (...) — not top-level — so we fall back
    // to the longest contiguous literal sequence: "someLongLib".
    expect(r.apiQuery).toBe("someLongLib");
    expect(r.regexFilter).not.toBeNull();
  });
});

describe("buildApiQuery — qualifier preservation", () => {
  it("filename:package.json /['\"axios['\"]:/ → filename:package.json axios", () => {
    const r = buildApiQuery("filename:package.json /['\"]axios['\"]:/");
    expect(r.apiQuery).toBe("filename:package.json axios");
    expect(r.regexFilter).not.toBeNull();
    expect(r.warn).toBeUndefined();
  });

  it("preserves free-text terms alongside the regex token", () => {
    const r = buildApiQuery("useFeatureFlag NOT deprecated /pattern/i");
    expect(r.apiQuery).toBe("useFeatureFlag NOT deprecated pattern");
    expect(r.regexFilter).not.toBeNull();
  });

  it("preserves language: qualifier", () => {
    const r = buildApiQuery("language:TypeScript /useState/");
    expect(r.apiQuery).toBe("language:TypeScript useState");
  });

  it("preserves path: qualifier", () => {
    const r = buildApiQuery("path:src/ /useState/");
    expect(r.apiQuery).toBe("path:src/ useState");
  });
});

describe("buildApiQuery — flags", () => {
  it("/pattern/i → compiles with i flag", () => {
    const r = buildApiQuery("/pattern/i");
    expect(r.apiQuery).toBe("pattern");
    expect(r.regexFilter?.flags).toContain("i");
  });

  it("/pattern/s → s (dotAll) flag recognized and preserved", () => {
    // s is a valid JS RegExp flag (dotAll) — must be tokenized correctly
    // so the /pattern/s token is replaced in the API query (not left as-is).
    const r = buildApiQuery("/pattern/s");
    expect(r.apiQuery).toBe("pattern");
    expect(r.regexFilter).not.toBeNull();
    expect(r.regexFilter?.flags).toContain("s");
  });

  it("/pattern/gi → g flag stripped, i kept", () => {
    const r = buildApiQuery("/pattern/gi");
    expect(r.regexFilter?.flags).not.toContain("g");
    expect(r.regexFilter?.flags).toContain("i");
  });

  it("/pattern/iy → y (sticky) flag stripped, i kept", () => {
    const r = buildApiQuery("/pattern/iy");
    expect(r.regexFilter?.flags).not.toContain("y");
    expect(r.regexFilter?.flags).toContain("i");
  });
});

describe("buildApiQuery — special escape handling in longestLiteralSequence", () => {
  it("/\\buseState\\b/ → useState (word-boundary escapes do not contaminate the term)", () => {
    // Regression: \b is a regex assertion, not the letter 'b'.
    // The sequence must be broken at \b so 'useState' is extracted, not 'buseStateb'.
    const r = buildApiQuery("/\\buseState\\b/");
    expect(r.apiQuery).toBe("useState");
    expect(r.regexFilter).not.toBeNull();
  });

  it("/\\d+\\.\\d+/ → empty term + warn (\\d and \\. are not literals)", () => {
    const r = buildApiQuery("/\\d+\\.\\d+/");
    expect(r.apiQuery).toBe("");
    expect(r.warn).toBeDefined();
  });

  it("/foobar\\sxyz/ → foobar (\\s breaks the sequence, longer prefix wins)", () => {
    const r = buildApiQuery("/foobar\\sxyz/");
    expect(r.apiQuery).toBe("foobar");
  });
});

describe("buildApiQuery — warn cases", () => {
  it("/[~^]?[0-9]+\\.[0-9]+/ → empty term + warn", () => {
    const r = buildApiQuery("/[~^]?[0-9]+\\.[0-9]+/");
    expect(r.apiQuery).toBe("");
    expect(r.regexFilter).not.toBeNull();
    expect(r.warn).toBeDefined();
  });

  it("/[/ (invalid regex) → empty term + warn + null filter", () => {
    const r = buildApiQuery("/[/");
    expect(r.apiQuery).toBe("");
    expect(r.regexFilter).toBeNull();
    expect(r.warn).toBeDefined();
  });
});
