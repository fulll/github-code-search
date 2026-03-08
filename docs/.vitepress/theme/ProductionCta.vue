<template>
  <section class="cta-banner" aria-labelledby="cta-banner-title">
    <span class="cta-icon" aria-hidden="true">
      <!-- Rocket SVG — fusée avec flamme pulsée + cycling couleur brand -->
      <svg
        class="cta-svg"
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.6"
      >
        <!-- Corps de la fusée -->
        <path d="M12 2C9 6 8 9.5 8 13.5h8C16 9.5 15 6 12 2z" stroke="currentColor" />
        <!-- Aile gauche -->
        <path d="M8 13.5L4.5 18l4-1.5" stroke="currentColor" />
        <!-- Aile droite -->
        <path d="M16 13.5L19.5 18l-4-1.5" stroke="currentColor" />
        <!-- Hublot -->
        <circle cx="12" cy="9" r="1.6" stroke="currentColor" />
        <!-- Tuyère -->
        <path d="M10 17h4" stroke="currentColor" />
        <!-- Flamme animée -->
        <path
          class="cta-flame"
          d="M10.5 18.5c-.5 1.5-.5 2.5 0 3.5.5.8 1 .5 1.5 0 .5.5 1 .8 1.5 0 .5-1 .5-2 0-3.5"
          stroke="currentColor"
          fill="none"
        />
      </svg>
    </span>
    <div class="cta-body">
      <h3 id="cta-banner-title" class="cta-title">Used in production?</h3>
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
      aria-label="Share your story (opens in a new tab)"
    >
      <span>Share your story</span>
      <svg
        class="cta-btn-arrow"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M7 17L17 7M7 7h10v10" />
      </svg>
    </a>
  </section>
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

.cta-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(153, 51, 255, 0.5);
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

/* Animated SVG — cycles stroke color + flamme pulsée */
.cta-svg {
  color: #9933ff;
  animation: cta-color-cycle 4s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(153, 51, 255, 0.4));
}

.cta-flame {
  transform-origin: 12px 18.5px;
  animation: cta-flame-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes cta-flame-pulse {
  from {
    transform: scaleY(0.85) scaleX(0.9);
    opacity: 0.7;
  }
  to {
    transform: scaleY(1.15) scaleX(1.1);
    opacity: 1;
  }
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
  font-size: 19px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  border-top: none;
  padding-top: 0;
  letter-spacing: -0.01em;
}

.cta-text {
  margin: 0;
  font-size: 16px;
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
  display: inline-flex;
  align-items: center;
  gap: 7px;
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

.cta-btn-arrow {
  flex-shrink: 0;
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
