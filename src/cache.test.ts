import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_TTL_MS, getCacheDir, getCacheKey, readCache, writeCache } from "./cache.ts";

// Use env-var override to redirect the cache to an isolated temp directory
const TEST_CACHE_DIR = join(tmpdir(), `gcs-cache-test-${process.pid}`);

beforeEach(() => {
  process.env.GITHUB_CODE_SEARCH_CACHE_DIR = TEST_CACHE_DIR;
  mkdirSync(TEST_CACHE_DIR, { recursive: true });
});

afterEach(() => {
  delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
  try {
    rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
});

// ─── getCacheDir ──────────────────────────────────────────────────────────────

describe("getCacheDir", () => {
  it("returns the override when GITHUB_CODE_SEARCH_CACHE_DIR is set", () => {
    process.env.GITHUB_CODE_SEARCH_CACHE_DIR = "/custom/cache/path";
    expect(getCacheDir()).toBe("/custom/cache/path");
  });

  it("ignores the override when it is an empty string", () => {
    process.env.GITHUB_CODE_SEARCH_CACHE_DIR = "   ";
    // On any platform the result must be a non-empty path that doesn't include
    // the blank override string — we just test it doesn't blow up and returns something.
    const dir = getCacheDir();
    expect(dir.trim()).not.toBe("");
  });

  it("contains 'github-code-search' in the path on all platforms", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    expect(getCacheDir()).toContain("github-code-search");
  });

  it("uses LOCALAPPDATA on win32 when the env var is set", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalLocalAppData = process.env.LOCALAPPDATA;
    try {
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      process.env.LOCALAPPDATA = "C:\\Users\\user\\AppData\\Local";
      const dir = getCacheDir();
      // path.join uses the host OS separator in tests (macOS: /), so we just
      // assert both components are present rather than hard-coding a separator.
      expect(dir).toContain("AppData");
      expect(dir).toContain("Local");
      expect(dir).toContain("github-code-search");
    } finally {
      if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
      if (originalLocalAppData !== undefined) process.env.LOCALAPPDATA = originalLocalAppData;
      else delete process.env.LOCALAPPDATA;
    }
  });

  it("falls back to ~/AppData/Local on win32 when LOCALAPPDATA is not set", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalLocalAppData = process.env.LOCALAPPDATA;
    try {
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      delete process.env.LOCALAPPDATA;
      const dir = getCacheDir();
      expect(dir).toContain("AppData");
      expect(dir).toContain("Local");
      expect(dir).toContain("github-code-search");
    } finally {
      if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
      if (originalLocalAppData !== undefined) process.env.LOCALAPPDATA = originalLocalAppData;
    }
  });

  it("uses XDG_CACHE_HOME on linux when set", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalXdg = process.env.XDG_CACHE_HOME;
    try {
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      process.env.XDG_CACHE_HOME = "/custom/xdg/cache";
      const dir = getCacheDir();
      expect(dir).toContain("custom");
      expect(dir).toContain("xdg");
      expect(dir).toContain("github-code-search");
    } finally {
      if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
      if (originalXdg !== undefined) process.env.XDG_CACHE_HOME = originalXdg;
      else delete process.env.XDG_CACHE_HOME;
    }
  });

  it("falls back to ~/.cache on linux when XDG_CACHE_HOME is not set", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalXdg = process.env.XDG_CACHE_HOME;
    try {
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      delete process.env.XDG_CACHE_HOME;
      const dir = getCacheDir();
      expect(dir).toContain(".cache");
      expect(dir).toContain("github-code-search");
    } finally {
      if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
      if (originalXdg !== undefined) process.env.XDG_CACHE_HOME = originalXdg;
    }
  });

  it("falls back to ~/.github-code-search/cache on unknown platforms", () => {
    delete process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    try {
      Object.defineProperty(process, "platform", { value: "freebsd", configurable: true });
      const dir = getCacheDir();
      expect(dir).toContain(".github-code-search");
      expect(dir).toContain("cache");
    } finally {
      if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    }
  });
});

