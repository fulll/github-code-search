// Mouse event parsing for SGR-mode terminal mouse reporting.
// SGR format: CSI [< button ; x ; y M/m where M=press, m=release

export interface MouseEvent {
  button: number;
  x: number;
  y: number;
  isRelease: boolean;
}

/**
 * Parses an SGR-format mouse event sequence.
 * Returns a structured event or null if the sequence doesn't match or is malformed.
 *
 * SGR format: \x1b[<button;x;yM (press) or \x1b[<button;x;ym (release)
 * Button codes:
 *   0 = left click
 *   1 = middle click
 *   2 = right click
 *   64 = wheel up
 *   65 = wheel down
 */
export function parseMouseEvent(sequence: string): MouseEvent | null {
  const match = sequence.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/);
  if (!match) return null;

  const button = parseInt(match[1], 10);
  const x = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  const isRelease = match[4] === "m"; // lowercase m = release, uppercase M = press

  return { button, x, y, isRelease };
}
