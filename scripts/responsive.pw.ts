/**
 * Responsive tests — no horizontal overflow at mobile/tablet viewports.
 *
 * For each (viewport × page) pair the test:
 *  1. Sets the viewport size.
 *  2. Loads the page and waits for network idle.
 *  3. Asserts no element bleeds past the right edge of the viewport in a way
 *     that would cause a PAGE-LEVEL horizontal scrollbar.
 *
 * On failure: a full-page screenshot is saved to
 *   test-results/screenshots/<test-name>.png  (gitignored)
 *
 * Run from the repo root, with the preview server already started:
 *   bun run docs:test:responsive
 */
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// ── Viewports to test ──────────────────────────────────────────────────────
const VIEWPORTS = [
  { label: "iPhone SE", width: 375, height: 667 },
  { label: "iPhone 14", width: 390, height: 844 },
  { label: "Galaxy S21", width: 360, height: 800 },
  { label: "Tablet portrait", width: 768, height: 1024 },
] as const;

// ── Pages to test ──────────────────────────────────────────────────────────
const PATHS = [
  "/github-code-search/",
  "/github-code-search/getting-started/installation/",
  "/github-code-search/getting-started/first-search/",
  "/github-code-search/reference/cli-options/",
  "/github-code-search/usage/interactive-mode/",
] as const;

// ── Screenshot helper ──────────────────────────────────────────────────────

/**
 * Saves a full-page screenshot to test-results/screenshots/<safe-name>.png.
 * Called after assertion failure so the image shows the broken layout.
 */
async function saveScreenshot(page: Page, testInfo: TestInfo): Promise<void> {
  const dir = path.resolve("test-results", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  // Sanitise the test title into a valid filename
  const safeName = testInfo.title.replace(/[^\w-]/g, "_").substring(0, 120);
  const filePath = path.join(dir, `${safeName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  // Attach so it shows up in the Playwright HTML report too
  await testInfo.attach("screenshot", {
    path: filePath,
    contentType: "image/png",
  });
  console.log(`  Screenshot saved: ${filePath}`);
}

// ── Overflow detection ─────────────────────────────────────────────────────

interface OverflowHit {
  selector: string;
  overflow: number;
}

/**
 * Returns the top offending elements whose right edge exceeds the viewport
 * width and are NOT contained by any scrolling/clipping/fixed ancestor.
 *
 * Containment rules — an element is NOT a page-level overflow contributor when:
 *  1. Any ancestor has overflow-x ≠ 'visible' (hidden, clip, auto, scroll):
 *     the overflow is consumed inside that scroll container, not the page.
 *  2. Any ancestor is `position: fixed`: fixed containers are isolated from
 *     the page scroll. Their children can overflow the container but NEVER add
 *     to the document's horizontal scroll width (e.g. VitePress sticky navbar
 *     flyout menus at narrow-tablet breakpoints).
 *  3. The element itself is `position: fixed` (same reasoning).
 *  4. The element is invisible (`visibility: hidden` covers closed VitePress
 *     flyout panels that stay in the DOM but are not rendered).
 */
async function findOverflowingElements(page: Page): Promise<OverflowHit[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const hits: { selector: string; overflow: number }[] = [];

    // oxlint-disable-next-line unicorn/consistent-function-scoping -- must stay inside page.evaluate()
    function isContainedByAncestor(el: Element): boolean {
      let parent = el.parentElement;
      while (parent && parent !== document.documentElement) {
        const s = window.getComputedStyle(parent);
        // Non-visible overflow-x: overflow absorbed by this scroll container
        if (s.overflowX !== "visible") return true;
        // Fixed or sticky ancestor: children live in a separate layer and
        // can never contribute to the document horizontal scroll width.
        // VitePress uses position:sticky (not fixed) for .VPNav/.VPNavBar.
        if (s.position === "fixed" || s.position === "sticky") return true;
        parent = parent.parentElement;
      }
      return false;
    }

    for (const el of document.querySelectorAll("body *")) {
      const s = window.getComputedStyle(el);
      // Skip the element itself if fixed or sticky (same isolation rule)
      if (s.position === "fixed" || s.position === "sticky") continue;
      // Skip invisible elements (closed VitePress flyout panels, etc.)
      if (s.visibility === "hidden" || s.display === "none") continue;

      if (isContainedByAncestor(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1) {
        const tag = el.tagName.toLowerCase();
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
            : "";
        hits.push({
          selector: `${tag}${cls}`,
          overflow: Math.round(rect.right - vw),
        });
      }
    }

    // Return the 5 worst offenders for a concise error message
    return hits.toSorted((a, b) => b.overflow - a.overflow).slice(0, 5);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  for (const pagePath of PATHS) {
    test(`[${vp.label} ${vp.width}px] no horizontal overflow — ${pagePath}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // domcontentloaded is enough — VitePress pages are SSR'd, layout is set
      // at HTML parse time. networkidle adds ~500ms of idle-wait per test.
      await page.goto(pagePath, { waitUntil: "domcontentloaded" });

      const offenders = await findOverflowingElements(page);

      if (offenders.length > 0) {
        await saveScreenshot(page, testInfo);
      }

      const summary = offenders.map((o) => `${o.selector} (+${o.overflow}px)`).join(", ");

      expect(
        offenders.length,
        offenders.length > 0
          ? `Horizontal overflow on ${pagePath} at ${vp.width}px viewport.\n` +
              `Offending elements: ${summary}\n` +
              `Open in DevTools: bun run docs:preview then DevTools → ${vp.width}px`
          : "",
      ).toBe(0);
    });
  }
}
