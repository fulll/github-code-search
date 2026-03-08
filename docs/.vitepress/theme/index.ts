import { h, nextTick, onMounted, watch } from "vue";
import type { App } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
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
    // Fix: DocSearch button has aria-label="Search" but its visible text includes
    // the keyboard-shortcut keys ("⌘ K"), which triggers a label-content-name-
    // mismatch accessibility failure. Marking the keys container aria-hidden hides
    // it from assistive technology so the button's accessible name ("Search") and
    // its visible label agree.
    onMounted(() => {
      const keys = document.querySelector<HTMLElement>(".DocSearch-Button-Keys");
      if (keys) keys.setAttribute("aria-hidden", "true");
    });
  },
  Layout: () => {
    const { isDark, frontmatter } = useData();

    const initMermaid = () => {
      createMermaidRenderer({
        startOnLoad: false,
        theme: isDark.value ? "dark" : "base",
        securityLevel: "strict",
        // Fulll brand theme variables applied via %%{init}%% in each diagram.
        // The renderer handles re-render on theme toggle automatically.
      });
    };

    nextTick(() => initMermaid());

    watch(
      () => isDark.value,
      () => initMermaid(),
    );

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
