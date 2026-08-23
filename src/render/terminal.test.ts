import { describe, it, expect } from "bun:test";
import { visibleWidth, stripAnsi, clipToWidth, hasAnsi } from "./terminal";
import pc from "picocolors";

describe("render/terminal", () => {
  describe("visibleWidth", () => {
    it("measures plain ASCII correctly", () => {
      expect(visibleWidth("hello")).toBe(5);
      expect(visibleWidth("")).toBe(0);
    });

    it("ignores ANSI escape codes in measurement", () => {
      expect(visibleWidth("\u001b[31mhello\u001b[0m")).toBe(5);
      expect(visibleWidth(pc.red("world"))).toBe(5);
    });

    it("handles single-width emoji", () => {
      // Magnifying glass emoji occupies 2 columns
      expect(visibleWidth("\u{1F50D}")).toBe(2);
    });

    it("handles ZWJ emoji sequences", () => {
      // Family emoji (multi-code-point ZWJ sequence) occupies 2 columns
      const family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}";
      expect(visibleWidth(family)).toBe(2);
    });

    it("handles regional indicator flags", () => {
      // Flag emoji (pair of regional indicators) occupies 2 columns
      const flag = "\u{1F1EB}\u{1F1F7}"; // FR flag
      expect(visibleWidth(flag)).toBe(2);
    });

    it("handles CJK characters (2 columns each)", () => {
      // Two CJK characters
      const cjk = "\u{524D}\u{7AEF}"; // "前端"
      expect(visibleWidth(cjk)).toBe(4);
    });

    it("handles skin tone modifiers", () => {
      // Waving hand with skin tone modifier (👋🏻)
      const withModifier = "\u{1F44B}\u{1F3FB}";
      expect(visibleWidth(withModifier)).toBe(2);
    });

    it("handles mixed content: colored text, wide chars, and CJK", () => {
      const mixed = pc.bold("\u001b[35mhello\u{1F50D}\u{524D}\u{7AEF}");
      // 5 (hello) + 2 (emoji) + 4 (CJK) = 11, ANSI codes ignored
      expect(visibleWidth(mixed)).toBe(11);
    });
  });

  describe("stripAnsi", () => {
    it("removes SGR color codes", () => {
      expect(stripAnsi("\u001b[31mred\u001b[0m")).toBe("red");
      expect(stripAnsi(pc.red("text"))).toBe("text");
    });

    it("removes bold codes", () => {
      expect(stripAnsi("\u001b[1mbold\u001b[22m")).toBe("bold");
    });

    it("leaves plain text unchanged", () => {
      expect(stripAnsi("plain text")).toBe("plain text");
    });

    it("handles empty string", () => {
      expect(stripAnsi("")).toBe("");
    });

    it("removes cursor movement sequences", () => {
      // ESC[A = cursor up, ESC[H = cursor home
      expect(stripAnsi("text\u001b[Amore")).toBe("textmore");
      expect(stripAnsi("text\u001b[Hmore")).toBe("textmore");
    });
  });

  describe("clipToWidth", () => {
    it("returns original string if it fits", () => {
      const input = "hello";
      const result = clipToWidth(input, 10);
      expect(result).toBe(input);
    });

    it("returns original string if exactly at limit", () => {
      const input = "hello";
      const result = clipToWidth(input, 5);
      expect(result).toBe(input);
    });

    it("truncates to maxCols when exceeding", () => {
      const input = "hello world";
      const result = clipToWidth(input, 5);
      // Result should be "hello" + reset code
      expect(stripAnsi(result)).toBe("hello");
      expect(result).toContain("\x1b[22;39m");
    });

    it("appends partial reset code when truncating", () => {
      const input = "hello world";
      const result = clipToWidth(input, 5);
      expect(result.endsWith("\x1b[22;39m")).toBe(true);
    });

    it("preserves ANSI codes and closes them correctly", () => {
      const colored = pc.red("hello world");
      const result = clipToWidth(colored, 5);
      const plain = stripAnsi(result);
      expect(plain).toBe("hello");
      // Should have color code at the start and our partial reset at the end
      expect(result).toContain("\x1b[22;39m");
    });

    it("handles emoji in truncation", () => {
      // "hi" (2 cols) + emoji (2 cols) + "world" (5 cols) = 9 cols
      const input = "hi\u{1F50D}world";
      const result = clipToWidth(input, 4);
      // Should fit "hi" (2 cols) + emoji (2 cols) exactly
      expect(stripAnsi(result)).toBe("hi\u{1F50D}");
    });

    it("handles CJK truncation correctly", () => {
      // Each CJK char is 2 cols: "a" (1) + "前" (2) + "端" (2) = 5 cols
      const input = "a\u{524D}\u{7AEF}";
      const result = clipToWidth(input, 3);
      // Should fit "a" (1 col) + "前" (2 cols) = 3 cols exactly
      expect(stripAnsi(result)).toBe("a\u{524D}");
    });

    it("truncates at grapheme boundary to avoid splitting multi-code-point sequences", () => {
      // ZWJ sequence should not be split
      const family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}";
      const input = family + "text";
      const result = clipToWidth(input, 2);
      // Should include the entire family emoji, not a partial one
      expect(stripAnsi(result)).toBe(family);
    });

    it("preserves background color across truncation", () => {
      // Simulate a line styled with a background (e.g., active line)
      const input = "\u001b[48;5;53mhello world\u001b[0m";
      const result = clipToWidth(input, 5);
      // Should preserve background color context
      // Background (48;5;53m) should still be in effect when the partial reset (22;39m) is applied
      expect(stripAnsi(result)).toBe("hello");
      // The partial reset 22;39m should be present to avoid full reset
      expect(result).toContain("\x1b[22;39m");
      // Background should still be active (not reset)
      expect(result).toContain("\x1b[48;5;53m");
    });
  });

  describe("hasAnsi", () => {
    it("returns true for colored text", () => {
      expect(hasAnsi(pc.red("text"))).toBe(true);
      expect(hasAnsi("\u001b[31mred\u001b[0m")).toBe(true);
    });

    it("returns false for plain ASCII", () => {
      expect(hasAnsi("plain text")).toBe(false);
      expect(hasAnsi("")).toBe(false);
    });

    it("returns true for styled text", () => {
      expect(hasAnsi(pc.bold("bold"))).toBe(true);
      expect(hasAnsi("\u001b[1mbold\u001b[22m")).toBe(true);
    });

    it("handles emoji without ANSI as false", () => {
      expect(hasAnsi("\u{1F50D}")).toBe(false);
      expect(hasAnsi("hello\u{524D}")).toBe(false);
    });

    it("handles mixed emoji and ANSI", () => {
      expect(hasAnsi(pc.red("\u{1F50D}"))).toBe(true);
    });
  });
});
