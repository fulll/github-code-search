/**
 * Converts docs/public/social-preview.svg → docs/public/social-preview.png (1200 px wide).
 * Run standalone: bun scripts/generate-og.ts
 * Also called automatically by the VitePress vite plugin in config.mts during docs:build.
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const svgPath = resolve(import.meta.dirname, "../docs/public/social-preview.svg");
const pngPath = resolve(import.meta.dirname, "../docs/public/social-preview.png");

const svg = readFileSync(svgPath, "utf-8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
});
const rendered = resvg.render();
const png = rendered.asPng();

writeFileSync(pngPath, png);
console.log(`✓ OG image → ${pngPath} (${(png.byteLength / 1024).toFixed(0)} KB)`);
