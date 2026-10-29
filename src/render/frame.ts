import { clipToWidth, visibleWidth } from "./terminal.ts";
import {
  ANSI_CSI,
  ANSI_CURSOR_HOME,
  ANSI_ERASE_DISPLAY_END,
  ANSI_ERASE_LINE_END,
  ANSI_SGR_PATTERN,
  ANSI_STYLE_RESET,
  CARRIAGE_RETURN,
  LINE_FEED,
  TAB,
  TERMINAL_TAB_WIDTH,
  cursorPosition,
} from "../terminal-control.ts";

function normalizeLine(line: string): string {
  const withoutCarriageReturns = line.replaceAll(CARRIAGE_RETURN, "");
  if (!withoutCarriageReturns.includes(TAB)) return withoutCarriageReturns;
  let column = 0;
  let textSinceTab = "";
  return withoutCarriageReturns
    .split(ANSI_SGR_PATTERN)
    .map((part) => {
      if (part.startsWith(ANSI_CSI)) return part;
      return part
        .split(TAB)
        .map((text, index) => {
          if (index === 0) {
            textSinceTab += text;
            return text;
          }
          column += visibleWidth(textSinceTab);
          const padding = TERMINAL_TAB_WIDTH - (column % TERMINAL_TAB_WIDTH);
          column += padding;
          textSinceTab = text;
          return " ".repeat(padding) + text;
        })
        .join("");
    })
    .join("");
}

/** Build one in-place update, leaving unchanged terminal lines untouched. */
export function buildFrameUpdate(
  rendered: string,
  previous: string | null,
  termWidth: number,
  termHeight: number,
): string {
  const toLines = (frame: string) =>
    frame
      .split(LINE_FEED)
      .slice(0, Math.max(1, termHeight))
      .map((line) => clipToWidth(normalizeLine(line), Math.max(1, termWidth)));
  const lines = toLines(rendered);
  const oldLines = previous === null ? [] : toLines(previous);
  const updates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === oldLines[i]) continue;
    // Overwrite before erasing the tail so no blank frame is exposed (issue #251).
    // At the right margin an erase would remove the last cell, not an empty tail.
    const eraseTail = visibleWidth(lines[i]) < termWidth ? ANSI_ERASE_LINE_END : "";
    updates.push(
      cursorPosition(i + 1) + ANSI_STYLE_RESET + lines[i] + ANSI_STYLE_RESET + eraseTail,
    );
  }

  if ((previous === null || lines.length < oldLines.length) && lines.length < termHeight) {
    updates.push(cursorPosition(lines.length + 1) + ANSI_ERASE_DISPLAY_END);
  }

  return updates.length > 0 ? updates.join("") + ANSI_CURSOR_HOME : "";
}
