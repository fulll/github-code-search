<script setup lang="ts">
interface Row {
  feature: string;
  gh: boolean;
  gcs: boolean;
}

const ROWS: Row[] = [
  { feature: "Results grouped by repository", gh: false, gcs: true },
  { feature: "Interactive TUI — navigate, select, filter", gh: false, gcs: true },
  { feature: "Fine-grained extract selection", gh: false, gcs: true },
  { feature: "Markdown / JSON output", gh: false, gcs: true },
  { feature: "Replay / CI command", gh: false, gcs: true },
  { feature: "Team-prefix grouping", gh: false, gcs: true },
  { feature: "Syntax highlighting in terminal", gh: false, gcs: true },
  { feature: "Pagination (up to 1 000 results)", gh: true, gcs: true },
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
        <thead>
          <tr>
            <th class="ct-th-feature"></th>
            <th class="ct-th-tool">
              <div class="ct-tool-header">
                <span class="ct-tool-name ct-tool-alt">gh search code</span>
              </div>
            </th>
            <th class="ct-th-tool">
              <div class="ct-tool-header">
                <span class="ct-tool-name ct-tool-brand">github-code-search</span>
                <span class="ct-badge">Purpose-built</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ROWS" :key="row.feature" class="ct-row">
            <td class="ct-feature">{{ row.feature }}</td>
            <td class="ct-cell">
              <span v-if="row.gh" class="ct-check">✓</span>
              <span v-else class="ct-cross">✗</span>
            </td>
            <td class="ct-cell">
              <span v-if="row.gcs" class="ct-check">✓</span>
              <span v-else class="ct-cross">✗</span>
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
  font-size: 14px;
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
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.ct-tool-alt {
  color: var(--vp-c-text-3);
}

.ct-tool-brand {
  color: var(--vp-c-brand-1);
}

.ct-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(153, 51, 255, 0.12);
  color: var(--vp-c-brand-1);
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
  padding: 14px 24px;
  font-size: 14px;
  color: var(--vp-c-text-1);
  line-height: 1.5;
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

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .ct-th-feature {
    width: 55%;
    padding: 14px 14px;
  }

  .ct-th-tool {
    width: 22.5%;
    padding: 14px 8px;
  }

  .ct-feature {
    padding: 12px 14px;
    font-size: 13px;
  }

  .ct-tool-name {
    font-size: 11px;
  }

  .ct-badge {
    display: none;
  }
}
</style>
