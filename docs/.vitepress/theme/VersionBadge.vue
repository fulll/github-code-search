<template>
  <div class="vb-wrap">
    <a class="vb-badge" :href="releaseLink">
      <span class="vb-dot" aria-hidden="true"></span>
      🎉 v{{ version }} is here
      <span class="vb-arrow" aria-hidden="true">→</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { withBase } from "vitepress";

/**
 * __LATEST_VERSION__ and __LATEST_BLOG_SLUG__ are replaced at build/dev time
 * by vite.define in docs/.vitepress/config.mts, reading from package.json.
 * When docs:build is triggered after a release tag, the badge auto-updates.
 */
declare const __LATEST_VERSION__: string;
declare const __LATEST_BLOG_SLUG__: string;

const version = __LATEST_VERSION__;
const releaseLink = withBase(`/blog/${__LATEST_BLOG_SLUG__}`);
</script>

<style scoped>
.vb-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.vb-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 14px 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(153, 51, 255, 0.35);
  background: rgba(153, 51, 255, 0.08);
  color: var(--vp-c-brand-1);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.vb-badge:hover {
  background: rgba(153, 51, 255, 0.16);
  border-color: rgba(153, 51, 255, 0.55);
}

.dark .vb-badge {
  border-color: rgba(204, 136, 255, 0.3);
  background: rgba(204, 136, 255, 0.07);
  color: #cc88ff;
}

.dark .vb-badge:hover {
  background: rgba(204, 136, 255, 0.14);
  border-color: rgba(204, 136, 255, 0.5);
}

.vb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  animation: vb-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.dark .vb-dot {
  background: #cc88ff;
}

@keyframes vb-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.vb-arrow {
  font-size: 12px;
  opacity: 0.7;
}
</style>
