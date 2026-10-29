// Shared terminal protocol vocabulary. Keep encoded control bytes in this module.
export const ESCAPE = "\x1b";
export const LINE_FEED = "\n";
export const CARRIAGE_RETURN = "\r";
export const TAB = "\t";
export const ANSI_CSI = `${ESCAPE}[`;
export const ANSI_CURSOR_HOME = `${ANSI_CSI}H`;
export const ANSI_ERASE_DISPLAY = `${ANSI_CSI}2J`;
export const ANSI_CLEAR = ANSI_ERASE_DISPLAY + ANSI_CURSOR_HOME;
export const ANSI_ERASE_LINE = `${ANSI_CSI}2K`;
export const ANSI_ERASE_LINE_END = `${ANSI_CSI}K`;
export const ANSI_ERASE_DISPLAY_END = `${ANSI_CSI}J`;
export const ANSI_STYLE_RESET = `${ANSI_CSI}0m`;
export const ANSI_FOREGROUND_RESET = `${ANSI_CSI}39m`;
export const ANSI_BACKGROUND_RESET = `${ANSI_CSI}49m`;
export const ANSI_BOLD_FOREGROUND_RESET = `${ANSI_CSI}22;39m`;
export const ANSI_ACTIVE_BACKGROUND = `${ANSI_CSI}48;5;53m`;
export const ANSI_ACCENT_FOREGROUND = `${ANSI_CSI}38;5;129m`;
export const ANSI_COUNT_FOREGROUND = `${ANSI_CSI}38;5;99m`;
export const ANSI_MUTED_FOREGROUND = `${ANSI_CSI}38;5;240m`;
export const ANSI_UNDERLINE = `${ANSI_CSI}4m`;
export const ANSI_UNDERLINE_OFF = `${ANSI_CSI}24m`;
export const ANSI_INVERSE = `${ANSI_CSI}7m`;
export const ANSI_INVERSE_OFF = `${ANSI_CSI}27m`;
export const ANSI_SGR_PATTERN = new RegExp(`(${ANSI_CSI.replace("[", "\\[")}[0-9;]*m)`, "g");
export const TERMINAL_TAB_WIDTH = 8;

export function cursorPosition(row: number, column = 1): string {
  return `${ANSI_CSI}${row};${column}H`;
}

export const ANSI_ARROW_UP = `${ANSI_CSI}A`;
export const ANSI_ARROW_DOWN = `${ANSI_CSI}B`;
export const ANSI_ARROW_LEFT = `${ANSI_CSI}D`;
export const ANSI_ARROW_RIGHT = `${ANSI_CSI}C`;
export const KEY_CTRL_C = "\x03";
export const KEY_END = `${ANSI_CSI}F`;
export const KEY_CTRL_A = "\x01";
export const KEY_CTRL_E = "\x05";
export const KEY_CTRL_W = "\x17";
export const KEY_ALT_BACKSPACE = `${ESCAPE}\x7f`;
export const KEY_CTRL_ARROW_LEFT = `${ANSI_CSI}1;5D`;
export const KEY_CTRL_ARROW_RIGHT = `${ANSI_CSI}1;5C`;
export const KEY_ALT_ARROW_LEFT = `${ANSI_CSI}1;3D`;
export const KEY_ALT_ARROW_RIGHT = `${ANSI_CSI}1;3C`;
export const KEY_ALT_B = `${ESCAPE}b`;
export const KEY_ALT_F = `${ESCAPE}f`;
export const KEY_DELETE = `${ANSI_CSI}3~`;
export const KEY_SHIFT_TAB = `${ANSI_CSI}Z`;
export const KEY_PAGE_UP = `${ANSI_CSI}5~`;
export const KEY_PAGE_DOWN = `${ANSI_CSI}6~`;
export const KEY_CTRL_U = "\x15";
export const KEY_CTRL_D = "\x04";

// SGR mouse reporting: enable/disable both basic events and SGR encoding.
export const ANSI_ENABLE_MOUSE_REPORTING = `${ANSI_CSI}?1000h${ANSI_CSI}?1006h`;
export const ANSI_DISABLE_MOUSE_REPORTING = `${ANSI_CSI}?1000l${ANSI_CSI}?1006l`;
export const SGR_MOUSE_PREFIX = `${ANSI_CSI}<`;
