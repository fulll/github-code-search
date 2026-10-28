export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export function validateSitemapUrls(locations: string[], base: string): string[] {
  const root = new URL(base);
  if (!["http:", "https:"].includes(root.protocol) || !root.pathname.endsWith("/")) {
    throw new Error(`Expected an HTTP(S) base URL ending in /, got ${base}`);
  }
  if (locations.length === 0) throw new Error("The sitemap contains no page URLs");

  return [
    ...new Set(
      locations.map((location) => {
        const url = new URL(location);
        if (
          url.origin !== root.origin ||
          !url.pathname.startsWith(root.pathname) ||
          url.username ||
          url.password
        ) {
          throw new Error(`Sitemap URL is outside the preview base: ${location}`);
        }
        return url.href;
      }),
    ),
  ];
}

export function formatSummary(
  pages: { url: string; violations: number; incomplete: number; error: string | null }[],
  error: string | null,
): string {
  const rows = pages.map((page) => {
    const pathname = new URL(page.url).pathname.replaceAll("|", "%7C");
    return `| \`${pathname}\` | ${page.violations} | ${page.incomplete} | ${page.error ? "ERROR" : page.violations ? "FAIL" : "PASS"} |`;
  });
  return [
    "## Accessibility audit — axe-core / WCAG 2.2 AA",
    "",
    `Pages scanned: ${pages.length}. ${error ? "**Audit failed: see the JSON report and job logs.**" : ""}`,
    "",
    "| Page | Violations | Incomplete rules | Status |",
    "| --- | ---: | ---: | --- |",
    ...rows,
    "",
    "Incomplete results require manual review; zero violations is not WCAG certification.",
    "Full rule details, affected nodes and operational errors are in `a11y-report.json`.",
    "",
  ].join("\n");
}
