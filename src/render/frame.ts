import { clipToWidth } from "./terminal.ts";

/** Build one in-place update, leaving unchanged terminal lines untouched. */
export function buildFrameUpdate(
  rendered: string,
  previous: string | null,
  termWidth: number,
  termHeight: number,
): string {
  const toLines = (frame: string) =>
    frame
      .split("\n")
      .slice(0, Math.max(1, termHeight))
      .map((line) => clipToWidth(line, Math.max(1, termWidth)));
  const lines = toLines(rendered);
  const oldLines = previous === null ? [] : toLines(previous);
  const updates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === oldLines[i]) continue;
    // Overwrite before erasing the tail so no blank frame is exposed (issue #251).
    updates.push(`\x1b[${i + 1};1H\x1b[0m${lines[i]}\x1b[0m\x1b[K`);
  }

  if ((previous === null || lines.length < oldLines.length) && lines.length < termHeight) {
    updates.push(`\x1b[${lines.length + 1};1H\x1b[J`);
  }

  return updates.length > 0 ? updates.join("") + "\x1b[H" : "";
}
