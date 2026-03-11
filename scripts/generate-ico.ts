#!/usr/bin/env bun
/**
 * generate-ico.ts — Convert docs/public/logo.svg into a multi-resolution
 * Windows ICO file at docs/public/icons/favicon.ico.
 *
 * Sizes embedded: 16×16, 32×32, 48×48, 256×256 (PNG-compressed, Vista+).
 *
 * Usage:
 *   bun run scripts/generate-ico.ts
 */

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "../docs/public/logo.svg");
const DEST = resolve(import.meta.dirname, "../docs/public/icons/favicon.ico");

const SIZES = [16, 32, 48, 256];

const svg = await Bun.file(SRC).arrayBuffer();
const buf = Buffer.from(svg);

const pngs = await Promise.all(SIZES.map((s) => sharp(buf).resize(s, s).png().toBuffer()));

// ICO format: ICONDIR (6 bytes) + N×ICONDIRENTRY (16 bytes each) + raw PNG data
const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;
const headerSize = ICONDIR_SIZE + ICONDIRENTRY_SIZE * pngs.length;

let offset = headerSize;

const entries = pngs.map((png, i) => {
  const size = SIZES[i];
  const entry = Buffer.alloc(ICONDIRENTRY_SIZE);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width  (0 means 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height (0 means 256)
  entry.writeUInt8(0, 2); // color count (0 = truecolor)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(png.length, 8); // size of image data
  entry.writeUInt32LE(offset, 12); // offset of image data
  offset += png.length;
  return entry;
});

const icondir = Buffer.alloc(ICONDIR_SIZE);
icondir.writeUInt16LE(0, 0); // reserved
icondir.writeUInt16LE(1, 2); // type = 1 (icon)
icondir.writeUInt16LE(pngs.length, 4); // number of images

const ico = Buffer.concat([icondir, ...entries, ...pngs]);
mkdirSync(resolve(import.meta.dirname, "../docs/public/icons"), { recursive: true });
writeFileSync(DEST, ico);

const sizes = SIZES.map((s) => `${s}×${s}`).join(", ");
console.log(`Generated ${DEST} (${ico.length} bytes) — sizes: ${sizes}`);
