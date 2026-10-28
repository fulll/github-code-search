import { describe, expect, it } from "bun:test";
import { formatSummary, validateSitemapUrls, WCAG_TAGS } from "./a11y-utils.ts";

describe("accessibility sitemap scope", () => {
  const base = "http://localhost:4173/github-code-search/";

  it("keeps all distinct pages, including versioned paths and encoded URLs", () => {
    const urls = [base, `${base}reference/cli.html`, `${base}v1/a%20b.html?x=1&y=2`];
    expect(validateSitemapUrls([...urls, base], base)).toEqual(urls);
  });

  it("supports a versioned documentation base", () => {
    expect(validateSitemapUrls([`${base}v2/page.html`], `${base}v2/`)).toEqual([
      `${base}v2/page.html`,
    ]);
  });

  it("fails closed on an empty sitemap", () => {
    expect(() => validateSitemapUrls([], base)).toThrow("no page URLs");
  });

  it.each([
    "https://example.com/github-code-search/page.html",
    "http://localhost:4173/github-code-search-other/page.html",
    "http://localhost:4173/github-code-search/../page.html",
    "http://user:password@localhost:4173/github-code-search/",
    "file:///github-code-search/page.html",
    "not a URL",
  ])("rejects out-of-scope or invalid sitemap URL %s", (url) => {
    expect(() => validateSitemapUrls([url], base)).toThrow();
  });

  it.each(["file:///docs/", "http://localhost:4173/docs"])("rejects invalid base %s", (url) => {
    expect(() => validateSitemapUrls([url], url)).toThrow();
  });

  it("runs WCAG A/AA tags through 2.2 without disabling contrast or ARIA", () => {
    expect(WCAG_TAGS).toEqual(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  });
});

describe("accessibility summary", () => {
  it("distinguishes violations, manual review and operational errors", () => {
    const report = formatSummary(
      [
        { url: "http://localhost/pass", violations: 0, incomplete: 1, error: null },
        { url: "http://localhost/fail", violations: 2, incomplete: 0, error: null },
        { url: "http://localhost/error", violations: 0, incomplete: 0, error: "HTTP 404" },
      ],
      null,
    );
    expect(report).toContain("| `/pass` | 0 | 1 | PASS |");
    expect(report).toContain("| `/fail` | 2 | 0 | FAIL |");
    expect(report).toContain("| `/error` | 0 | 0 | ERROR |");
    expect(report).toContain("not WCAG certification");
    expect(report).toContain("a11y-report.json");
  });

  it("reports startup failures without presenting an empty audit as success", () => {
    expect(formatSummary([], "Malformed sitemap")).toContain("**Audit failed:");
  });

  it("escapes table delimiters in URL paths", () => {
    expect(
      formatSummary(
        [{ url: "http://localhost/a|b", violations: 0, incomplete: 0, error: null }],
        null,
      ),
    ).toContain("`/a%7Cb`");
  });
});
