<script setup lang="ts">
import { ref } from "vue";

interface UseCase {
  id: string;
  label: string;
  headline: string;
  description: string;
  command: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "audit",
    label: "Audit a dependency",
    headline: "Which repos still import lodash?",
    description:
      "See every repository still importing a given library. Select the ones to migrate and get a Markdown checklist to paste directly into your migration issue.",
    command: `github-code-search query "from 'lodash'" --org my-org`,
  },
  {
    id: "todos",
    label: "Hunt down TODOs",
    headline: "What's blocking the next release?",
    description:
      "Surface all in-code TODOs before a release. Triage interactively, deselect noise, and output a linked list ready for your release notes.",
    command: `github-code-search query "TODO" --org my-org --exclude-repositories sandbox,archived-repo`,
  },
  {
    id: "migration",
    label: "Verify a migration",
    headline: "Is the deprecated client finally gone?",
    description:
      "Use JSON output in a CI script to assert that no repository still references a deprecated client after your migration deadline.",
    command: `github-code-search query "oldApiClient" --org my-org --output-type repo-only --format json`,
  },
  {
    id: "security",
    label: "Security sweep",
    headline: "Any hardcoded secrets in the org?",
    description:
      "Cross-repo scan for risky patterns — hardcoded secrets, unsafe evals, deprecated APIs. Export results to Markdown to attach to a security audit report.",
    command: `github-code-search query "process.env.SECRET" --org my-org`,
  },
  {
    id: "onboarding",
    label: "Understand library usage",
    headline: "Who uses useFeatureFlag, and how?",
    description:
      "Get a team-scoped view of every usage site before refactoring a shared hook or utility. Essential for onboarding or large-scale refactors.",
    command: `github-code-search query "useFeatureFlag" --org my-org --group-by-team-prefix platform/`,
  },
];

const active = ref(0);
const copied = ref(false);
const tabRefs = ref<HTMLButtonElement[]>([]);

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(USE_CASES[active.value].command);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // clipboard unavailable
  }
}

/** ARIA tabs keyboard pattern (WAI-ARIA 1.1 §3.22) */
function handleTabKeydown(e: KeyboardEvent, i: number) {
  let next: number | null = null;
  if (e.key === "ArrowRight") {
    next = (i + 1) % USE_CASES.length;
  } else if (e.key === "ArrowLeft") {
    next = (i - 1 + USE_CASES.length) % USE_CASES.length;
  } else if (e.key === "Home") {
    e.preventDefault();
    next = 0;
  } else if (e.key === "End") {
    e.preventDefault();
    next = USE_CASES.length - 1;
  }
  if (next !== null) {
    e.preventDefault();
    active.value = next;
    tabRefs.value[next]?.focus();
  }
}
</script>

<template>
  <section class="uc-section" aria-labelledby="uc-heading">
    <h2 id="uc-heading" class="uc-title">Use cases</h2>

    <div class="uc-pills" role="tablist" :aria-label="'Use cases'">
      <button
        v-for="(uc, i) in USE_CASES"
        :key="uc.id"
        :id="`uc-tab-${uc.id}`"
        :ref="(el) => (el ? (tabRefs[i] = el as HTMLButtonElement) : null)"
        class="uc-pill"
        :class="{ active: active === i }"
        role="tab"
        :aria-selected="active === i"
        :aria-controls="`uc-panel-${uc.id}`"
        :tabindex="active === i ? 0 : -1"
        @click="active = i"
        @keydown="handleTabKeydown($event, i)"
      >
        {{ uc.label }}
      </button>
    </div>

    <div class="uc-panel-wrap">
      <transition name="uc-fade" mode="out-in">
        <div
          :key="active"
          :id="`uc-panel-${USE_CASES[active].id}`"
          class="uc-panel"
          role="tabpanel"
          :aria-labelledby="`uc-tab-${USE_CASES[active].id}`"
          tabindex="0"
        >
          <p class="uc-headline">{{ USE_CASES[active].headline }}</p>
          <p class="uc-desc">{{ USE_CASES[active].description }}</p>

          <div class="uc-terminal">
            <div class="uc-terminal-bar">
              <span class="uc-dot uc-dot-red"></span>
              <span class="uc-dot uc-dot-yellow"></span>
              <span class="uc-dot uc-dot-green"></span>
              <span class="uc-terminal-label">bash</span>
              <button
                class="uc-copy-btn"
                :class="{ copied }"
                :aria-label="copied ? 'Copied!' : 'Copy to clipboard'"
                @click="copyCommand"
              >
                <span v-if="copied" class="uc-copy-text">Copied!</span>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            <div class="uc-terminal-body">
              <pre
                class="uc-code"
              ><code><span class="uc-prompt">$</span> {{ USE_CASES[active].command }}</code></pre>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </section>
</template>

<style scoped>
.uc-section {
  margin: 48px 0 0;
}

