import { describe, expect, it } from "bun:test";
import { buildFrameUpdate, buildRows, renderGroups } from "../render.ts";
import { stripAnsi, visibleWidth } from "./terminal.ts";
import * as style from "../style.ts";
import type { RepoGroup } from "../types.ts";
import {
  ANSI_CSI,
  ANSI_CURSOR_HOME,
  ANSI_ERASE_DISPLAY,
  ANSI_ERASE_DISPLAY_END,
  ANSI_ERASE_LINE_END,
  ANSI_STYLE_RESET,
  CARRIAGE_RETURN,
  LINE_FEED,
  TAB,
  TERMINAL_TAB_WIDTH,
  cursorPosition,
} from "../terminal-control.ts";

const frame = (...lines: string[]) => lines.join(LINE_FEED);
const paintLine = (row: number, text: string) =>
  cursorPosition(row) + ANSI_STYLE_RESET + text + ANSI_STYLE_RESET + ANSI_ERASE_LINE_END;

/** Small cell model for the cursor/erase protocol emitted by buildFrameUpdate. */
function terminalCells(initial: string[], update: string, width: number): string[] {
  const cells = initial.map((line) => Array.from(line.padEnd(width).slice(0, width)));
  let row = 0;
  let column = 0;
  let offset = 0;
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  while (offset < update.length) {
    if (update.startsWith(ANSI_CSI, offset)) {
      const command = update.slice(offset + ANSI_CSI.length).match(/^([0-9;]*)([HmKJ])/);
      if (!command) throw new Error(`Unsupported terminal command at offset ${offset}`);
      const [, parameters, operation] = command;
      if (operation === "H") {
        const [y = 1, x = 1] = parameters ? parameters.split(";").map(Number) : [];
        row = y - 1;
        column = x - 1;
      } else if (operation === "K") {
        cells[row].fill(" ", column);
      } else if (operation === "J") {
        cells[row].fill(" ", column);
        for (let y = row + 1; y < cells.length; y++) cells[y].fill(" ");
      }
      offset += ANSI_CSI.length + command[0].length;
      continue;
    }
    const character = graphemes.segment(update.slice(offset))[Symbol.iterator]().next().value!
      .segment;
    if (character === CARRIAGE_RETURN) column = 0;
    else if (character === TAB) {
      column = Math.min(width - 1, column + TERMINAL_TAB_WIDTH - (column % TERMINAL_TAB_WIDTH));
    } else if (character === LINE_FEED) row++;
    else {
      const size = visibleWidth(character);
      cells[row][column] = character;
      if (size === 2) cells[row][column + 1] = "";
      column = Math.min(width - 1, column + size);
    }
    offset += character.length;
  }
  return cells.map((line) => line.join("").trimEnd());
}

