<script setup lang="ts">
import { ref } from "vue";

const CURL_CMD = "curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash";
const VERIFY_CMD = "github-code-search --version";
const SEARCH_CMD = 'github-code-search query "TODO" --org my-org';

const copiedInstall = ref(false);
const copiedVerify = ref(false);

async function copy(text: string, target: "install" | "verify") {
  try {
    await navigator.clipboard.writeText(text);
    if (target === "install") {
      copiedInstall.value = true;
      setTimeout(() => { copiedInstall.value = false; }, 2000);
    } else {
      copiedVerify.value = true;
      setTimeout(() => { copiedVerify.value = false; }, 2000);
    }
  } catch { /* clipboard unavailable */ }
}

function copyInstall() { copy(CURL_CMD, "install"); }
function copySearch()  { copy(SEARCH_CMD, "verify"); }
</script>

<template>
  <section class="is-section">
    <div class="is-header">
      <h2 class="is-title">Get up and running in 30 seconds</h2>
      <p class="is-subtitle">
        One command. Auto-detects your OS and architecture.<br>
        Works on macOS, Linux, and Windows (Git Bash / MSYS2).
      </p>
    </div>

    <div class="is-steps">
      <!-- Step 1: Install -->
      <div class="is-step">
        <div class="is-step-num">1</div>
        <div class="is-step-body">
          <p class="is-step-label">Install the binary</p>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red"></span>
              <span class="is-dot is-dot-yellow"></span>
              <span class="is-dot is-dot-green"></span>
              <span class="is-terminal-title">bash</span>
              <button
                class="is-copy-btn"
                :class="{ copied: copiedInstall }"
                @click="copyInstall"
                :aria-label="copiedInstall ? 'Copied!' : 'Copy to clipboard'"
              >
                <span v-if="copiedInstall" class="is-copy-label">Copied!</span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <pre class="is-code"><code><span class="is-prompt">$</span> {{ CURL_CMD }}</code></pre>
          </div>
        </div>
      </div>

      <div class="is-connector" aria-hidden="true"></div>

      <!-- Step 2: Export token -->
      <div class="is-step">
        <div class="is-step-num">2</div>
        <div class="is-step-body">
          <p class="is-step-label">Export your GitHub token</p>
          <div class="is-token-hint">
            <svg class="is-info-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            Requires a GitHub token with <code>repo</code> scope (read-only).
            <a href="https://github.com/settings/tokens/new?scopes=repo&description=github-code-search" target="_blank" rel="noopener noreferrer">Generate one ↗</a>
          </div>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red"></span>
              <span class="is-dot is-dot-yellow"></span>
              <span class="is-dot is-dot-green"></span>
              <span class="is-terminal-title">bash</span>
            </div>
            <pre class="is-code"><code><span class="is-prompt">$</span> <span class="is-kw">export</span> GITHUB_TOKEN=<span class="is-str">ghp_your_token_here</span></code></pre>
          </div>
        </div>
      </div>

      <div class="is-connector" aria-hidden="true"></div>

      <!-- Step 3: Run -->
      <div class="is-step">
        <div class="is-step-num">3</div>
        <div class="is-step-body">
          <p class="is-step-label">Run your first search</p>
          <div class="is-terminal">
            <div class="is-terminal-bar">
              <span class="is-dot is-dot-red"></span>
              <span class="is-dot is-dot-yellow"></span>
              <span class="is-dot is-dot-green"></span>
              <span class="is-terminal-title">bash</span>
              <button
                class="is-copy-btn"
                :class="{ copied: copiedVerify }"
                @click="copySearch"
                :aria-label="copiedVerify ? 'Copied!' : 'Copy to clipboard'"
              >
                <span v-if="copiedVerify" class="is-copy-label">Copied!</span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <pre class="is-code"><code><span class="is-prompt">$</span> github-code-search query <span class="is-str">"TODO"</span> --org my-org</code></pre>
          </div>
        </div>
      </div>
    </div>

    <div class="is-footer">
      <a href="/github-code-search/getting-started/installation" class="is-link-full">
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
  font-size: 15px;
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
  font-size: 15px;
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

.is-dot-red    { background: #ff5f57; }
.is-dot-yellow { background: #febc2e; }
.is-dot-green  { background: #28c840; }

.is-terminal-title {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  color: rgba(255, 255, 255, 0.35);
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

.is-kw { color: #cc88ff; }
.is-str { color: #ffcc33; }

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
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  outline: none;
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

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .is-title {
    font-size: 22px;
  }

  .is-step-num {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .is-connector {
    margin-left: 15px;
  }

  .is-code {
    font-size: 11.5px;
  }
}
</style>
