import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "@playwright/test";
import { formatSummary, validateSitemapUrls, WCAG_TAGS } from "./a11y-utils.ts";
import { availableParallelism } from "node:os";

async function readSitemap(page: Page, base: string): Promise<string[]> {
  const response = await page.request.get(new URL("sitemap.xml", base).href, {
    failOnStatusCode: true,
    timeout: 30_000,
  });
  const locations = await page.evaluate(
    (xml) => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror") || doc.documentElement.localName !== "urlset") {
        throw new Error("Expected a valid sitemap urlset");
      }
      return Array.from(doc.documentElement.children).map((entry) => {
        const location = entry.querySelector("loc")?.textContent?.trim();
        if (entry.localName !== "url" || !location) throw new Error("Invalid sitemap URL entry");
        return location;
      });
    },
    await response.text(),
  );
  return validateSitemapUrls(locations, base);
}

async function auditPage(browser: Browser, url: string) {
  // `vitepress preview` Brotli-compresses on every request: ~5 s per page for the
  // 4 MB Mermaid chunk. Encoding is irrelevant to axe, so request raw bytes.
  const context = await browser.newContext({
    reducedMotion: "reduce",
    extraHTTPHeaders: { "Accept-Encoding": "identity" },
  });
  const page = await context.newPage();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const results = await Promise.race([
      (async () => {
        const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
        if (!response?.ok()) throw new Error(`HTTP ${response?.status()} on ${url}`);
        if (page.url() !== url) throw new Error(`Unexpected redirect: ${url} -> ${page.url()}`);
        await page.locator("#VPContent").waitFor();
        await page.waitForFunction(() => {
          const app = document.getElementById("app");
          return app && "__vue_app__" in app;
        });
        await page.waitForFunction(() => !document.querySelector(".mermaid-rendering"));
        await page.evaluate(() => document.fonts.ready);
        return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Audit timed out on ${url}`)), 60_000);
      }),
    ]);
    return { url, results, error: null };
  } catch (error) {
    return { url, results: null, error: String(error) };
  } finally {
    clearTimeout(timer);
    await context.close();
  }
}

async function runAudit(): Promise<number> {
  const started = performance.now();
  const pages: Awaited<ReturnType<typeof auditPage>>[] = [];
  let browser: Browser | undefined;
  let error: string | null = null;
  try {
    const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173";
    const base = new URL(process.env.VITEPRESS_BASE ?? "/github-code-search/", origin).href;
    // Validate before requesting the sitemap, including the trailing slash.
    validateSitemapUrls([base], base);
    const activeBrowser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    browser = activeBrowser;
    const discovery = await browser.newPage();
    const urls = await readSitemap(discovery, base);
    await discovery.close();
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        const result = await auditPage(activeBrowser, url);
        pages.push(result);
        console.log(
          `${result.error ? "ERROR" : result.results?.violations.length ? "FAIL" : "PASS"} ${url}`,
        );
        if (result.error) console.error(result.error);
        for (const violation of result.results?.violations ?? []) {
          console.error(`${violation.id}: ${violation.help} (${violation.helpUrl})`);
          for (const node of violation.nodes)
            console.error(`  ${node.target}: ${node.failureSummary}`);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(4, availableParallelism(), urls.length) }, worker),
    );
  } catch (failure) {
    error = String(failure);
    console.error(error);
  } finally {
    try {
      await browser?.close();
    } catch (failure) {
      error = String(failure);
      console.error(error);
    }
    pages.sort((a, b) => a.url.localeCompare(b.url));
    const durationMs = Math.round(performance.now() - started);
    const summary = formatSummary(
      pages.map((page) => ({
        url: page.url,
        violations: page.results?.violations.length ?? 0,
        incomplete: page.results?.incomplete.length ?? 0,
        error: page.error,
      })),
      error,
    );
    await Bun.write(
      "a11y-report.json",
      JSON.stringify({ tags: WCAG_TAGS, durationMs, error, pages }, null, 2),
    );
    await Bun.write("a11y-report.md", summary);
    console.log(`Audited ${pages.length} pages in ${(durationMs / 1000).toFixed(2)}s`);
  }
  return error ||
    pages.length === 0 ||
    pages.some((page) => page.error || page.results?.violations.length)
    ? 1
    : 0;
}

if (import.meta.main) process.exitCode = await runAudit();
