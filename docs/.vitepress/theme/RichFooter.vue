<template>
  <footer class="rf-footer">
    <div class="rf-inner">
      <!-- Brand column -->
      <div class="rf-col rf-col-brand">
        <span class="rf-brand-name">github-code-search</span>
        <p class="rf-brand-desc">
          Interactive CLI to search GitHub code across<br />your organisation — built by
          <a class="rf-brand-link" href="https://fulll.fr" target="_blank" rel="noopener noreferrer"
            >fulll</a
          >.
        </p>
        <p class="rf-legal">
          Released under the
          <a
            href="https://github.com/fulll/github-code-search/blob/main/LICENSE.md"
            target="_blank"
            rel="noopener noreferrer"
            >MIT License</a
          >. © {{ year }} fulll.
        </p>
      </div>

      <!-- Docs column -->
      <div class="rf-col">
        <p class="rf-col-title">Documentation</p>
        <ul class="rf-links">
          <li><a href="/github-code-search/getting-started/">Getting started</a></li>
          <li><a href="/github-code-search/getting-started/installation">Installation</a></li>
          <li><a href="/github-code-search/usage/">Usage</a></li>
          <li><a href="/github-code-search/reference/cli-options">CLI reference</a></li>
          <li><a href="/github-code-search/reference/keyboard-shortcuts">Keyboard shortcuts</a></li>
        </ul>
      </div>

      <!-- Project column -->
      <div class="rf-col">
        <p class="rf-col-title">Project</p>
        <ul class="rf-links">
          <li><a href="/github-code-search/blog/">Blog</a></li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              >Changelog</a
            >
          </li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/releases"
              target="_blank"
              rel="noopener noreferrer"
              >Releases</a
            >
          </li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              >Contributing</a
            >
          </li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/blob/main/SECURITY.md"
              target="_blank"
              rel="noopener noreferrer"
              >Security</a
            >
          </li>
        </ul>
      </div>

      <!-- Community column -->
      <div class="rf-col">
        <p class="rf-col-title">Community</p>
        <ul class="rf-links">
          <li>
            <a
              href="https://github.com/fulll/github-code-search"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="rf-link-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"
                />
              </svg>
              GitHub
            </a>
          </li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/discussions"
              target="_blank"
              rel="noopener noreferrer"
              >Discussions</a
            >
          </li>
          <li>
            <a
              href="https://github.com/fulll/github-code-search/issues"
              target="_blank"
              rel="noopener noreferrer"
              >Issues</a
            >
          </li>
          <li>
            <a href="https://fulll.fr" target="_blank" rel="noopener noreferrer"> fulll.fr ↗ </a>
          </li>
        </ul>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<style scoped>
/* ── Footer wrapper ────────────────────────────────────────────────────── */
.rf-footer {
  border-top: 1px solid rgba(153, 51, 255, 0.12);
  background: #111;
  padding: 52px 32px 36px;
}

.dark .rf-footer {
  background: #0f0f0f;
  border-top-color: rgba(204, 136, 255, 0.1);
}

/* ── Inner grid ────────────────────────────────────────────────────────── */
.rf-inner {
  max-width: 1152px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 48px 40px;
  align-items: start;
}

/* ── Brand column ──────────────────────────────────────────────────────── */
.rf-brand-name {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

.rf-brand-desc {
  margin: 0 0 12px;
  font-size: 13.5px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.5);
}

.rf-brand-link {
  color: #cc88ff;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s;
}

.rf-brand-link:hover {
  color: #fff;
}

.rf-legal {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1.6;
}

.rf-legal a {
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
  transition: color 0.15s;
}

.rf-legal a:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* ── Link columns ──────────────────────────────────────────────────────── */
.rf-col-title {
  margin: 0 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
}

.rf-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rf-links a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: color 0.15s;
}

.rf-links a:hover {
  color: #cc88ff;
}

.rf-link-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.7;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 840px) {
  .rf-inner {
    grid-template-columns: 1fr 1fr;
    gap: 36px 32px;
  }

  .rf-col-brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .rf-inner {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .rf-footer {
    padding: 40px 20px 28px;
  }
}
</style>
