import { afterEach, describe, expect, it } from "bun:test";
import * as style from "./style.ts";

// ─── Golden-master ANSI sequences ─────────────────────────────────────────────
// Captured from `picocolors` (the library this facade replaces) before removal,
// applied to the literal input "x". Any drift here means style.ts no longer
// produces byte-identical output to the previous picocolors-based rendering.
const GOLDEN = {
  dim: "\x1b[2mx\x1b[22m",
  bold: "\x1b[1mx\x1b[22m",
  italic: "\x1b[3mx\x1b[23m",
  underline: "\x1b[4mx\x1b[24m",
  red: "\x1b[31mx\x1b[39m",
  green: "\x1b[32mx\x1b[39m",
  yellow: "\x1b[33mx\x1b[39m",
  cyan: "\x1b[36mx\x1b[39m",
  magenta: "\x1b[35mx\x1b[39m",
  white: "\x1b[37mx\x1b[39m",
  black: "\x1b[30mx\x1b[39m",
  bgMagenta: "\x1b[45mx\x1b[49m",
  // Composed styles — picocolors nesting order: pc.OUTER(pc.INNER(x)).
  boldYellow: "\x1b[1m\x1b[33mx\x1b[39m\x1b[22m", // pc.bold(pc.yellow(x))
  cyanUnderline: "\x1b[36m\x1b[4mx\x1b[24m\x1b[39m", // pc.cyan(pc.underline(x))
  bgMagentaBlackBold: "\x1b[45m\x1b[30m\x1b[1mx\x1b[22m\x1b[39m\x1b[49m", // pc.bgMagenta(pc.black(pc.bold(x)))
  boldCyan: "\x1b[1m\x1b[36mx\x1b[39m\x1b[22m", // pc.bold(pc.cyan(x))
  boldWhite: "\x1b[1m\x1b[37mx\x1b[39m\x1b[22m", // pc.bold(pc.white(x))
  magentaBold: "\x1b[35m\x1b[1mx\x1b[22m\x1b[39m", // pc.magenta(pc.bold(x))
  bgMagentaBold: "\x1b[45m\x1b[1mx\x1b[22m\x1b[49m", // pc.bgMagenta(pc.bold(x))
  boldMagenta: "\x1b[1m\x1b[35mx\x1b[39m\x1b[22m", // pc.bold(pc.magenta(x))
} as const;

describe("style — single styles (golden-master parity with picocolors)", () => {
  it("dim", () => expect(style.dim("x")).toBe(GOLDEN.dim));
  it("bold", () => expect(style.bold("x")).toBe(GOLDEN.bold));
  it("italic", () => expect(style.italic("x")).toBe(GOLDEN.italic));
  it("underline", () => expect(style.underline("x")).toBe(GOLDEN.underline));
  it("red", () => expect(style.red("x")).toBe(GOLDEN.red));
  it("green", () => expect(style.green("x")).toBe(GOLDEN.green));
  it("yellow", () => expect(style.yellow("x")).toBe(GOLDEN.yellow));
  it("cyan", () => expect(style.cyan("x")).toBe(GOLDEN.cyan));
  it("magenta", () => expect(style.magenta("x")).toBe(GOLDEN.magenta));
  it("white", () => expect(style.white("x")).toBe(GOLDEN.white));
  it("black", () => expect(style.black("x")).toBe(GOLDEN.black));
  it("bgMagenta", () => expect(style.bgMagenta("x")).toBe(GOLDEN.bgMagenta));
});

describe("style() — composed styles (golden-master parity with nested picocolors calls)", () => {
  it("bold+yellow matches pc.bold(pc.yellow(x))", () => {
    expect(style.style(["bold", "yellow"], "x")).toBe(GOLDEN.boldYellow);
  });

  it("cyan+underline matches pc.cyan(pc.underline(x))", () => {
    expect(style.style(["cyan", "underline"], "x")).toBe(GOLDEN.cyanUnderline);
  });

  it("bgMagenta+black+bold matches pc.bgMagenta(pc.black(pc.bold(x)))", () => {
    expect(style.style(["bgMagenta", "black", "bold"], "x")).toBe(GOLDEN.bgMagentaBlackBold);
  });

  it("bold+cyan matches pc.bold(pc.cyan(x))", () => {
    expect(style.style(["bold", "cyan"], "x")).toBe(GOLDEN.boldCyan);
  });

  it("bold+white matches pc.bold(pc.white(x))", () => {
    expect(style.style(["bold", "white"], "x")).toBe(GOLDEN.boldWhite);
  });

  it("magenta+bold matches pc.magenta(pc.bold(x))", () => {
    expect(style.style(["magenta", "bold"], "x")).toBe(GOLDEN.magentaBold);
  });

  it("bgMagenta+bold matches pc.bgMagenta(pc.bold(x))", () => {
    expect(style.style(["bgMagenta", "bold"], "x")).toBe(GOLDEN.bgMagentaBold);
  });

  it("bold+magenta matches pc.bold(pc.magenta(x))", () => {
    expect(style.style(["bold", "magenta"], "x")).toBe(GOLDEN.boldMagenta);
  });

  it("accepts a single style name (not just arrays)", () => {
    expect(style.style("bold", "x")).toBe(GOLDEN.bold);
  });
});

// ─── Color-detection env var behavior ─────────────────────────────────────────
// FORCE_COLOR=1 is already set globally by src/test-setup.ts, so these tests
// save/restore it to exercise the other states without breaking later tests.
describe("style — NO_COLOR / FORCE_COLOR behavior", () => {
  const savedForceColor = process.env.FORCE_COLOR;
  const savedNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (savedForceColor === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = savedForceColor;
    if (savedNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = savedNoColor;
  });

  it("NO_COLOR disables styling (FORCE_COLOR, set globally by test-setup.ts, takes precedence over NO_COLOR when both are set — this matches Node's own documented behavior)", () => {
    delete process.env.FORCE_COLOR;
    process.env.NO_COLOR = "1";
    expect(style.red("x")).toBe("x");
  });

  it("FORCE_COLOR forces styling even when stdout is not a TTY (bun test is piped)", () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";
    expect(style.red("x")).toBe(GOLDEN.red);
  });
});
