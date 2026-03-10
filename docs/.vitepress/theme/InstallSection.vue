<script setup lang="ts">
import { ref, computed } from "vue";
import { withBase } from "vitepress";

const CURL_CMD =
  "curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash";
const PS_CMD =
  'powershell -c "irm https://raw.githubusercontent.com/fulll/github-code-search/main/install.ps1 | iex"';
const SEARCH_CMD = 'github-code-search query "TODO" --org my-org';

type Platform = "unix" | "windows";
const platform = ref<Platform>("unix");

const copiedInstall = ref(false);
const copiedVerify = ref(false);

const installCmd = computed(() => (platform.value === "unix" ? CURL_CMD : PS_CMD));
const shellLabel = computed(() => (platform.value === "unix" ? "bash" : "powershell"));
const tokenLine = computed(() =>
  platform.value === "unix"
    ? { kw: "export", value: " GITHUB_TOKEN=ghp_your_token_here" }
    : { kw: "$env:", value: 'GITHUB_TOKEN = "ghp_your_token_here"' },
);

async function copy(text: string, target: "install" | "verify") {
  try {
    await navigator.clipboard.writeText(text);
    if (target === "install") {
      copiedInstall.value = true;
      setTimeout(() => {
        copiedInstall.value = false;
      }, 2000);
    } else {
      copiedVerify.value = true;
      setTimeout(() => {
        copiedVerify.value = false;
      }, 2000);
    }
  } catch {
    /* clipboard unavailable */
  }
}

function copyInstall() {
  copy(installCmd.value, "install");
}
function copySearch() {
  copy(SEARCH_CMD, "verify");
}
</script>

