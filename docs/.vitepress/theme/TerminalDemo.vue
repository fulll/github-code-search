<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const visible = ref(false);

const CMD = 'github-code-search query "useState"';
const typedCmd = ref("");
const showLoader = ref(false);
const visibleCount = ref(0);
const cursorIdx = ref(-1);
const selected = ref<Set<number>>(new Set());
const showReplay = ref(false);
const bodyScroll = ref(0);
const scrollInstant = ref(false);

interface Line {
  type: "repo" | "file" | "code" | "gap";
  text: string;
  count?: string;
}

const LINES: Line[] = [
  { type: "repo", text: "▸ acme/frontend", count: "3 matches" },
  { type: "file", text: "src/hooks/useUser.ts" },
  { type: "code", text: "const [user] = useState(null)" },
  { type: "file", text: "src/pages/App.tsx" },
  { type: "code", text: "useState(initialState)" },
  { type: "gap", text: "" },
  { type: "repo", text: "▸ acme/dashboard", count: "2 matches" },
  { type: "file", text: "src/components/Modal.tsx" },
  { type: "code", text: "const [open] = useState(false)" },
];

// Indices of navigable code lines in LINES
const CODE_IDXS = [2, 4, 8];

let timers: ReturnType<typeof setTimeout>[] = [];
let active = true;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    if (!active) return resolve();
    timers.push(setTimeout(resolve, ms));
  });
}

async function run() {
  for (;;) {
    // reset state — instant (no transition)
    scrollInstant.value = true;
    bodyScroll.value = 0;
    typedCmd.value = "";
    showLoader.value = false;
    visibleCount.value = 0;
    cursorIdx.value = -1;
    selected.value = new Set();
    showReplay.value = false;
    // re-enable transition after a tick
    await wait(16);
    scrollInstant.value = false;

    await wait(500);
    if (!active) break;

    // type the command char by char
    for (let i = 1; i <= CMD.length; i++) {
      typedCmd.value = CMD.slice(0, i);
      await wait(38);
      if (!active) break;
    }

    await wait(300);

    // show loader briefly
    showLoader.value = true;
    await wait(700);
    showLoader.value = false;

    // reveal result lines one by one
    for (let i = 0; i < LINES.length; i++) {
      visibleCount.value = i + 1;
      // start scrolling after line 6 to keep content in view
      if (i >= 5) bodyScroll.value = (i - 5) * 20;
      await wait(70);
      if (!active) break;
    }

    await wait(500);
    // scroll a touch more so hints are fully visible
    bodyScroll.value = 28;

    // navigate cursor through code lines
    for (const idx of CODE_IDXS) {
      cursorIdx.value = idx;
      await wait(500);
      if (!active) break;
    }

    // select first and last code lines
    selected.value = new Set([CODE_IDXS[0], CODE_IDXS[2]]);
    await wait(700);

    // show replay command
    showReplay.value = true;
    bodyScroll.value = 70;
    await wait(2400);
    if (!active) break;
  }
}

onMounted(() => {
  visible.value = true;
  run();
});

onUnmounted(() => {
  active = false;
  timers.forEach(clearTimeout);
  timers = [];
});
</script>

