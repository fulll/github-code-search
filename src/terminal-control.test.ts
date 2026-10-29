import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as control from "./terminal-control.ts";

// Independent wire-format assertions are intentionally the only tests using raw bytes.
describe("terminal control vocabulary", () => {
  it("preserves the established cursor, erase and line-control encodings", () => {
    expect(control.ESCAPE).toBe("\x1b");
    expect(control.ANSI_CSI).toBe("\x1b[");
    expect(control.LINE_FEED).toBe("\n");
    expect(control.CARRIAGE_RETURN).toBe("\r");
    expect(control.TAB).toBe("\t");
    expect(control.ANSI_CURSOR_HOME).toBe("\x1b[H");
    expect(control.ANSI_CLEAR).toBe("\x1b[2J\x1b[H");
    expect(control.ANSI_ERASE_LINE).toBe("\x1b[2K");
    expect(control.ANSI_ERASE_LINE_END).toBe("\x1b[K");
    expect(control.ANSI_ERASE_DISPLAY_END).toBe("\x1b[J");
    expect(control.ANSI_STYLE_RESET).toBe("\x1b[0m");
    expect(control.cursorPosition(3, 5)).toBe("\x1b[3;5H");
    expect(control.cursorPosition(2)).toBe("\x1b[2;1H");
    expect(control.TERMINAL_TAB_WIDTH).toBe(8);
  });

  it("preserves existing input and mouse-reporting protocols", () => {
    const keys = [
      [control.ANSI_ARROW_UP, "\x1b[A"],
      [control.ANSI_ARROW_DOWN, "\x1b[B"],
      [control.ANSI_ARROW_LEFT, "\x1b[D"],
      [control.ANSI_ARROW_RIGHT, "\x1b[C"],
      [control.KEY_CTRL_C, "\x03"],
      [control.KEY_CTRL_A, "\x01"],
      [control.KEY_CTRL_E, "\x05"],
      [control.KEY_CTRL_W, "\x17"],
      [control.KEY_CTRL_U, "\x15"],
      [control.KEY_CTRL_D, "\x04"],
      [control.KEY_ALT_BACKSPACE, "\x1b\x7f"],
      [control.KEY_CTRL_ARROW_LEFT, "\x1b[1;5D"],
      [control.KEY_CTRL_ARROW_RIGHT, "\x1b[1;5C"],
      [control.KEY_ALT_ARROW_LEFT, "\x1b[1;3D"],
      [control.KEY_ALT_ARROW_RIGHT, "\x1b[1;3C"],
      [control.KEY_ALT_B, "\x1bb"],
      [control.KEY_ALT_F, "\x1bf"],
      [control.KEY_END, "\x1b[F"],
      [control.KEY_DELETE, "\x1b[3~"],
      [control.KEY_SHIFT_TAB, "\x1b[Z"],
      [control.KEY_PAGE_UP, "\x1b[5~"],
      [control.KEY_PAGE_DOWN, "\x1b[6~"],
      [control.ANSI_ENABLE_MOUSE_REPORTING, "\x1b[?1000h\x1b[?1006h"],
      [control.ANSI_DISABLE_MOUSE_REPORTING, "\x1b[?1000l\x1b[?1006l"],
      [control.SGR_MOUSE_PREFIX, "\x1b[<"],
    ];
    for (const [actual, expected] of keys) expect(actual).toBe(expected);
  });
});

const encodedControl = /\\(?:x(?:0[0-9a-f]|1[0-9a-f]|7f)|u00(?:0[0-9a-f]|1[0-9a-f]|7f))/i;
const encodedLineControl = /\\[rnt]/;
const transpiler = new Bun.Transpiler({ loader: "ts" });

describe("terminal control architecture guard", () => {
  it("detects raw controls, including interpolated line breaks, but ignores comments", () => {
    expect(transpiler.transformSync(String.raw`const value = "\x1b[H";`)).toMatch(encodedControl);
    expect(transpiler.transformSync(String.raw`const value = "\u001b[H";`)).toMatch(encodedControl);
    expect(transpiler.transformSync(String.raw`const value = "\x03";`)).toMatch(encodedControl);
    for (const escaped of [String.raw`\r`, String.raw`\n`, String.raw`\t`]) {
      expect(`const value = "text${escaped}";`).toMatch(encodedLineControl);
    }
    expect("const value = `text\\n${name}`;").toMatch(encodedLineControl);
    expect(transpiler.transformSync(String.raw`// example: "\x1b[H"`)).not.toMatch(encodedControl);
    expect(transpiler.transformSync("const value = ANSI_CURSOR_HOME + LINE_FEED;")).not.toMatch(
      encodedLineControl,
    );
  });

  it("keeps raw control bytes out of first-party code and named line controls in terminal surfaces", () => {
    const root = new URL("../", import.meta.url);
    const files = [...new Bun.Glob("src/**/*.ts").scanSync({ cwd: fileURLToPath(root) })];
    files.push("github-code-search.ts");
    const terminalSurfaces = new Set([
      "github-code-search.ts",
      "src/api.ts",
      "src/tui.ts",
      "src/render.ts",
      "src/render/frame.ts",
      "src/render/terminal.ts",
    ]);
    const legacyProtocolFixtures = new Set([
      "src/api.test.ts",
      "src/render.test.ts",
      "src/style.test.ts",
      "src/render/highlight.test.ts",
      "src/render/mouse.test.ts",
      "src/render/team-pick.test.ts",
      "src/render/terminal.test.ts",
    ]);
    for (const path of files) {
      if (
        path === "src/terminal-control.ts" ||
        path === "src/terminal-control.test.ts" ||
        legacyProtocolFixtures.has(path)
      )
        continue;
      const source = readFileSync(new URL(path, root), "utf8");
      const code = transpiler.transformSync(source);
      expect(
        encodedControl.test(code),
        `${path}: import control constants from terminal-control.ts`,
      ).toBe(false);
      if (
        terminalSurfaces.has(path) ||
        (path.startsWith("src/render/") && !path.endsWith("highlight.ts"))
      ) {
        expect(
          encodedLineControl.test(source),
          `${path}: use LINE_FEED, CARRIAGE_RETURN or TAB`,
        ).toBe(false);
      }
    }
  });
});