describe("buildFrameUpdate", () => {
  it("paints the initial frame without a full-screen erase", () => {
    const update = buildFrameUpdate(frame("header", "result"), null, 80, 24);
    expect(update).toContain(paintLine(1, "header"));
    expect(update).toContain(paintLine(2, "result"));
    expect(update).toContain(cursorPosition(3) + ANSI_ERASE_DISPLAY_END);
    expect(update).not.toContain(ANSI_ERASE_DISPLAY);
  });

  it("updates only changed lines during cursor navigation", () => {
    const previous = frame("header", "> first", "  second", "row 1");
    const next = frame("header", "  first", "> second", "row 2");
    const update = buildFrameUpdate(next, previous, 80, 24);
    expect(update).not.toContain("header");
    for (const row of [2, 3, 4]) expect(update).toContain(cursorPosition(row));
    expect(update).not.toContain(ANSI_ERASE_DISPLAY);
    expect(update).not.toContain(ANSI_ERASE_DISPLAY_END);
  });

  it("emits nothing for an unchanged frame", () => {
    const unchanged = frame("same", "frame");
    expect(buildFrameUpdate(unchanged, unchanged, 80, 24)).toBe("");
  });

  it("erases the remainder of shorter lines after writing their replacement", () => {
    expect(buildFrameUpdate("short", "a longer line", 80, 24)).toBe(
      paintLine(1, "short") + ANSI_CURSOR_HOME,
    );
  });

  it("clears obsolete rows when help or a filter makes the frame shorter", () => {
    const update = buildFrameUpdate(
      frame("header", "result"),
      frame("header", "result", "stale", "text"),
      80,
      24,
    );
    expect(update).toBe(cursorPosition(3) + ANSI_ERASE_DISPLAY_END + ANSI_CURSOR_HOME);
  });

  it("clears all old content for an empty frame", () => {
    const update = buildFrameUpdate("", frame("old", "frame"), 80, 24);
    expect(update).toContain(paintLine(1, ""));
    expect(update).toContain(cursorPosition(2) + ANSI_ERASE_DISPLAY_END);
  });

  it("repaints changed ANSI styles even when visible text is unchanged", () => {
    const styled = style.red("text");
    const update = buildFrameUpdate(styled, "text", 80, 24);
    expect(update).toContain(styled);
    expect(update).toContain(ANSI_STYLE_RESET + ANSI_ERASE_LINE_END);
  });

  it("clips wide Unicode and styled lines to avoid wrapping into unchanged rows", () => {
    const update = buildFrameUpdate(frame(style.red("前端abc"), "next"), null, 5, 2);
    expect(update).toContain("前端a");
    expect(update).not.toContain("abc");
    expect(update).toContain(cursorPosition(2));
    expect(update).not.toContain(LINE_FEED);
  });

  it("limits output to the terminal height without scrolling at the bottom edge", () => {
    const update = buildFrameUpdate(frame("first", "second", "hidden"), null, 6, 2);
    expect(update).not.toContain("hidden");
    expect(update).not.toContain(cursorPosition(3));
    expect(update).not.toContain(LINE_FEED);
    expect(update).toEndWith(ANSI_CURSOR_HOME);
  });

  it("ignores changes outside the visible viewport", () => {
    expect(buildFrameUpdate(frame("same", "new"), frame("same", "old"), 80, 1)).toBe("");
    expect(buildFrameUpdate("same new", "same old", 4, 24)).toBe("");
  });

  it("repaints a resized viewport when the previous frame is invalidated", () => {
    const update = buildFrameUpdate(frame("header", "result"), null, 4, 2);
    expect(update).toContain("head");
    expect(update).toContain("resu");
    expect(update).not.toContain(cursorPosition(3));
  });

  it("keeps real result navigation to two highlighted rows and the position indicator", () => {
    const groups: RepoGroup[] = Array.from({ length: 10 }, (_, i) => ({
      repoFullName: `org/repository-${i}`,
      matches: [],
      folded: true,
      repoSelected: true,
      extractSelected: [],
    }));
    const rows = buildRows(groups);
    const render = (cursor: number) =>
      renderGroups(groups, cursor, rows, 24, 0, "query", "org", { termWidth: 80 });
    const first = render(0);
    const second = render(1);
    for (const [previous, next] of [
      [first, second],
      [second, first],
    ]) {
      const update = buildFrameUpdate(next, previous, 80, 24);
      expect(update.split(ANSI_CSI).filter((part) => /^\d+;1H/.test(part))).toHaveLength(3);
      expect(update).not.toContain("github-code-search");
      expect(update).not.toContain(ANSI_ERASE_DISPLAY);
      expect(update.length).toBeLessThan(next.length / 2);
    }
  });

  it("keeps CRLF snippet cells visible and compares normalized lines", () => {
    const next = frame(`snippet${CARRIAGE_RETURN}`, "next");
    const update = buildFrameUpdate(next, frame("old", "next"), 16, 2);
    expect(terminalCells(["old", "next"], update, 16)).toEqual(["snippet", "next"]);
    expect(update).not.toContain(CARRIAGE_RETURN);
    expect(buildFrameUpdate(next, frame("snippet", "next"), 16, 2)).toBe("");
  });

  it("overwrites every cell skipped by a source tab instead of leaving old text", () => {
    const update = buildFrameUpdate(`      ${TAB}X`, "abcdefghijklmnop", 16, 1);
    expect(terminalCells(["abcdefghijklmnop"], update, 16)).toEqual(["        X"]);
    expect(update).not.toContain(TAB);
  });

  it("expands tabs using visible Unicode columns, ignoring SGR styles", () => {
    const next = style.red(`前${TAB}`) + `X${TAB}Y`;
    const update = buildFrameUpdate(next, "old", 24, 1);
    expect(terminalCells(["old"], update, 24)).toEqual(["前      X       Y"]);
    expect(update).not.toContain(TAB);
    expect(buildFrameUpdate(next, style.red("前      ") + "X       Y", 24, 1)).toBe("");
  });

  it("measures complete graphemes across SGR boundaries before a tab", () => {
    const emoji = "👩‍💻";
    const styledEmoji = Array.from(emoji, (character) => style.dim(character)).join("");
    const update = buildFrameUpdate(styledEmoji + TAB + "X", "old", 24, 1);
    expect(stripAnsi(update)).toBe(emoji + " ".repeat(6) + "X");
  });

  it("preserves the final cell of a full-width ASCII or wide-glyph line", () => {
    for (const next of ["12345678", "123456前", style.red("12345678")]) {
      const update = buildFrameUpdate(next, "old", 8, 1);
      expect(terminalCells(["old"], update, 8)).toEqual([stripAnsi(next)]);
      expect(update).not.toContain(ANSI_ERASE_LINE_END);
    }
  });

  it("scrolls tab-indented source over previously occupied snippet cells", () => {
    const groups: RepoGroup[] = ["abcdefghijklmnop", `${TAB}X`].map((fragment, i) => ({
      repoFullName: `org/repository-${i}`,
      matches: [
        {
          path: "file.ts",
          repoFullName: `org/repository-${i}`,
          htmlUrl: "https://github.com/org/repository/blob/main/file.ts",
          archived: false,
          textMatches: [{ fragment, matches: [] }],
        },
      ],
      folded: false,
      repoSelected: true,
      extractSelected: [true],
    }));
    const rows = buildRows(groups);
    const render = (cursor: number, scroll: number) =>
      renderGroups(groups, cursor, rows, 10, scroll, "query", "org", { termWidth: 32 });
    const previous = render(1, 0);
    const next = render(3, 2);
    const initialCells = terminalCells(
      Array(10).fill(""),
      buildFrameUpdate(previous, null, 32, 10),
      32,
    );
    const cells = terminalCells(initialCells, buildFrameUpdate(next, previous, 32, 10), 32);
    expect(cells).toContain("        X");
    expect(cells.some((line) => line.includes("abcdefghijklmnop"))).toBe(false);
  });
});