// ─── getCacheKey ─────────────────────────────────────────────────────────────

describe("getCacheKey", () => {
  it("includes the org name", () => {
    expect(getCacheKey("myorg", [])).toContain("myorg");
  });

  it("includes each prefix", () => {
    const key = getCacheKey("myorg", ["squad-", "chapter-"]);
    expect(key).toContain("squad-");
    expect(key).toContain("chapter-");
  });

  it("produces the same key regardless of prefix order", () => {
    const key1 = getCacheKey("acme", ["squad-", "chapter-"]);
    const key2 = getCacheKey("acme", ["chapter-", "squad-"]);
    expect(key1).toBe(key2);
  });

  it("produces different keys for different orgs", () => {
    const key1 = getCacheKey("org-a", ["squad-"]);
    const key2 = getCacheKey("org-b", ["squad-"]);
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different prefixes", () => {
    const key1 = getCacheKey("myorg", ["squad-"]);
    const key2 = getCacheKey("myorg", ["chapter-"]);
    expect(key1).not.toBe(key2);
  });

  it("ends with .json", () => {
    expect(getCacheKey("myorg", ["squad-"])).toMatch(/\.json$/);
  });

  it("replaces special characters with underscores to keep the filename filesystem-safe", () => {
    const key = getCacheKey("my/org", ["prefix:"]);
    expect(key).not.toContain("/");
    expect(key).not.toContain(":");
  });
});

// ─── writeCache / readCache ───────────────────────────────────────────────────

describe("writeCache / readCache round-trip", () => {
  it("stores and retrieves a Map serialised as an array of entries", () => {
    // Maps are not directly JSON-serialisable; callers are responsible for
    // the serialisation format — here we test with a plain object.
    const data = { repo: "org/repo", teams: ["squad-alpha"] };
    const key = getCacheKey("myorg", ["squad-"]);
    writeCache(key, data);
    expect(readCache(key)).toEqual(data);
  });

  it("returns null when the key does not exist", () => {
    expect(readCache("nonexistent.json")).toBeNull();
  });

  it("returns null when the cached file is corrupted JSON", () => {
    const key = "corrupted.json";
    writeFileSync(join(TEST_CACHE_DIR, key), "not valid json", "utf8");
    expect(readCache(key)).toBeNull();
  });

  it("returns null when the cache entry is older than CACHE_TTL_MS", () => {
    const key = getCacheKey("myorg", ["old-"]);
    writeCache(key, { cached: true });
    // Back-date the file's mtime to simulate TTL expiry
    const expired = new Date(Date.now() - CACHE_TTL_MS - 1_000);
    const filePath = join(TEST_CACHE_DIR, key);
    utimesSync(filePath, expired, expired);
    expect(readCache(key)).toBeNull();
  });

  it("returns data when the cache entry is within TTL", () => {
    const key = getCacheKey("myorg", ["fresh-"]);
    const payload = [{ full_name: "org/repo" }];
    writeCache(key, payload);
    expect(readCache(key)).toEqual(payload);
  });

  it("creates the cache directory if it does not exist", () => {
    // Point to a subdirectory that doesn't exist yet
    const subDir = join(TEST_CACHE_DIR, "subdir", "nested");
    process.env.GITHUB_CODE_SEARCH_CACHE_DIR = subDir;
    const key = getCacheKey("myorg", ["squad-"]);
    // Should not throw
    expect(() => writeCache(key, { ok: true })).not.toThrow();
    expect(readCache(key)).toEqual({ ok: true });
  });

  it("silently ignores write errors on read-only paths", () => {
    process.env.GITHUB_CODE_SEARCH_CACHE_DIR = "/nonexistent/readonly/path";
    // writeCache must not throw even on filesystem errors
    expect(() => writeCache("key.json", { data: 1 })).not.toThrow();
  });
});
