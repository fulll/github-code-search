// Wrappers around Bun 1.4 native terminal APIs: stringWidth, stripANSI, sliceAnsi.
// This is the sole authorized call site for these APIs across the codebase.

/**
 * Returns the number of terminal columns this string occupies.
 * ANSI escape codes are excluded from the count.
 * Correctly handles emoji, CJK characters, and multi-code-point grapheme clusters.
 */
export function visibleWidth(str: string): number {
  return Bun.stringWidth(str);
}

/**
 * Removes all ANSI escape sequences from a string.
 * Covers SGR codes, OSC 8 hyperlinks, cursor movement, and other sequences.
 */
export function stripAnsi(str: string): string {
  return Bun.stripANSI(str);
}

/**
 * Truncates str to maxCols visible terminal columns, preserving open ANSI styles.
 *
 * After truncation, appends \x1b[22;39m (reset bold + foreground) to ensure
 * the caller's background color (e.g., applied by renderActiveLine) is not
 * unintentionally reset mid-line. This partial reset leaves any background
 * color applied before the truncation intact.
 *
 * Returns the original string unchanged if it already fits within maxCols.
 */
export function clipToWidth(str: string, maxCols: number): string {
  const width = visibleWidth(str);
  if (width <= maxCols) {
    return str;
  }
  const clipped = Bun.sliceAnsi(str, 0, maxCols);
  // Append a partial reset: turn off bold (22) and reset foreground (39) without affecting background.
  return clipped + "\x1b[22;39m";
}

/**
 * Returns true if the string contains at least one ANSI escape sequence.
 */
export function hasAnsi(str: string): boolean {
  return Bun.stringWidth(str, { countAnsiEscapeCodes: true }) !== Bun.stringWidth(str);
}
