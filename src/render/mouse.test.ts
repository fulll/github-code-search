import { describe, it, expect } from "bun:test";
import { parseMouseEvent } from "./mouse.ts";

describe("parseMouseEvent", () => {
  it("parses a valid left click (button 0) press", () => {
    const event = parseMouseEvent("\x1b[<0;12;5M");
    expect(event).toEqual({ button: 0, x: 12, y: 5, isRelease: false });
  });

  it("parses a valid left click (button 0) release", () => {
    const event = parseMouseEvent("\x1b[<0;12;5m");
    expect(event).toEqual({ button: 0, x: 12, y: 5, isRelease: true });
  });

  it("parses a valid middle click (button 1)", () => {
    const event = parseMouseEvent("\x1b[<1;100;50M");
    expect(event).toEqual({ button: 1, x: 100, y: 50, isRelease: false });
  });

  it("parses a valid right click (button 2)", () => {
    const event = parseMouseEvent("\x1b[<2;5;1M");
    expect(event).toEqual({ button: 2, x: 5, y: 1, isRelease: false });
  });

  it("parses wheel up (button 64)", () => {
    const event = parseMouseEvent("\x1b[<64;10;10M");
    expect(event).toEqual({ button: 64, x: 10, y: 10, isRelease: false });
  });

  it("parses wheel down (button 65)", () => {
    const event = parseMouseEvent("\x1b[<65;10;10M");
    expect(event).toEqual({ button: 65, x: 10, y: 10, isRelease: false });
  });

  it("returns null for malformed sequence (missing bracket)", () => {
    const event = parseMouseEvent("\x1b[0;12;5M");
    expect(event).toBeNull();
  });

  it("returns null for malformed sequence (non-numeric button)", () => {
    const event = parseMouseEvent("\x1b[<a;12;5M");
    expect(event).toBeNull();
  });

  it("returns null for malformed sequence (missing semicolon)", () => {
    const event = parseMouseEvent("\x1b[<0,12;5M");
    expect(event).toBeNull();
  });

  it("returns null for empty string", () => {
    const event = parseMouseEvent("");
    expect(event).toBeNull();
  });

  it("returns null for partial/truncated sequence", () => {
    const event = parseMouseEvent("\x1b[<0;12");
    expect(event).toBeNull();
  });

  it("returns null for unrelated escape sequence", () => {
    const event = parseMouseEvent("\x1b[A"); // arrow up
    expect(event).toBeNull();
  });

  it("returns null for non-escape sequence", () => {
    const event = parseMouseEvent("hello");
    expect(event).toBeNull();
  });

  it("handles edge-case coordinates (0, 0)", () => {
    const event = parseMouseEvent("\x1b[<0;0;0M");
    expect(event).toEqual({ button: 0, x: 0, y: 0, isRelease: false });
  });

  it("handles large coordinates (999, 999)", () => {
    const event = parseMouseEvent("\x1b[<0;999;999M");
    expect(event).toEqual({ button: 0, x: 999, y: 999, isRelease: false });
  });
});
