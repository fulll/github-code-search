<script setup lang="ts">
interface Row {
  feature: string;
  desc: string;
  gh: boolean;
  gcs: boolean;
  docLink?: string;
}

const ROWS: Row[] = [
  {
    feature: "Results grouped by repository",
    desc: "One block per repo instead of a flat list — fold or unfold at a glance.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/interactive-mode",
  },
  {
    feature: "Interactive TUI \u2014 navigate, select, filter",
    desc: "Arrow-key navigation, path-based filter and live selection without leaving the terminal.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/interactive-mode",
  },
  {
    feature: "Fine-grained extract selection",
    desc: "Cherry-pick individual code extracts; deselected items become \u2014exclude flags automatically.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/interactive-mode",
  },
  {
    feature: "Markdown / JSON output",
    desc: "Export clean Markdown checklists or machine-readable JSON ready for CI scripts.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/output-formats",
  },
  {
    feature: "Replay / CI command",
    desc: "Every session produces a one-liner to reproduce the exact output headlessly in CI.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/non-interactive-mode",
  },
  {
    feature: "Team-prefix grouping",
    desc: "Cluster repos by GitHub team prefix (squad-, chapter-) for org-wide triage.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/team-grouping",
  },
  {
    feature: "Syntax highlighting in terminal",
    desc: "Language-aware token colouring rendered in the TUI \u2014 no browser needed.",
    gh: false,
    gcs: true,
    docLink: "/github-code-search/usage/interactive-mode",
  },
  {
    feature: "Pagination (up to 1\u202f000 results)",
    desc: "Both tools auto-paginate the GitHub search API \u2014 up to 1\u202f000 results per query.",
    gh: true,
    gcs: true,
    docLink: "/github-code-search/reference/github-api-limits",
  },
];
</script>

<template>
  <div class="ct-wrapper">
    <h2 class="ct-title">Why not <code class="ct-title-code">gh search code</code>?</h2>
    <div class="ct-card">
      <p class="ct-intro">
        The official
        <a href="https://cli.github.com/" target="_blank" rel="noopener noreferrer">gh CLI</a>
        supports <code>gh&nbsp;search&nbsp;code</code>, but returns a
        <strong>flat paginated list</strong> — one result per line, no grouping, no interactive
        selection, no structured output. <code>github-code-search</code> is purpose-built for
        <strong>org-wide code audits and interactive triage</strong>.
      </p>
      <table class="ct-table">
        <caption class="sr-only">
          Feature comparison between gh search code and github-code-search
        </caption>
        <thead>
          <tr>
            <th class="ct-th-feature" scope="col" aria-label="Feature"></th>
            <th class="ct-th-tool" scope="col">
              <div class="ct-tool-header">
                <span class="ct-tool-name ct-tool-alt">
                  <span class="ct-name-long">gh search code</span>
                  <span class="ct-name-short">gh search</span>
                </span>
              </div>
            </th>
            <th class="ct-th-tool" scope="col">
              <div class="ct-tool-header">
                <span class="ct-tool-name ct-tool-brand">
                  <span class="ct-name-long">github-code-search</span>
                  <span class="ct-name-short">gcs</span>
                </span>
                <span class="ct-badge">Purpose-built</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ROWS" :key="row.feature" class="ct-row">
            <td class="ct-feature">
              <a v-if="row.docLink" :href="row.docLink" class="ct-feature-link">
                <span class="ct-feature-title">{{ row.feature }}</span>
                <span class="ct-feature-desc">{{ row.desc }}</span>
              </a>
              <span v-else class="ct-feature-plain">
                <span class="ct-feature-title">{{ row.feature }}</span>
                <span class="ct-feature-desc">{{ row.desc }}</span>
              </span>
            </td>
            <td class="ct-cell">
              <span v-if="row.gh" class="ct-check" role="img" aria-label="Yes"
                ><span aria-hidden="true">✓</span></span
              >
              <span v-else class="ct-cross" role="img" aria-label="No"
                ><span aria-hidden="true">✗</span></span
              >
            </td>
            <td class="ct-cell">
              <span v-if="row.gcs" class="ct-check" role="img" aria-label="Yes"
                ><span aria-hidden="true">✓</span></span
              >
              <span v-else class="ct-cross" role="img" aria-label="No"
                ><span aria-hidden="true">✗</span></span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* ── Wrapper + title ────────────────────────────────────────────────────── */
.ct-wrapper {
  margin: 64px 0 0;
}

.ct-title {
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 28px;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

.ct-title-code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.85em;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 2px 8px;
  border-radius: 6px;
}

