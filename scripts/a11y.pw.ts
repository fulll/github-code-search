import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/a11y.ts");

for (const scenario of [
  "pass",
  "violation",
  "empty",
  "malformed",
  "missing-loc",
  "outside",
  "http-error",
  "sitemap-error",
  "sitemap-redirect",
]) {
  test(`audit harness: ${scenario}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "gcs-a11y-"));
    const server = createServer((request, response) => {
      if (request.url === "/docs/sitemap.xml" && scenario === "sitemap-redirect") {
        response.writeHead(301, { Location: "/docs/moved-sitemap.xml" }).end();
      } else if (request.url === "/docs/sitemap.xml" || request.url === "/docs/moved-sitemap.xml") {
        response.setHeader("Content-Type", "application/xml");
        if (scenario === "sitemap-error") {
          response.writeHead(500).end("Unavailable");
        } else if (scenario === "malformed") {
          response.end("<urlset><url>");
        } else if (scenario === "empty") {
          response.end("<urlset/>");
        } else if (scenario === "missing-loc") {
          response.end("<urlset><url/></urlset>");
        } else {
          const origin = `http://${request.headers.host}`;
          const urls =
            scenario === "outside"
              ? [`${origin}/outside.html`]
              : [`${origin}/docs/page.html`, `${origin}/docs/second.html`];
          response.end(
            `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`,
          );
        }
      } else if (scenario === "http-error") {
        response.writeHead(404).end("Not found");
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end(`<!doctype html><html lang="en"><head><title>Audit fixture</title></head>
          <body><div id="app"><main id="VPContent"><h1>Audit fixture</h1>
          ${scenario === "violation" ? '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">' : "<p>Accessible content</p>"}
          </main></div><script>document.getElementById("app").__vue_app__ = {};</script></body></html>`);
      }
    });

    try {
      await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing fixture server port");
      const logs: string[] = [];
      const child = spawn("bun", [script], {
        cwd: directory,
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${address.port}`,
          VITEPRESS_BASE: "/docs/",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
      child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
      const code = await new Promise<number | null>((done, reject) => {
        child.once("error", reject);
        child.once("close", done);
      });
      expect(code, logs.join("")).toBe(scenario === "pass" ? 0 : 1);
      const report = JSON.parse(await readFile(join(directory, "a11y-report.json"), "utf8"));
      const summary = await readFile(join(directory, "a11y-report.md"), "utf8");
      expect(summary).toContain("not WCAG certification");
      if (scenario === "pass" || scenario === "violation" || scenario === "http-error") {
        expect(report.pages).toHaveLength(2);
        expect(report.error).toBeNull();
        if (scenario === "violation") {
          expect(
            report.pages[0].results.violations.map((rule: { id: string }) => rule.id),
          ).toContain("image-alt");
          expect(summary).toContain("FAIL");
        } else if (scenario === "http-error") {
          expect(report.pages[0].error).toContain("HTTP 404");
          expect(summary).toContain("ERROR");
        } else {
          expect(
            report.pages.every(
              (page: { results: { violations: unknown[] } }) =>
                page.results.violations.length === 0,
            ),
          ).toBe(true);
          expect(summary).toContain("PASS");
        }
      } else {
        expect(report.pages).toHaveLength(0);
        expect(report.error).toBeTruthy();
        expect(summary).toContain("**Audit failed:");
      }
    } finally {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("search remains named at desktop and mobile widths", async ({ page }) => {
  const base = process.env.VITEPRESS_BASE ?? "/github-code-search/";
  await page.goto(base);
  for (const width of [1280, 375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.locator(".DocSearch")).toHaveAccessibleName(/Search/);
    await expect(page.locator(".DocSearch")).not.toHaveAttribute("aria-label");
  }
});

test("Mermaid containers retain permitted labels after client navigation", async ({ page }) => {
  const base = process.env.VITEPRESS_BASE ?? "/github-code-search/";
  await page.goto(`${base}architecture/overview.html`);
  const diagram = page.locator(".mermaid[aria-label]").first();
  await expect(diagram).toHaveAttribute("role", "group");
  await page.getByRole("link", { name: "Containers (C4 L2)", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Level 2: Containers" })).toBeVisible();
  await expect(page.locator(".mermaid[aria-label]").first()).toHaveAttribute("role", "group");
});
