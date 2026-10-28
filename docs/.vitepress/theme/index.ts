import { h, nextTick, onMounted, onUnmounted, watch } from "vue";
import type { App } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import TerminalDemo from "./TerminalDemo.vue";
import UseCaseTabs from "./UseCaseTabs.vue";
import ComparisonTable from "./ComparisonTable.vue";
import ProductionCta from "./ProductionCta.vue";
import InstallSection from "./InstallSection.vue";
import HowItWorks from "./HowItWorks.vue";
import RichFooter from "./RichFooter.vue";
import MinimalFooter from "./MinimalFooter.vue";
import VersionBadge from "./VersionBadge.vue";
import TestimonialsSection from "./TestimonialsSection.vue";
import "./custom.css";

// aria-label is only permitted on elements with a role; Mermaid containers lack one.
function labelDiagrams() {
  for (const diagram of document.querySelectorAll(".mermaid[aria-label]:not([role])")) {
    diagram.setAttribute("role", "group");
  }
}

// Mermaid and its renderer weigh ~5 MB of JS: fetch them only once a page
// actually contains a diagram (first render or client-side navigation).
const MERMAID_SOURCE = ".language-mermaid, code.mermaid";
let mermaidRenderer: Promise<typeof import("vitepress-mermaid-renderer")> | undefined;
let mermaidTheme: "dark" | "base" = "base";

function initMermaid(theme = mermaidTheme) {
  mermaidTheme = theme;
  if (typeof document === "undefined") return;
  if (!mermaidRenderer && !document.querySelector(MERMAID_SOURCE)) return;
  mermaidRenderer ??= import("vitepress-mermaid-renderer");
  void mermaidRenderer.then(({ createMermaidRenderer }) =>
    createMermaidRenderer({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: "strict",
      // Fulll brand theme variables applied via %%{init}%% in each diagram.
      // The renderer handles re-render on theme toggle automatically.
    }),
  );
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component("UseCaseTabs", UseCaseTabs);
    app.component("ComparisonTable", ComparisonTable);
    app.component("ProductionCta", ProductionCta);
    app.component("InstallSection", InstallSection);
    app.component("HowItWorks", HowItWorks);
    app.component("VersionBadge", VersionBadge);
    app.component("TestimonialsSection", TestimonialsSection);
  },
  setup() {
    let diagramObserver: MutationObserver | undefined;
    onMounted(() => {
      // Derive the name from visible content, including the shortcut. The label
      // stays screen-reader-visible on mobile via custom.css.
      document.querySelector(".DocSearch")?.removeAttribute("aria-label");
      labelDiagrams();
      const content = document.getElementById("VPContent");
      if (content) {
        diagramObserver = new MutationObserver(() => {
          labelDiagrams();
          if (!mermaidRenderer) initMermaid();
        });
        diagramObserver.observe(content, { childList: true, subtree: true });
      }
    });
    onUnmounted(() => diagramObserver?.disconnect());
  },
  Layout: () => {
    const { isDark, frontmatter } = useData();

    const theme = () => (isDark.value ? "dark" : "base");
    nextTick(() => initMermaid(theme()));
    watch(isDark, () => initMermaid(theme()));

    return h(DefaultTheme.Layout, null, {
      // Version badge pill ("v1.x is here!") — only on the homepage, above hero name
      "home-hero-info-before": () => (frontmatter.value.layout === "home" ? h(VersionBadge) : null),
      // Desktop (≥1280px): image slot → right side of hero
      "home-hero-image": () => h("div", { class: "td-slot-desktop" }, [h(TerminalDemo)]),
      // Mobile/tablet (<1280px): after tagline, before action buttons
      "home-hero-info-after": () => h("div", { class: "td-slot-mobile" }, [h(TerminalDemo)]),
      // Home: rich multi-column footer ; other pages: minimal one-liner
      "layout-bottom": () =>
        frontmatter.value.layout === "home" ? h(RichFooter) : h(MinimalFooter),
    });
  },
} satisfies Theme;