<template>
  <section class="is-section" aria-labelledby="install-section-title">
    <div class="is-header">
      <h2 id="install-section-title" class="is-title">Get up and running in 30 seconds</h2>
      <p class="is-subtitle">
        One command. Auto-detects your OS and architecture.<br />
        Works on macOS, Linux, and Windows.
      </p>
      <div class="is-compat" aria-label="Supported shells and platforms">
        <span class="is-compat-label">Works with</span>
        <div class="is-compat-badges">
          <span class="is-compat-badge">zsh</span>
          <span class="is-compat-badge">bash</span>
          <span class="is-compat-badge">fish</span>
          <span class="is-compat-badge">PowerShell</span>
          <span class="is-compat-sep" aria-hidden="true"></span>
          <span class="is-compat-badge">macOS</span>
          <span class="is-compat-badge">Linux</span>
          <span class="is-compat-badge">Windows</span>
          <span class="is-compat-sep" aria-hidden="true"></span>
          <span class="is-compat-badge is-compat-ci">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"
              />
            </svg>
            GitHub Actions
          </span>
        </div>
      </div>
    </div>

    <div class="is-platform-tabs" role="group" aria-label="Select platform">
      <button
        class="is-platform-tab"
        :class="{ active: platform === 'unix' }"
        :aria-pressed="platform === 'unix'"
        @click="platform = 'unix'"
      >
        macOS / Linux
      </button>
      <button
        class="is-platform-tab"
        :class="{ active: platform === 'windows' }"
        :aria-pressed="platform === 'windows'"
        @click="platform = 'windows'"
      >
        Windows
      </button>
    </div>

    <div class="is-steps">
      <!-- Step 1: Install -->
      <div class="is-step">
        <div class="is-step-num" aria-hidden="true">1</div>
        <div class="is-step-body">
          <h3 class="is-step-label"><span class="sr-only">Step 1: </span>Install the binary</h3>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red" aria-hidden="true"></span>
              <span class="is-dot is-dot-yellow" aria-hidden="true"></span>
              <span class="is-dot is-dot-green" aria-hidden="true"></span>
              <span class="is-terminal-title" aria-hidden="true">{{ shellLabel }}</span>
              <button
                class="is-copy-btn"
                :class="{ copied: copiedInstall }"
                @click="copyInstall"
                :aria-label="copiedInstall ? 'Copied!' : 'Copy to clipboard'"
              >
                <span v-if="copiedInstall" class="is-copy-label">Copied!</span>
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
            <pre
              class="is-code"
            ><code><span class="is-prompt">{{ platform === 'windows' ? '>' : '$' }}</span> {{ installCmd }}</code></pre>
          </div>
        </div>
      </div>

      <div class="is-connector" aria-hidden="true"></div>

      <!-- Step 2: Export token -->
      <div class="is-step">
        <div class="is-step-num" aria-hidden="true">2</div>
        <div class="is-step-body">
          <h3 class="is-step-label">
            <span class="sr-only">Step 2: </span>Export your GitHub token
          </h3>
          <div class="is-token-hint">
            <svg
              class="is-info-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Requires a GitHub token with <code>repo</code> scope (read-only).
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=github-code-search"
              target="_blank"
              rel="noopener noreferrer"
              >Generate one ↗</a
            >
          </div>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red" aria-hidden="true"></span>
              <span class="is-dot is-dot-yellow" aria-hidden="true"></span>
              <span class="is-dot is-dot-green" aria-hidden="true"></span>
              <span class="is-terminal-title" aria-hidden="true">{{ shellLabel }}</span>
            </div>
            <pre
              class="is-code"
            ><code><span class="is-prompt">{{ platform === 'windows' ? '>' : '$' }}</span> <span class="is-kw">{{ tokenLine.kw }}</span><span class="is-str">{{ tokenLine.value }}</span></code></pre>
          </div>
        </div>
      </div>

      <div class="is-connector" aria-hidden="true"></div>

      <!-- Step 3: Run -->
      <div class="is-step">
        <div class="is-step-num" aria-hidden="true">3</div>
        <div class="is-step-body">
          <h3 class="is-step-label"><span class="sr-only">Step 3: </span>Run your first search</h3>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red" aria-hidden="true"></span>
              <span class="is-dot is-dot-yellow" aria-hidden="true"></span>
              <span class="is-dot is-dot-green" aria-hidden="true"></span>
              <span class="is-terminal-title" aria-hidden="true">{{ shellLabel }}</span>
              <button
                class="is-copy-btn"
                :class="{ copied: copiedVerify }"
                @click="copySearch"
                :aria-label="copiedVerify ? 'Copied!' : 'Copy to clipboard'"
              >
                <span v-if="copiedVerify" class="is-copy-label">Copied!</span>
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
            <pre
              class="is-code"
            ><code><span class="is-prompt">{{ platform === 'windows' ? '>' : '$' }}</span> github-code-search query <span class="is-str">"TODO"</span> --org my-org</code></pre>
          </div>
        </div>
      </div>
    </div>

    <div class="is-footer">
      <a :href="withBase('/getting-started/installation/')" class="is-link-full">
        Full installation guide →
      </a>
    </div>
  </section>
</template>

<style scoped>
/* ── Section ───────────────────────────────────────────────────────────── */
.is-section {
  margin: 72px 0 0;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.is-header {
  text-align: center;
  margin-bottom: 44px;
}

.is-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

.is-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--vp-c-text-2);
  line-height: 1.65;
}

