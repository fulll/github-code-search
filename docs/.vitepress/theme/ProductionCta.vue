<template>
  <div class="cta-banner">
    <span class="cta-icon" aria-hidden="true">
      <!-- Building / production SVG — stroke-color animation cycles through brand palette -->
      <svg
        class="cta-svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      >
        <!-- Building outline -->
        <rect x="2" y="7" width="20" height="15" rx="1.5" stroke="currentColor" />
        <!-- Roof / pediment -->
        <path d="M1 7.5L12 2l11 5.5" stroke="currentColor" />
        <!-- Left window -->
        <rect x="5" y="11" width="3" height="3" rx="0.5" stroke="currentColor" />
        <!-- Right window -->
        <rect x="16" y="11" width="3" height="3" rx="0.5" stroke="currentColor" />
        <!-- Door -->
        <path d="M10 22v-5a2 2 0 0 1 4 0v5" stroke="currentColor" />
      </svg>
    </span>
    <div class="cta-body">
      <h3 class="cta-title">Used in production?</h3>
      <p class="cta-text">
        Using <code>github-code-search</code> at your organisation? Share your experience, use cases
        or feedback — your input shapes the roadmap.
      </p>
    </div>
    <a
      class="cta-btn"
      href="https://github.com/fulll/github-code-search/discussions"
      target="_blank"
      rel="noopener noreferrer"
    >
      Share your story ↗
    </a>
  </div>
</template>

<style scoped>
.cta-banner {
  margin: 48px 0 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px 32px;
  border-radius: 14px;
  border: 1px solid rgba(153, 51, 255, 0.25);
  background: linear-gradient(135deg, rgba(153, 51, 255, 0.06) 0%, rgba(255, 204, 51, 0.05) 100%);
}

.dark .cta-banner {
  border-color: rgba(204, 136, 255, 0.2);
  background: linear-gradient(135deg, rgba(153, 51, 255, 0.1) 0%, rgba(255, 204, 51, 0.06) 100%);
}

.cta-icon {
  flex-shrink: 0;
  line-height: 1;
  display: flex;
  align-items: center;
}

/* Animated SVG — cycles stroke color through brand palette */
.cta-svg {
  color: #9933ff;
  animation: cta-color-cycle 4s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(153, 51, 255, 0.4));
}

@keyframes cta-color-cycle {
  0% {
    color: #9933ff;
    filter: drop-shadow(0 0 6px rgba(153, 51, 255, 0.45));
  }
  33% {
    color: #cc88ff;
    filter: drop-shadow(0 0 8px rgba(204, 136, 255, 0.55));
  }
  66% {
    color: #ffcc33;
    filter: drop-shadow(0 0 8px rgba(255, 204, 51, 0.45));
  }
  100% {
    color: #9933ff;
    filter: drop-shadow(0 0 6px rgba(153, 51, 255, 0.45));
  }
}

.cta-body {
  flex: 1;
  min-width: 0;
}

.cta-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  /* override VitePress heading styles inside home layout */
  border-top: none;
  padding-top: 0;
  letter-spacing: -0.01em;
}

.cta-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.cta-text code {
  font-size: 13px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ── Button ────────────────────────────────────────────────────────────── */
.cta-btn {
  flex-shrink: 0;
  display: inline-block;
  padding: 10px 22px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #9933ff 0%, #7a1fd4 100%);
  color: #fff !important;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none !important;
  white-space: nowrap;
  box-shadow: 0 2px 16px rgba(153, 51, 255, 0.35);
  transition:
    box-shadow 0.2s,
    transform 0.18s,
    background 0.2s;
}

.cta-btn:hover {
  background: linear-gradient(135deg, #aa44ff 0%, #9933ff 100%);
  box-shadow: 0 6px 28px rgba(153, 51, 255, 0.5);
  transform: translateY(-2px);
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .cta-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 22px 20px;
  }

  .cta-svg {
    width: 30px;
    height: 30px;
  }

  .cta-btn {
    align-self: stretch;
    text-align: center;
  }
}
</style>
