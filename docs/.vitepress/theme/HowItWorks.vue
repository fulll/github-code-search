<template>
  <section class="hiw-section">
    <div class="hiw-header">
      <h2 class="hiw-title">How it works</h2>
      <p class="hiw-subtitle">From query to structured output in three steps.</p>
    </div>

    <div class="hiw-steps">
      <!-- Step 1 -->
      <div class="hiw-step">
        <div class="hiw-step-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div class="hiw-step-content">
          <span class="hiw-step-badge">Step 1</span>
          <h3 class="hiw-step-title">Search across the org</h3>
          <p class="hiw-step-desc">
            Run a single command. GitHub Code Search API is called automatically and results are
            paginated — up to 1 000 results across all repositories in your organisation.
          </p>
        </div>
      </div>

      <div class="hiw-arrow" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>

      <!-- Step 2 -->
      <div class="hiw-step">
        <div class="hiw-step-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
            <path d="m16 15 2 2 4-4" stroke="#28c840" stroke-width="2" />
          </svg>
        </div>
        <div class="hiw-step-content">
          <span class="hiw-step-badge">Step 2</span>
          <h3 class="hiw-step-title">Triage interactively</h3>
          <p class="hiw-step-desc">
            A keyboard-driven TUI opens. Navigate repos, expand extracts, filter by file path.
            Select exactly what matters — deselect noise. Works without leaving the terminal.
          </p>
        </div>
      </div>

      <div class="hiw-arrow" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>

      <!-- Step 3 -->
      <div class="hiw-step">
        <div class="hiw-step-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13h8M8 17h5" />
          </svg>
        </div>
        <div class="hiw-step-content">
          <span class="hiw-step-badge">Step 3</span>
          <h3 class="hiw-step-title">Export &amp; replay</h3>
          <p class="hiw-step-desc">
            Press <kbd>Enter</kbd>. Get clean Markdown with GitHub links, or machine-readable JSON.
            A replay command is printed — paste it into CI to reproduce the exact selection
            non-interactively.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Section ───────────────────────────────────────────────────────────── */
.hiw-section {
  margin: 72px 0 0;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.hiw-header {
  text-align: center;
  margin-bottom: 44px;
}

.hiw-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

.hiw-subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--vp-c-text-2);
  line-height: 1.65;
}

/* ── Steps container ───────────────────────────────────────────────────── */
.hiw-steps {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Arrow connector ───────────────────────────────────────────────────── */
.hiw-arrow {
  display: flex;
  justify-content: center;
  color: rgba(153, 51, 255, 0.3);
  margin: 6px 0;
}

/* ── Step card ─────────────────────────────────────────────────────────── */
.hiw-step {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 24px 28px;
  border-radius: 14px;
  border: 1px solid rgba(153, 51, 255, 0.16);
  background: var(--vp-c-bg-soft);
  transition:
    border-color 0.22s,
    box-shadow 0.22s,
    transform 0.2s;
}

.hiw-step:hover {
  border-color: rgba(153, 51, 255, 0.36);
  box-shadow: 0 6px 28px rgba(153, 51, 255, 0.1);
  transform: translateY(-2px);
}

.dark .hiw-step {
  border-color: rgba(204, 136, 255, 0.14);
}

.dark .hiw-step:hover {
  border-color: rgba(204, 136, 255, 0.32);
  box-shadow: 0 6px 28px rgba(153, 51, 255, 0.18);
}

/* ── Icon ──────────────────────────────────────────────────────────────── */
.hiw-step-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(153, 51, 255, 0.12) 0%, rgba(153, 51, 255, 0.06) 100%);
  border: 1px solid rgba(153, 51, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-brand-1);
}

.dark .hiw-step-icon {
  background: linear-gradient(135deg, rgba(204, 136, 255, 0.12) 0%, rgba(204, 136, 255, 0.05) 100%);
  border-color: rgba(204, 136, 255, 0.2);
}

/* ── Content ───────────────────────────────────────────────────────────── */
.hiw-step-content {
  flex: 1;
  min-width: 0;
}

.hiw-step-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  margin-bottom: 4px;
}

.hiw-step-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
  border-top: none !important;
  padding-top: 0 !important;
}

.hiw-step-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

kbd {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  box-shadow: 0 1px 0 var(--vp-c-divider);
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .hiw-title {
    font-size: 22px;
  }

  .hiw-step {
    gap: 14px;
    padding: 18px 16px;
  }

  .hiw-step-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
  }

  .hiw-step-title {
    font-size: 15px;
  }

  .hiw-step-desc {
    font-size: 13px;
  }
}
</style>
