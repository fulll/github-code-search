import { describe, it, expect } from "bun:test";
import {
  parseTarget,
  isWindowsTarget,
  getOutfile,
  getBuildCompileOptions,
  type WindowsMeta,
} from "./build";

// ─── parseTarget ─────────────────────────────────────────────────────────────

describe("parseTarget", () => {
  it("parses bun-linux-x64", () => {
    expect(parseTarget("bun-linux-x64")).toEqual({ os: "linux", arch: "x64" });
  });

  it("parses bun-linux-x64-baseline", () => {
    expect(parseTarget("bun-linux-x64-baseline")).toEqual({
      os: "linux",
      arch: "x64-baseline",
    });
  });

  it("parses bun-linux-arm64", () => {
    expect(parseTarget("bun-linux-arm64")).toEqual({
      os: "linux",
      arch: "arm64",
    });
  });

  it("parses bun-linux-arm64-musl", () => {
    expect(parseTarget("bun-linux-arm64-musl")).toEqual({
      os: "linux",
      arch: "arm64-musl",
    });
  });

  it("parses bun-darwin-x64", () => {
    expect(parseTarget("bun-darwin-x64")).toEqual({
      os: "darwin",
      arch: "x64",
    });
  });

  it("parses bun-darwin-arm64", () => {
    expect(parseTarget("bun-darwin-arm64")).toEqual({
      os: "darwin",
      arch: "arm64",
    });
  });

  it("parses bun-windows-x64", () => {
    expect(parseTarget("bun-windows-x64")).toEqual({
      os: "windows",
      arch: "x64",
    });
  });

  it("parses bun-windows-x64-baseline", () => {
    expect(parseTarget("bun-windows-x64-baseline")).toEqual({
      os: "windows",
      arch: "x64-baseline",
    });
  });

  it("parses bun-windows-x64-modern", () => {
    expect(parseTarget("bun-windows-x64-modern")).toEqual({
      os: "windows",
      arch: "x64-modern",
    });
  });

  it("parses bun-windows-arm64", () => {
    expect(parseTarget("bun-windows-arm64")).toEqual({
      os: "windows",
      arch: "arm64",
    });
  });

  it("returns native platform when target is null", () => {
    const result = parseTarget(null);
    // We can only assert the shape, not the exact values (depends on the runner)
    expect(typeof result.os).toBe("string");
    expect(typeof result.arch).toBe("string");
    expect(result.os.length).toBeGreaterThan(0);
  });

  it("returns native platform when target is undefined", () => {
    const result = parseTarget(undefined);
    expect(typeof result.os).toBe("string");
    expect(typeof result.arch).toBe("string");
  });

  // baseline must be parsed before plain x64 (order matters in the if-chain)
  it("does not confuse windows-x64-baseline with windows-x64", () => {
    expect(parseTarget("bun-windows-x64-baseline").arch).toBe("x64-baseline");
    expect(parseTarget("bun-windows-x64").arch).toBe("x64");
  });

  it("does not confuse linux-x64-baseline with linux-x64", () => {
    expect(parseTarget("bun-linux-x64-baseline").arch).toBe("x64-baseline");
    expect(parseTarget("bun-linux-x64").arch).toBe("x64");
  });
});

// ─── isWindowsTarget ─────────────────────────────────────────────────────────

describe("isWindowsTarget", () => {
  it("returns true for windows", () => {
    expect(isWindowsTarget("windows")).toBe(true);
  });

  it("returns false for linux", () => {
    expect(isWindowsTarget("linux")).toBe(false);
  });

  it("returns false for darwin", () => {
    expect(isWindowsTarget("darwin")).toBe(false);
  });
});

// ─── getOutfile ───────────────────────────────────────────────────────────────

describe("getOutfile", () => {
  it("adds .exe suffix for windows targets", () => {
    expect(getOutfile("windows", "bun-windows-x64")).toBe(
      "./dist/github-code-search-windows-x64.exe",
    );
  });

  it("adds .exe suffix for windows-x64-modern", () => {
    expect(getOutfile("windows", "bun-windows-x64-modern")).toBe(
      "./dist/github-code-search-windows-x64-modern.exe",
    );
  });

  it("adds .exe suffix for windows-x64-baseline", () => {
    expect(getOutfile("windows", "bun-windows-x64-baseline")).toBe(
      "./dist/github-code-search-windows-x64-baseline.exe",
    );
  });

  it("adds .exe suffix for windows-arm64", () => {
    expect(getOutfile("windows", "bun-windows-arm64")).toBe(
      "./dist/github-code-search-windows-arm64.exe",
    );
  });

  it("does not add .exe for linux targets", () => {
    expect(getOutfile("linux", "bun-linux-x64")).toBe("./dist/github-code-search-linux-x64");
  });

  it("does not add .exe for darwin targets", () => {
    expect(getOutfile("darwin", "bun-darwin-arm64")).toBe("./dist/github-code-search-darwin-arm64");
  });

  it("omits suffix for native (no target)", () => {
    const outfile = getOutfile("linux", null);
    expect(outfile).toBe("./dist/github-code-search");
  });

  it("strips the bun- prefix from the suffix", () => {
    expect(getOutfile("linux", "bun-linux-arm64")).toBe("./dist/github-code-search-linux-arm64");
  });
});

// ─── getBuildCompileOptions ───────────────────────────────────────────────────

const FULL_META: WindowsMeta = {
  iconPath: "/abs/path/favicon.ico",
  title: "github-code-search",
  publisher: "fulll",
  appVersion: "1.2.3",
  description: "Interactive GitHub code search",
  copyright: "Copyright © 2026 fulll — MIT",
};

describe("getBuildCompileOptions", () => {
  it("returns only outfile for non-windows targets", () => {
    const opts = getBuildCompileOptions("linux", "./dist/foo", FULL_META);
    expect(opts).toEqual({ outfile: "./dist/foo" });
  });

  it("returns only outfile for darwin", () => {
    const opts = getBuildCompileOptions("darwin", "./dist/foo", FULL_META);
    expect(opts).toEqual({ outfile: "./dist/foo" });
  });

  it("includes hideConsole for windows target", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META);
    expect(opts).toMatchObject({
      outfile: "./dist/foo.exe",
      windows: { hideConsole: true },
    });
  });

  it("sets icon from iconPath", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: WindowsMeta & { icon: string; hideConsole: boolean };
    };
    expect(opts.windows.icon).toBe("/abs/path/favicon.ico");
  });

  it("sets title", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: { title: string };
    };
    expect(opts.windows.title).toBe("github-code-search");
  });

  it("sets publisher", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: { publisher: string };
    };
    expect(opts.windows.publisher).toBe("fulll");
  });

  it("sets version from appVersion", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: { version: string };
    };
    expect(opts.windows.version).toBe("1.2.3");
  });

  it("sets description", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: { description: string };
    };
    expect(opts.windows.description).toBe("Interactive GitHub code search");
  });

  it("sets copyright", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe", FULL_META) as {
      windows: { copyright: string };
    };
    expect(opts.windows.copyright).toBe("Copyright © 2026 fulll — MIT");
  });

  it("works with empty meta (all windows fields undefined)", () => {
    const opts = getBuildCompileOptions("windows", "./dist/foo.exe") as {
      outfile: string;
      windows: Record<string, unknown>;
    };
    expect(opts.outfile).toBe("./dist/foo.exe");
    expect(opts.windows.icon).toBeUndefined();
    expect(opts.windows.title).toBeUndefined();
  });
});