/* ── Section title ─────────────────────────────────────────────────────── */
.uc-title {
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 32px;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

/* ── Pills ─────────────────────────────────────────────────────────────── */
.uc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-bottom: 28px;
}

.uc-pill {
  padding: 8px 18px;
  border-radius: 9999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-base);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.18s,
    border-color 0.18s,
    color 0.18s,
    box-shadow 0.18s,
    transform 0.15s;
  outline: none;
}

.uc-pill:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.uc-pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  transform: translateY(-1px);
}

.uc-pill.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  box-shadow: 0 4px 18px rgba(153, 51, 255, 0.35);
}

.dark .uc-pill.active {
  /* Fix: dark-mode brand-1 (#cc88ff) gives only 2.46:1 with white text.
   * Use #9933ff (4.92:1) to satisfy WCAG AA. */
  background: #9933ff;
  color: #fff;
  box-shadow: 0 4px 18px rgba(204, 136, 255, 0.3);
}

/* ── Panel wrapper (fixe la hauteur pour éviter le saut) ──────────────── */
.uc-panel-wrap {
  min-height: 280px;
}

.uc-panel:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
  border-radius: 14px;
}

/* ── Panel ─────────────────────────────────────────────────────────────── */
.uc-panel {
  background: var(--vp-c-bg-soft);
  border: 1px solid rgba(153, 51, 255, 0.18);
  border-radius: 14px;
  padding: 28px 32px;
  max-width: 760px;
  margin: 0 auto;
}

.dark .uc-panel {
  border-color: rgba(204, 136, 255, 0.16);
}

/* ── Description ───────────────────────────────────────────────────────── */
.uc-headline {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
}

.uc-desc {
  margin: 0 0 20px;
  padding-left: 14px;
  border-left: 3px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-2);
  font-size: 15.5px;
  line-height: 1.75;
  font-style: italic;
}

/* ── Terminal block ────────────────────────────────────────────────────── */
.uc-terminal {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #0d0d14;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}

.uc-terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  background: #1a1a26;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  user-select: none;
  flex-shrink: 0;
}

.uc-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
}

.uc-dot-red {
  background: #ff5f57;
}
.uc-dot-yellow {
  background: #febc2e;
}
.uc-dot-green {
  background: #28c840;
}

.uc-terminal-label {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
}

.uc-terminal-body {
  min-height: 80px;
  display: flex;
  align-items: center;
  padding: 0;
}

.uc-code {
  margin: 0;
  padding: 20px 22px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.6;
  background: transparent;
  width: 100%;
}

.uc-code code {
  font-family: var(--vp-font-family-mono);
  color: #c9b3ff;
  background: transparent;
}

.uc-prompt {
  color: #28c840;
  margin-right: 8px;
  font-weight: 700;
}

/* ── Copy button ───────────────────────────────────────────────────────── */
.uc-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* fixed dimensions — prevents layout shift when switching icon ↔ "Copied!" */
  width: 68px;
  height: 22px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-family: var(--vp-font-family-base);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  outline: none;
}

.uc-copy-btn:focus-visible {
  outline: 2px solid #cc88ff;
  outline-offset: 2px;
}

.uc-copy-btn:hover {
  background: rgba(153, 51, 255, 0.2);
  border-color: rgba(153, 51, 255, 0.4);
  color: #cc88ff;
}

.uc-copy-btn.copied {
  background: rgba(40, 200, 64, 0.15);
  border-color: rgba(40, 200, 64, 0.35);
  color: #28c840;
}

.uc-copy-text {
  font-size: 11px;
  font-weight: 500;
}

/* ── Fade transition — cross-fade pur, pas de translateY ──────────────── */
.uc-fade-enter-active {
  transition: opacity 0.2s ease;
}

.uc-fade-leave-active {
  transition: opacity 0.12s ease;
}

.uc-fade-enter-from,
.uc-fade-leave-to {
  opacity: 0;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .uc-panel {
    padding: 18px 14px;
  }

  .uc-pill {
    font-size: 13px;
    padding: 6px 12px;
  }

  .uc-title {
    font-size: 22px;
    margin: 0 0 24px;
  }

  .uc-headline {
    font-size: 16px;
  }

  .uc-desc {
    /* Reduce the left border indent so text gets more room */
    padding-left: 10px;
    font-size: 14px;
  }

  .uc-panel-wrap {
    min-height: 0; /* let content dictate height on mobile */
  }

  /*
   * The terminal block must not overflow .uc-panel.
   * `overflow: hidden` on .uc-terminal clips the rounded corners,
   * but we also need `overflow-x: auto` on the body so the command
   * can be scrolled within its container rather than pushing the page wider.
   */
  .uc-terminal {
    max-width: 100%;
  }

  .uc-terminal-body {
    overflow-x: auto;
  }

  .uc-code {
    font-size: 12px;
    padding: 14px 14px;
    /* long commands scroll horizontally inside the block */
    white-space: pre;
    overflow-x: auto;
  }
}
</style>
