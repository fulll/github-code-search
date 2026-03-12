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
    expect(isRegexQuery('filename:package.json /["\'"]axios["\'"]:/'));
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
});

// ─── buildApiQuery ────────────────────────────────────────────────────────────

describe("buildApiQuery — plain text passthrough", () => {
  it("returns input unchanged when no regex token", () => {
    const r = buildApiQuery("plain text query");
    expect(r.apiQuery).toBe("plain text query");
    expect(r.regexFilter).toBeNull();
    expect(r.warn).toBeUndefined();
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
  it('filename:package.json /[\'"]axios[\'"]:\\s*"/ → filename:package.json axios', () => {
    const r = buildApiQuery("filename:package.json /['\"]axios['\"]:/");
    expect(r.apiQuery).toBe("filename:package.json axios");
    expect(r.regexFilter).not.toBeNull();
    expect(r.warn).toBeUndefined();
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

  it("/pattern/gi → g flag stripped, i kept", () => {
    const r = buildApiQuery("/pattern/gi");
    expect(r.regexFilter?.flags).not.toContain("g");
    expect(r.regexFilter?.flags).toContain("i");
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
