<template>
  <section class="ts-section">
    <div class="ts-header">
      <h2 class="ts-title">What people say</h2>
      <p class="ts-subtitle">Trusted by engineering teams who live in the terminal.</p>
    </div>

    <div class="ts-grid">
      <blockquote class="ts-card" v-for="t in testimonials" :key="t.handle">
        <p class="ts-quote">{{ t.quote }}</p>
        <footer class="ts-author">
          <div class="ts-avatar" :style="{ background: t.color }" aria-hidden="true">
            {{ t.initials }}
          </div>
          <div class="ts-author-info">
            <span class="ts-name">{{ t.name }}</span>
            <span class="ts-role">{{ t.role }}</span>
          </div>
        </footer>
      </blockquote>

      <!-- CTA card -->
      <div class="ts-card ts-card-cta">
        <div class="ts-cta-icon" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p class="ts-cta-text">
          Using github-code-search in your org?<br />We'd love to hear your experience.
        </p>
        <a
          class="ts-cta-btn"
          href="https://github.com/fulll/github-code-search/discussions"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Share your story</span>
          <svg
            class="ts-cta-arrow"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M7 17L17 7M7 7h10v10" />
          </svg>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const testimonials = [
  {
    quote:
      "We use it weekly to track down deprecated patterns spread across 200+ repos. What used to take hours of grepping now takes minutes — and the replay command is gold for CI.",
    name: "Platform Engineer",
    role: "Series B tech company · 40+ repos",
    initials: "PE",
    color: "#7A1FD4",
  },
  {
    quote:
      "The per-repo grouping is exactly what was missing from gh search code. I can instantly see which teams own the code I'm looking at without context-switching to GitHub.",
    name: "Staff Engineer",
    role: "Engineering org · 120+ repos",
    initials: "SE",
    color: "#9933FF",
  },
  {
    quote:
      "We pipe the JSON output into our internal tooling to generate automated refactoring tickets. The non-interactive mode with --output-type json is a hidden gem.",
    name: "DevOps Lead",
    role: "Infrastructure team · 30+ repos",
    initials: "DL",
    color: "#CC88FF",
  },
];
</script>

<style scoped>
/* ── Section ───────────────────────────────────────────────────────────── */
.ts-section {
  margin: 80px 0 0;
  padding: 0 24px;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.ts-header {
  text-align: center;
  margin-bottom: 44px;
}

.ts-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

.ts-subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

/* ── Grid ──────────────────────────────────────────────────────────────── */
.ts-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  align-items: start;
}

/* ── Card ──────────────────────────────────────────────────────────────── */
.ts-card {
  margin: 0;
  padding: 24px;
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    transform 0.18s,
    box-shadow 0.18s,
    border-color 0.18s;
}

.ts-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(153, 51, 255, 0.14);
  border-color: rgba(153, 51, 255, 0.32);
}

.dark .ts-card:hover {
  border-color: rgba(204, 136, 255, 0.3);
  box-shadow: 0 6px 28px rgba(153, 51, 255, 0.2);
}

/* ── Quote ─────────────────────────────────────────────────────────────── */
.ts-quote {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-1);
  flex: 1;
}

.ts-quote::before {
  content: '"';
  font-size: 32px;
  line-height: 0;
  vertical-align: -0.4em;
  color: var(--vp-c-brand-1);
  margin-right: 2px;
  font-family: Georgia, serif;
  opacity: 0.6;
}

/* ── Author ────────────────────────────────────────────────────────────── */
.ts-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ts-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.03em;
}

.ts-author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ts-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.ts-role {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

/* ── CTA card ──────────────────────────────────────────────────────────── */
.ts-card-cta {
  border: 1px dashed rgba(153, 51, 255, 0.3);
  background: rgba(153, 51, 255, 0.04);
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.dark .ts-card-cta {
  border-color: rgba(204, 136, 255, 0.25);
  background: rgba(204, 136, 255, 0.04);
}

.ts-cta-icon {
  color: var(--vp-c-brand-1);
  opacity: 0.7;
}

.ts-cta-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.ts-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff !important;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none !important;
  transition:
    background 0.15s,
    box-shadow 0.15s;
}

.ts-cta-btn:hover {
  background: #7a1fd4;
  color: #fff !important;
  box-shadow: 0 4px 16px rgba(153, 51, 255, 0.35);
}

.ts-cta-arrow {
  flex-shrink: 0;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .ts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .ts-grid {
    grid-template-columns: 1fr;
  }

  .ts-title {
    font-size: 22px;
  }

  .ts-section {
    margin: 60px 0 0;
    padding: 0 16px;
  }
}
</style>
