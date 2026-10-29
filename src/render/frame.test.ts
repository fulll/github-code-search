import { describe, expect, it } from "bun:test";
import { buildFrameUpdate, buildRows, renderGroups } from "../render.ts";
import type { RepoGroup } from "../types.ts";

describe("buildFrameUpdate", () => {
  it("paints the initial frame without a full-screen erase", () => {
    const update = buildFrameUpdate("header\nresult", null, 80, 24);
    expect(update).toContain("\x1b[1;1H\x1b[0mheader\x1b[0m\x1b[K");
    expect(update).toContain("\x1b[2;1H\x1b[0mresult\x1b[0m\x1b[K");
    expect(update).toContain("\x1b[3;1H\x1b[J");
    expect(update).not.toContain("\x1b[2J");
  });

  it("updates only changed lines during cursor navigation", () => {
    const previous = "header\n> first\n  second\nrow 1";
    const next = "header\n  first\n> second\nrow 2";
    const update = buildFrameUpdate(next, previous, 80, 24);
    expect(update).not.toContain("header");
    expect(update).toContain("\x1b[2;1H");
    expect(update).toContain("\x1b[3;1H");
    expect(update).toContain("\x1b[4;1H");
    expect(update).not.toContain("\x1b[2J");
    expect(update).not.toContain("\x1b[J");
  });

  it("emits nothing for an unchanged frame", () => {
    expect(buildFrameUpdate("same\nframe", "same\nframe", 80, 24)).toBe("");
  });

  it("erases the remainder of shorter lines after writing their replacement", () => {
    expect(buildFrameUpdate("short", "a longer line", 80, 24)).toBe(
      "\x1b[1;1H\x1b[0mshort\x1b[0m\x1b[K\x1b[H",
    );
  });

  it("clears obsolete rows when help or a filter makes the frame shorter", () => {
    const update = buildFrameUpdate("header\nresult", "header\nresult\nstale\ntext", 80, 24);
    expect(update).toBe("\x1b[3;1H\x1b[J\x1b[H");
  });

  it("clears all old content for an empty frame", () => {
    const update = buildFrameUpdate("", "old\nframe", 80, 24);
    expect(update).toContain("\x1b[1;1H\x1b[0m\x1b[0m\x1b[K");
    expect(update).toContain("\x1b[2;1H\x1b[J");
  });

  it("repaints changed ANSI styles even when visible text is unchanged", () => {
    const update = buildFrameUpdate("\x1b[31mtext\x1b[39m", "text", 80, 24);
    expect(update).toContain("\x1b[31mtext\x1b[39m");
    expect(update).toContain("\x1b[0m\x1b[K");
  });

  it("clips wide Unicode and styled lines to avoid wrapping into unchanged rows", () => {
    const update = buildFrameUpdate("\x1b[31m前端abc\x1b[39m\nnext", null, 5, 2);
    expect(update).toContain("前端a");
    expect(update).not.toContain("abc");
    expect(update).toContain("\x1b[2;1H");
    expect(update).not.toContain("\n");
  });

  it("limits output to the terminal height without scrolling at the bottom edge", () => {
    const update = buildFrameUpdate("first\nsecond\nhidden", null, 6, 2);
    expect(update).not.toContain("hidden");
    expect(update).not.toContain("\x1b[3;1H");
    expect(update).not.toContain("\n");
    expect(update).toEndWith("\x1b[H");
  });

  it("ignores changes outside the visible viewport", () => {
    expect(buildFrameUpdate("same\nnew", "same\nold", 80, 1)).toBe("");
    expect(buildFrameUpdate("same new", "same old", 4, 24)).toBe("");
  });

  it("repaints a resized viewport when the previous frame is invalidated", () => {
    const update = buildFrameUpdate("header\nresult", null, 4, 2);
    expect(update).toContain("head");
    expect(update).toContain("resu");
    expect(update).not.toContain("\x1b[3;1H");
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
      expect(update.match(/\x1b\[\d+;1H/g)).toHaveLength(3);
      expect(update).not.toContain("github-code-search");
      expect(update).not.toContain("\x1b[2J");
      expect(update.length).toBeLessThan(next.length / 2);
    }
  });
});
