import { h, nextTick, watch } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
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

    return h(DefaultTheme.Layout);
  },
} satisfies Theme;