/* ── Steps ─────────────────────────────────────────────────────────────── */
.is-steps {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.is-step {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.is-connector {
  width: 2px;
  height: 24px;
  background: linear-gradient(to bottom, rgba(153, 51, 255, 0.3), rgba(153, 51, 255, 0.15));
  margin-left: 19px; /* center under the step number circle (20px margin + 20px radius) */
}

/* ── Step number ───────────────────────────────────────────────────────── */
.is-step-num {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #9933ff 0%, #7a1fd4 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 14px rgba(153, 51, 255, 0.35);
}

/* ── Step body ─────────────────────────────────────────────────────────── */
.is-step-body {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.is-step-label {
  margin: 8px 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

/* ── Token hint ────────────────────────────────────────────────────────── */
.is-token-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 7px;
  background: rgba(153, 51, 255, 0.06);
  border: 1px solid rgba(153, 51, 255, 0.15);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.dark .is-token-hint {
  background: rgba(204, 136, 255, 0.07);
  border-color: rgba(204, 136, 255, 0.14);
}

.is-info-icon {
  flex-shrink: 0;
  color: var(--vp-c-brand-1);
}

.is-token-hint code {
  font-size: 12px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 1px 5px;
  border-radius: 4px;
}

.is-token-hint a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.is-token-hint a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Terminal ──────────────────────────────────────────────────────────── */
.is-terminal {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: #0d0d14;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.28);
}

.is-terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  background: #1a1a26;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  user-select: none;
}

.is-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
}

.is-dot-red {
  background: #ff5f57;
}
.is-dot-yellow {
  background: #febc2e;
}
.is-dot-green {
  background: #28c840;
}

.is-terminal-title {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  /* Fix: rgba(.35) = ~3.1:1 on #1a1a26 → rgba(.55) = 6.4:1 ✓ WCAG AA */
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.04em;
}

.is-code {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  background: transparent;
}

.is-code code {
  font-family: var(--vp-font-family-mono);
  color: #c9b3ff;
  background: transparent;
  white-space: pre-wrap;
  word-break: break-all;
}

.is-prompt {
  color: #28c840;
  margin-right: 8px;
  font-weight: 700;
}

.is-kw {
  color: #cc88ff;
}
.is-str {
  color: #ffcc33;
}

/* ── Copy button ───────────────────────────────────────────────────────── */
.is-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.is-copy-btn:focus-visible {
  outline: 2px solid #cc88ff;
  outline-offset: 2px;
}

.is-copy-btn:hover {
  background: rgba(153, 51, 255, 0.2);
  border-color: rgba(153, 51, 255, 0.4);
  color: #cc88ff;
}

.is-copy-btn.copied {
  background: rgba(40, 200, 64, 0.15);
  border-color: rgba(40, 200, 64, 0.35);
  color: #28c840;
}

.is-copy-label {
  font-size: 11px;
  font-weight: 500;
}

/* ── Footer link ───────────────────────────────────────────────────────── */
.is-footer {
  text-align: center;
  margin-top: 32px;
}

.is-link-full {
  display: inline-block;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s;
}

.is-link-full:hover {
  border-color: var(--vp-c-brand-1);
}

/* ── Compatibility badges ──────────────────────────────────────────────── */
.is-compat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.is-compat-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

.is-compat-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.is-compat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
  font-weight: 500;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
}

.is-compat-ci {
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-2);
}

.is-compat-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--vp-c-divider);
  flex-shrink: 0;
}

/* ── Platform tabs ─────────────────────────────────────────────────────── */
.is-platform-tabs {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 28px;
}

.is-platform-tab {
  padding: 6px 18px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.is-platform-tab:hover {
  background: rgba(153, 51, 255, 0.08);
  border-color: rgba(153, 51, 255, 0.25);
  color: var(--vp-c-text-1);
}

.is-platform-tab.active {
  background: rgba(153, 51, 255, 0.12);
  border-color: rgba(153, 51, 255, 0.4);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .is-title {
    font-size: 22px;
  }

  .is-subtitle {
    font-size: 14px;
  }

  .is-step-num {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .is-connector {
    margin-left: 15px;
  }

  /* Terminal blocks: ensure they never overflow the section */
  .is-terminal {
    max-width: 100%;
  }

  .is-code {
    font-size: 11.5px;
    /* long commands scroll horizontally inside the terminal block */
    overflow-x: auto;
  }

  .is-code code {
    /* wrap on very small screens as fallback for users who prefer no scroll */
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
