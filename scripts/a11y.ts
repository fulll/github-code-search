import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "@playwright/test";
import { formatSummary, validateSitemapUrls, WCAG_TAGS } from "./a11y-utils.ts";
import { availableParallelism } from "node:os";

async function readSitemap(page: Page, base: string): Promise<string[]> {
  const url = new URL("sitemap.xml", base).href;
  // Redirects are not followed: a moved sitemap must fail like any other non-2xx.
  const response = await page.request.get(url, { maxRedirects: 0, timeout: 30_000 });
  if (!response.ok()) throw new Error(`HTTP ${response.status()} on ${url}`);
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

// `vitepress preview` Brotli-compresses on every request (~5 s for the 4 MB Mermaid
// chunk). Encoding is irrelevant to axe, so request raw bytes.
const newAuditContext = (browser: Browser) =>
  browser.newContext({
    reducedMotion: "reduce",
    extraHTTPHeaders: { "Accept-Encoding": "identity" },
  });

async function auditPage(page: Page, url: string) {
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
        // Mermaid is lazy-loaded: wait until every visible diagram is rendered.
        // Off-screen blocks stay as source until scrolled into view (200px margin).
        await page.waitForFunction(
          () =>
            !document.querySelector(".mermaid-rendering") &&
            Array.from(document.querySelectorAll("div.language-mermaid")).every(
              (block) =>
                block.querySelector(".mermaid svg") ||
                (block.querySelector("pre[data-mermaid-processed]") &&
                  block.getBoundingClientRect().top >= innerHeight + 200),
            ),
        );
        await page.evaluate(() => document.fonts.ready);
        // options() replaces runOnly, so it must come before withTags().
        return new AxeBuilder({ page })
          .options({ resultTypes: ["violations", "incomplete"] })
          .withTags(WCAG_TAGS)
          .analyze();
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
    // One context per worker: navigations reuse the HTTP and V8 code caches
    // (~4x faster page loads). A fresh context replaces it after any error.
    const worker = async () => {
      let context = await newAuditContext(activeBrowser);
      let page = await context.newPage();
      while (next < urls.length) {
        const url = urls[next++];
        const result = await auditPage(page, url);
        pages.push(result);
        if (result.error) {
          await context.close().catch(() => {});
          context = await newAuditContext(activeBrowser);
          page = await context.newPage();
        }
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
      await context.close();
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