/* ── Card container ────────────────────────────────────────────────────── */
.ct-card {
  margin: 0;
  border-radius: 14px;
  border: 1px solid rgba(153, 51, 255, 0.18);
  background: var(--vp-c-bg-soft);
  overflow: hidden;
  max-width: 760px;
  margin: 0 auto;
}

.dark .ct-card {
  border-color: rgba(204, 136, 255, 0.16);
}

/* ── Intro text ───────────────────────────────────────────────────────── */
.ct-intro {
  margin: 0;
  padding: 20px 24px 18px;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
}

.ct-intro code {
  font-size: 12.5px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 1px 5px;
  border-radius: 4px;
}

/* Fix: brand-1 (#9933ff) on yellow brand-soft blended with card-bg = ~4.2:1 (fails)
 * brand-2 (#7a1fd4) on white bg = 7.0:1 ✓ WCAG AA (light mode only) */
html:not(.dark) .ct-intro code {
  color: var(--vp-c-brand-2);
  background: rgba(122, 31, 212, 0.08);
}

.ct-intro a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Table ─────────────────────────────────────────────────────────────── */
.ct-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* ── Header ────────────────────────────────────────────────────────────── */
thead tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.ct-th-feature {
  width: 65%;
  padding: 18px 24px;
}

.ct-th-tool {
  width: 17.5%;
  padding: 18px 12px;
  text-align: center;
}

.ct-tool-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.ct-tool-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.ct-tool-alt {
  /* Fix: var(--vp-c-text-3) = 2.87:1, below WCAG AA 4.5:1. text-2 ≥ 5.4:1. */
  color: var(--vp-c-text-2);
}

.ct-tool-brand {
  color: var(--vp-c-brand-1);
}

.ct-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(153, 51, 255, 0.12);
  /* Fix: brand-1 (#9933ff) on soft purple bg = ~3.6:1 → brand-2 (#7a1fd4) = 5.2:1 ✓ WCAG AA */
  color: var(--vp-c-brand-2);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.dark .ct-badge {
  background: rgba(204, 136, 255, 0.15);
  color: var(--vp-c-brand-1);
}

/* ── Rows ──────────────────────────────────────────────────────────────── */
.ct-row {
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background 0.14s;
}

.ct-row:last-child {
  border-bottom: none;
}

.ct-row:hover {
  background: rgba(153, 51, 255, 0.04);
}

.dark .ct-row:hover {
  background: rgba(204, 136, 255, 0.05);
}

.ct-feature {
  padding: 12px 24px;
  font-size: 15px;
  color: var(--vp-c-text-1);
  line-height: 1.5;
}

.ct-feature-link,
.ct-feature-plain {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.ct-feature-link:hover {
  color: var(--vp-c-text-1);
}

.ct-feature-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 15px;
  font-weight: 600;
  color: inherit;
}

.ct-feature-desc {
  font-size: 13px;
  font-weight: 400;
  /* Fix: var(--vp-c-text-3) ≈ 2.87:1, below WCAG AA. text-1 ensures ≥4.5:1. */
  color: var(--vp-c-text-1);
  line-height: 1.45;
}

.ct-feature-link:hover .ct-feature-desc {
  color: var(--vp-c-text-2);
}

.ct-cell {
  padding: 14px 12px;
  text-align: center;
}

/* ── Check / Cross icons ───────────────────────────────────────────────── */
.ct-check,
.ct-cross {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.ct-check {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.ct-cross {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Short/long label switching — long shown by default, short on mobile */
.ct-name-short {
  display: none;
}

/* ── Responsive ────────────────────────────────────────────────────────── */

/*
 * ≤ 640 px — keep both tool columns but use abbreviated headers, drop badges
 * and descriptions, tighten padding.
 * Inspired by bun.sh's feature comparison table: 3 columns (feature + 2 tools)
 * always visible, even on 360 px — tool headers very short, icons centred.
 */
@media (max-width: 640px) {
  /* Switch to abbreviated column headers */
  .ct-name-long {
    display: none;
  }
  .ct-name-short {
    display: inline;
  }

  /* Feature col narrower, tool cols equal */
  .ct-th-feature {
    width: 56%;
    padding: 10px 12px;
  }

  .ct-th-tool {
    width: 22%;
    padding: 10px 4px;
  }

  .ct-feature {
    padding: 10px 12px;
    font-size: 13px;
  }

  .ct-cell {
    padding: 10px 4px;
  }

  .ct-tool-name {
    font-size: 11px;
    font-weight: 700;
  }

  .ct-badge {
    display: none;
  }

  /* Hide descriptions — feature title alone is sufficient at small sizes */
  .ct-feature-desc {
    display: none;
  }

  /* Slightly smaller icons so they fit the narrow cells */
  .ct-check,
  .ct-cross {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }
}
</style>