<template>
  <div class="td" :class="{ visible }">
    <!-- chrome bar -->
    <div class="td-chrome">
      <span class="td-dot td-red" />
      <span class="td-dot td-yellow" />
      <span class="td-dot td-green" />
      <span class="td-title">github-code-search</span>
    </div>

    <!-- terminal body -->
    <div class="td-body">
      <div
        class="td-body-inner"
        :class="{ 'td-instant': scrollInstant }"
        :style="{ transform: `translateY(-${bodyScroll}px)` }"
      >
        <!-- prompt line -->
        <div class="td-prompt">
          <span class="td-ps">$</span>
          <span class="td-cmd">{{ typedCmd }}</span>
          <span class="td-cursor" />
        </div>

        <!-- searching... -->
        <div v-if="showLoader" class="td-loader">Searching<span class="td-dots">...</span></div>

        <!-- result lines -->
        <template v-for="(line, i) in LINES" :key="i">
          <div
            v-if="i < visibleCount"
            class="td-line"
            :class="{
              'td-repo': line.type === 'repo',
              'td-file': line.type === 'file',
              'td-code': line.type === 'code',
              'td-gap': line.type === 'gap',
              'td-active': cursorIdx === i,
              'td-sel': selected.has(i),
            }"
          >
            <template v-if="line.type === 'repo'">
              <span>{{ line.text }}</span>
              <span class="td-count">{{ line.count }}</span>
            </template>
            <template v-else-if="line.type === 'code'">
              <span class="td-mark">{{ selected.has(i) ? "✓" : cursorIdx === i ? "›" : " " }}</span>
              <span>{{ line.text }}</span>
            </template>
            <template v-else>
              <span>{{ line.text }}</span>
            </template>
          </div>
        </template>

        <!-- replay command -->
        <template v-if="showReplay">
          <div class="td-replay-label">↩ replay</div>
          <div class="td-line td-replay-cmd">
            <span class="td-ps">$</span>
            <span>query "useState" --exclude acme/dashboard</span>
          </div>
        </template>

        <!-- keyboard hints -->
        <div v-if="visibleCount >= LINES.length" class="td-hints">
          <span>↑↓ nav</span><span>·</span><span>space sel</span><span>·</span
          ><span>↵ confirm</span>
        </div>
      </div>
      <!-- /td-body-inner -->
    </div>
  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────────────────────── */
.td {
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.55;
  width: 460px;
  max-width: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(153, 51, 255, 0.22),
    0 24px 64px rgba(0, 0, 0, 0.5),
    0 0 48px rgba(153, 51, 255, 0.12);
  /* skeleton: invisible until mounted */
  opacity: 0;
  transform: translateY(14px) scale(0.97);
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.td.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ── Chrome bar ──────────────────────────────────────────────────────── */
.td-chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #1e1c2e;
  border-bottom: 1px solid rgba(153, 51, 255, 0.15);
}

.td-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
}

.td-red {
  background: #ff5f57;
}
.td-yellow {
  background: #febc2e;
}
.td-green {
  background: #28c840;
}

.td-title {
  flex: 1;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

/* ── Body ────────────────────────────────────────────────────────────── */
.td-body {
  background: #0f0d1a;
  padding: 12px 14px 10px;
  height: 240px;
  overflow: hidden;
}

.td-body-inner {
  transition: transform 0.35s ease;
}

.td-body-inner.td-instant {
  transition: none;
}

/* ── Prompt ──────────────────────────────────────────────────────────── */
.td-prompt {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #e8e8f0;
}

.td-ps {
  color: #9933ff;
  font-weight: 700;
}

.td-cursor {
  display: inline-block;
  width: 7px;
  height: 13px;
  background: #9933ff;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

/* ── Loader ──────────────────────────────────────────────────────────── */
.td-loader {
  color: #88889a;
  padding: 2px 0 6px;
}

.td-dots {
  animation: dotsblink 1.2s steps(4, end) infinite;
}

@keyframes dotsblink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

/* ── Result lines ────────────────────────────────────────────────────── */
.td-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 1px 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.td-repo {
  color: #9933ff;
  font-weight: 600;
  margin-top: 5px;
  justify-content: space-between;
}

.td-count {
  color: rgba(153, 51, 255, 0.5);
  font-size: 10px;
  font-weight: 400;
}

.td-file {
  color: #555568;
  padding-left: 10px;
}

.td-code {
  color: #c8c8d8;
  padding-left: 2px;
}

.td-gap {
  height: 3px;
}

/* active cursor row */
.td-code.td-active {
  background: rgba(153, 51, 255, 0.15);
  border-left: 2px solid #9933ff;
  padding-left: 0;
  border-radius: 2px;
}

/* selected row */
.td-code.td-sel {
  color: rgba(190, 255, 210, 0.85);
}

.td-code.td-sel .td-mark {
  color: #4ade80;
}

.td-mark {
  width: 12px;
  flex-shrink: 0;
  display: inline-block;
  color: rgba(153, 51, 255, 0.65);
}

/* ── Replay ──────────────────────────────────────────────────────────── */
.td-replay-label {
  color: rgba(153, 51, 255, 0.55);
  font-size: 10.5px;
  margin-top: 7px;
  padding: 0 2px;
}

.td-replay-cmd {
  color: #d4d4d4;
  gap: 6px;
}

/* ── Keyboard hints ──────────────────────────────────────────────────── */
.td-hints {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.22);
  font-size: 10px;
}
</style>
