// Sole call site for node:util's styleText across the codebase — mirrors the
// render/terminal.ts convention for Bun-native APIs. All ANSI styling must go
// through this facade instead of importing styleText directly.
import { styleText } from "node:util";

export type StyleName =
  | "dim"
  | "bold"
  | "italic"
  | "underline"
  | "red"
  | "green"
  | "yellow"
  | "cyan"
  | "magenta"
  | "white"
  | "black"
  | "bgMagenta";

/**
 * Applies one or more styles in a single styleText call. Required for
 * combinations like bold+dim, which share the same SGR reset code (22) and
 * would clobber each other if applied via nested/chained calls instead of one
 * atomic call.
 */
export function style(names: StyleName | StyleName[], text: string): string {
  return styleText(names, text);
}

export const dim = (text: string): string => style("dim", text);
export const bold = (text: string): string => style("bold", text);
export const italic = (text: string): string => style("italic", text);
export const underline = (text: string): string => style("underline", text);
export const red = (text: string): string => style("red", text);
export const green = (text: string): string => style("green", text);
export const yellow = (text: string): string => style("yellow", text);
export const cyan = (text: string): string => style("cyan", text);
export const magenta = (text: string): string => style("magenta", text);
export const white = (text: string): string => style("white", text);
export const black = (text: string): string => style("black", text);
export const bgMagenta = (text: string): string => style("bgMagenta", text);
