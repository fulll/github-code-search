<template>
  <footer class="mf-footer">
    <span class="mf-text">Released under the MIT License.</span>
    <span class="mf-sep">·</span>
    <span class="mf-text">
      Copyright © {{ year }}
      <a class="mf-link" href="https://fulll.fr" target="_blank" rel="noopener noreferrer">fulll</a>
    </span>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<style scoped>
.mf-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 24px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-align: center;
  flex-wrap: wrap;
}

.mf-sep {
  opacity: 0.4;
}

.mf-link {
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.15s;
}

.mf-link:hover {
  color: var(--vp-c-brand-1);
}
</style>
