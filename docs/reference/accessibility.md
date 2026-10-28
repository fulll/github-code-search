# Documentation accessibility audits

Run the full-sitemap audit when changing documentation, theme components or the audit harness.

```bash
bun run docs:build:a11y
bun run docs:preview -- --port 4173
```

In another terminal:

```bash
# One-time local browser setup; skip when using an existing Chrome executable.
bun run playwright install chromium
bun run docs:a11y
bun run docs:test:a11y
bun run docs:test:responsive
```

## Browser and preview configuration

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chrome/Chromium executable.
The accessibility CI job uses `/usr/bin/google-chrome-stable` on Ubuntu; it does not
download another browser. Without this variable, local runs use Playwright's installed
Chromium. The browser is separate from the `node_modules` footprint.

`PLAYWRIGHT_BASE_URL` defaults to `http://localhost:4173`. `VITEPRESS_BASE` defaults to
`/github-code-search/` and must end with `/`. Set the same base during the build and
audit for versioned documentation. `docs:build:a11y` sets the sitemap hostname to
localhost. For another preview origin, build with `VITEPRESS_HOSTNAME` explicitly:

```bash
VITEPRESS_HOSTNAME=http://localhost:4174 VITEPRESS_BASE=/github-code-search/v2/ bun run docs:build
```

## Coverage and reports

The official Deque `@axe-core/playwright` adapter runs axe-core in a real browser.
`scripts/a11y.ts` scans every distinct sitemap URL with two workers sharing one
browser. It waits for Vue hydration, Mermaid rendering and fonts, rather than a fixed
sleep. Pages have isolated browser contexts and a 60-second audit deadline.

Enabled tags are `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`: WCAG
2.0/2.1/2.2 A/AA rules supported by axe. No contrast or ARIA rules are disabled.
Empty, malformed, out-of-base or unreachable sitemaps, broken pages and scanner
errors fail the audit, as do violations of any impact level.

| Report             | Contents                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `a11y-report.json` | Engine results, affected nodes, remediation links, incomplete rules, errors and duration |
| `a11y-report.md`   | Per-page violation/manual-review counts and status                                       |

CI uploads both reports, publishes a job summary and updates a sticky comment on
same-repository PRs. Fork PRs still receive artifacts and a job summary without
requiring comment-write permissions.

::: warning Automated checks are not WCAG certification
Review `incomplete` results manually. Also test keyboard navigation, focus order,
screen-reader announcements, zoom/reflow, both color schemes, and interactive
states such as search dialogs, tabs and expanded menus. The default automated audit
checks the initial desktop page state; it does not automatically exercise all
themes, viewports or interactions. See the
[Playwright accessibility guide](https://playwright.dev/docs/accessibility-testing)
and [W3C guidance on evaluating accessibility](https://www.w3.org/WAI/test-evaluate/).
:::

## Alternatives benchmark

Evaluated on 2026-10-28. All shortlisted projects showed recent maintenance;
pa11y-ci was not replaced because it was abandoned.

The sizes below are registry `dist.unpackedSize` values for the named package,
**not** its full dependency tree, browser binary or download size.

| Alternative               | Version    | Unpacked package | Integration trade-off                                                       |
| ------------------------- | ---------- | ---------------: | --------------------------------------------------------------------------- |
| pa11y-ci                  | 5.0.0      |     42,330 bytes | Adds Pa11y, HTML_CodeSniffer and a separate Puppeteer stack                 |
| **@axe-core/playwright**  | **4.14.0** | **47,795 bytes** | **Reuses existing Playwright; only runtime dependency is axe-core**         |
| Direct axe-core           | 4.14.0     |  3,430,531 bytes | No dependencies, but requires maintaining browser/frame injection ourselves |
| @axe-core/cli             | 4.14.0     |     71,507 bytes | Also adds Selenium, ChromeDriver and the WebDriver adapter                  |
| IBM accessibility-checker | 4.0.34     |  6,042,998 bytes | Adds Puppeteer, ChromeDriver, telemetry and spreadsheet reporting           |

The selected adapter also needs axe-core (3,430,531 bytes). The engine is already
used by Lighthouse; the migration moves the shared engine from 4.13 to 4.14.
Only the adapter and that engine version were introduced, with no unrelated
package upgrades. Removing pa11y-ci does **not** remove Lighthouse's Puppeteer-core.

### Measurements and limitations

Initial same-machine comparison: macOS arm64, Bun 1.4.4 canary, system Chrome
156.0.8078.48, the same built 36-page sitemap and preview server. Browser downloads,
dependency installation and the documentation build are excluded from audit timing.

| Metric                                                 |      Before |       After |
| ------------------------------------------------------ | ----------: | ----------: |
| Audit wall time, single exploratory run                |    294.76 s |    112.69 s |
| Lockfile package entries, including nested resolutions |         857 |         787 |
| Installed `node_modules`, `du -sk`                     | 610,532 KiB | 575,500 KiB |

The timing compares the original configuration (one worker, 1,500 ms fixed wait,
HTML_CodeSniffer) with axe (two workers, readiness checks). It is **not** an
engine-only comparison or a hosted-CI speed guarantee. The first axe run audited
all 36 pages but failed on newly detected search-label and Mermaid-role issues;
these were repaired rather than suppressed. Adding this guide expands the final
sitemap, so subsequent audit durations are not the same 36-page workload.
The installed-tree reduction is about 34.2 MiB (5.7%); lockfile entries are not
equivalent to unique packages. Measurements exclude browser caches.

The old `WCAG2AA` HTML_CodeSniffer configuration did not explicitly add WCAG 2.1
rules despite the workflow title. It also ignored background-image contrast
findings and F77 duplicate IDs. Different engines have different rule coverage:
axe's explicit 2.1/2.2 tags do not establish rule-for-rule HTML_CodeSniffer parity.
Static DOM-only checks cannot replace rendered contrast checks, and Lighthouse's
sampled performance audits are complementary rather than a full-sitemap substitute.

### Maintenance and sources

- [axe-core 4.14.0](https://github.com/dequelabs/axe-core/releases/tag/v4.14.0): released 2026-10-05; Deque-maintained, MPL-2.0.
- [Official Playwright adapter](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright): 4.14.0 published 2026-10-15; repository activity observed 2026-10-27.
- [pa11y-ci 5.0.0](https://github.com/pa11y/pa11y-ci/releases/tag/5.0.0): released 2026-10-05; LGPL-3.0-only.
- [Pa11y standards and runners](https://github.com/pa11y/pa11y#runners): default HTML_CodeSniffer versus optional axe.
- [IBM Equal Access](https://github.com/IBMa/equal-access): checker 4.0.34 published 2026-09-08; repository activity observed 2026-10-16; Apache-2.0.
- Package metadata and sizes: [pa11y-ci registry](https://registry.npmjs.org/pa11y-ci/5.0.0), [Playwright adapter registry](https://registry.npmjs.org/@axe-core/playwright/4.14.0), [axe-core registry](https://registry.npmjs.org/axe-core/4.14.0), [axe CLI registry](https://registry.npmjs.org/@axe-core/cli/4.14.0), [IBM checker registry](https://registry.npmjs.org/accessibility-checker/4.0.34).
