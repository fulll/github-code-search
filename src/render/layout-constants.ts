/**
 * Rendering constants for TUI layout and mouse hit-testing.
 * Centralizes all hard-coded measurements so they're defined once and reused consistently.
 */

// ─── Header Layout ─────────────────────────────────────────────────────────────
// Base header layers: title (1) + summary (1) + hints (1) + blank (1)
export const BASE_HEADER_LINES = 4;

// Additional header lines when filter bar is shown
export const FILTER_BAR_LINES_NORMAL = 1; // Filter status or mode badge line
export const FILTER_BAR_LINES_ACTIVE = 2; // Filter input + hints in filter mode

/**
 * Calculate total header lines before viewport content.
 * Accounts for base header + filter bar presence.
 */
export function getHeaderLines(filterMode: boolean, hasActiveFilter: boolean): number {
  let total = BASE_HEADER_LINES;
  if (filterMode) {
    total += FILTER_BAR_LINES_ACTIVE;
  } else if (hasActiveFilter) {
    total += FILTER_BAR_LINES_NORMAL;
  }
  return total;
}

// ─── Mouse Button Codes (SGR mouse protocol) ─────────────────────────────────
// https://en.wikipedia.org/wiki/X11_mouse_protocol#SGR_1006_Protocol
export const MOUSE_BUTTON_WHEEL_UP = 64;
export const MOUSE_BUTTON_WHEEL_DOWN = 65;
export const MOUSE_SCROLL_STEP = 3; // rows per wheel scroll

// ─── Mouse Hit-Testing: Column Layout ──────────────────────────────────────────
// Terminal row columns (1-indexed per SGR protocol):
// Repo row:  "▸ ✓ repo-name"
// Extract:   "  ✓ path:line:col"
//
// Emoji widths: ▸, ▾, ✓ each occupy 2 visual columns in the terminal.

// Fold control (▸/▾ emoji) — left zone on repo rows only
export const FOLD_COLUMN_START = 1;
export const FOLD_COLUMN_END = 2;

// Checkbox (✓ emoji) — appears on both repo and extract rows
export const CHECKBOX_COLUMN_START = 4;
export const CHECKBOX_COLUMN_END = 5;

// Navigation zone — everything else
export const NAV_COLUMN_START = 6;

/**
 * Determine if a click at column `x` is in the fold zone (repo row control).
 * Repo rows: fold icon (columns 1-2), separator (column 3), checkbox (columns 4-5), etc.
 */
export function isClickInFoldZone(x: number): boolean {
  return x >= FOLD_COLUMN_START && x <= FOLD_COLUMN_END;
}

/**
 * Determine if a click at column `x` is in the checkbox/select zone.
 * Checkbox emoji starts at column 4; double-click works on entire row from there.
 */
export function isClickInCheckboxZone(x: number): boolean {
  return x >= CHECKBOX_COLUMN_START;
}

/**
 * Determine if a click at column `x` is in the navigation/main content zone.
 * This is the zone where clicking moves the cursor without selecting.
 */
export function isClickInNavZone(x: number): boolean {
  return x >= NAV_COLUMN_START;
}
