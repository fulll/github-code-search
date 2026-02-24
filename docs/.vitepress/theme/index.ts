import { h, nextTick, watch } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
import TerminalDemo from "./TerminalDemo.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () => {
    const { isDark } = useData();

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
      // Desktop (≥1280px): image slot → right side of hero
      "home-hero-image": () => h("div", { class: "td-slot-desktop" }, [h(TerminalDemo)]),
      // Mobile/tablet (<1280px): after tagline, before action buttons
      "home-hero-info-after": () => h("div", { class: "td-slot-mobile" }, [h(TerminalDemo)]),
    });
  },
} satisfies Theme;
