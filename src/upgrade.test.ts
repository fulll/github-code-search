import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blogPostUrl,
  checkForUpdate,
  fetchLatestRelease,
  isNewerVersion,
  performUpgrade,
  refreshCompletions,
  selectAsset,
} from "./upgrade.ts";
import type { ReleaseAsset } from "./upgrade.ts";
// ─── blogPostUrl ─────────────────────────────────────────────────────────────────

describe("blogPostUrl", () => {
  it("converts a semver tag to the expected blog URL", () => {
    expect(blogPostUrl("v1.2.3")).toBe(
      "https://fulll.github.io/github-code-search/blog/release-v1-2-3",
    );
  });

  it("handles a major-only release tag", () => {
    expect(blogPostUrl("v2.0.0")).toBe(
      "https://fulll.github.io/github-code-search/blog/release-v2-0-0",
    );
  });

  it("normalizes a tag without v-prefix", () => {
    // Fix: previously `replace(/^v/, "v")` was a no-op for tags like "1.2.3"
    expect(blogPostUrl("1.2.3")).toBe(
      "https://fulll.github.io/github-code-search/blog/release-v1-2-3",
    );
  });
});
// ─── isNewerVersion ───────────────────────────────────────────────────────────

describe("isNewerVersion", () => {
  it("returns false when versions are equal", () => {
    expect(isNewerVersion("1.2.3", "1.2.3")).toBe(false);
  });

  it("returns false when versions are equal with v prefix", () => {
    expect(isNewerVersion("1.2.3", "v1.2.3")).toBe(false);
  });

  it("returns true when patch is newer", () => {
    expect(isNewerVersion("1.2.3", "1.2.4")).toBe(true);
  });

  it("returns true when minor is newer", () => {
    expect(isNewerVersion("1.2.3", "1.3.0")).toBe(true);
  });

  it("returns true when major is newer", () => {
    expect(isNewerVersion("1.2.3", "2.0.0")).toBe(true);
  });

  it("returns false when current is newer than latest", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
  });

  it("returns false when current is 'dev'", () => {
    expect(isNewerVersion("dev", "9.9.9")).toBe(false);
  });

  it("handles missing patch component in latest", () => {
    expect(isNewerVersion("1.0.0", "1.1")).toBe(true);
  });

  it("handles v prefix on current version only", () => {
    expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
  });
});

// ─── selectAsset ──────────────────────────────────────────────────────────────

function makeAsset(name: string): ReleaseAsset {
  return {
    name,
    browser_download_url: `https://github.com/fulll/github-code-search/releases/download/v9.9.9/${name}`,
  };
}

describe("selectAsset", () => {
  const assets: ReleaseAsset[] = [
    makeAsset("github-code-search-macos-arm64"),
    makeAsset("github-code-search-macos-x64"),
    makeAsset("github-code-search-linux-x64"),
    makeAsset("github-code-search-linux-arm64"),
    makeAsset("github-code-search-windows-x64.exe"),
  ];

  it("selects macos-arm64 asset for darwin/arm64", () => {
    const asset = selectAsset(assets, "darwin", "arm64");
    expect(asset?.name).toBe("github-code-search-macos-arm64");
  });

  it("selects macos-x64 asset for darwin/x64", () => {
    const asset = selectAsset(assets, "darwin", "x64");
    expect(asset?.name).toBe("github-code-search-macos-x64");
  });

  it("selects linux-x64 asset", () => {
    const asset = selectAsset(assets, "linux", "x64");
    expect(asset?.name).toBe("github-code-search-linux-x64");
  });

  it("selects linux-arm64 asset", () => {
    const asset = selectAsset(assets, "linux", "arm64");
    expect(asset?.name).toBe("github-code-search-linux-arm64");
  });

  it("selects windows-x64 asset with .exe suffix for win32/x64", () => {
    const asset = selectAsset(assets, "win32", "x64");
    expect(asset?.name).toBe("github-code-search-windows-x64.exe");
  });

  it("returns null when no matching asset is found", () => {
    const asset = selectAsset(assets, "freebsd", "x64");
    expect(asset).toBeNull();
  });

  it("returns null for empty asset list", () => {
    expect(selectAsset([], "darwin", "arm64")).toBeNull();
  });

  describe("legacy fallback (pre-v1.2.1 asset names)", () => {
    const legacyAssets: ReleaseAsset[] = [
      makeAsset("github-code-search-darwin-arm64"),
      makeAsset("github-code-search-darwin-x64"),
      makeAsset("github-code-search-linux-x64"),
      makeAsset("github-code-search-linux-arm64"),
      makeAsset("github-code-search-win32-x64.exe"),
    ];

    it("falls back to darwin-arm64 when macos-arm64 is absent", () => {
      const asset = selectAsset(legacyAssets, "darwin", "arm64");
      expect(asset?.name).toBe("github-code-search-darwin-arm64");
    });

    it("falls back to darwin-x64 when macos-x64 is absent", () => {
      const asset = selectAsset(legacyAssets, "darwin", "x64");
      expect(asset?.name).toBe("github-code-search-darwin-x64");
    });

    it("falls back to win32-x64.exe when windows-x64.exe is absent", () => {
      const asset = selectAsset(legacyAssets, "win32", "x64");
      expect(asset?.name).toBe("github-code-search-win32-x64.exe");
    });

    it("prefers canonical macos-arm64 over legacy darwin-arm64 when both present", () => {
      const mixed = [
        makeAsset("github-code-search-darwin-arm64"),
        makeAsset("github-code-search-macos-arm64"),
      ];
      const asset = selectAsset(mixed, "darwin", "arm64");
      expect(asset?.name).toBe("github-code-search-macos-arm64");
    });
  });
});

// ─── fetchLatestRelease ─────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

describe("fetchLatestRelease", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns release data from the GitHub API", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v1.2.0",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v1.2.0",
          assets: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch;
    const release = await fetchLatestRelease("faketoken");
    expect(release.tag_name).toBe("v1.2.0");
    expect(release.html_url).toBe(
      "https://github.com/fulll/github-code-search/releases/tag/v1.2.0",
    );
    expect(release.assets).toHaveLength(0);
  });

  it("works without a token", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v2.0.0",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v2.0.0",
          assets: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch;
    const release = await fetchLatestRelease();
    expect(release.tag_name).toBe("v2.0.0");
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = (async () => new Response("Not Found", { status: 404 })) as typeof fetch;
    await expect(fetchLatestRelease()).rejects.toThrow("404");
  });
});

// ─── performUpgrade ────────────────────────────────────────────────────────

describe("performUpgrade", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("prints 'source' message and returns when version is 'dev'", async () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      writes.push(s);
      return true;
    }) as typeof process.stdout.write;

    await performUpgrade("dev", "/tmp/test-binary-dev");
    process.stdout.write = origWrite;

    expect(writes.some((s) => s.toLowerCase().includes("source"))).toBe(true);
  });

  it("prints 'up to date' when no newer version", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v1.0.0",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v1.0.0",
          assets: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch;

    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      writes.push(s);
      return true;
    }) as typeof process.stdout.write;

    await performUpgrade("1.0.0", "/tmp/test-binary-uptodate");
    process.stdout.write = origWrite;

    const output = writes.join("");
    expect(output).toInclude("Congrats");
    expect(output).toInclude("latest version");
    expect(output).toInclude("v1.0.0");
  });

  it("throws when no matching binary asset found in the release", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v9.9.9",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v9.9.9",
          assets: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as typeof fetch;

    await expect(performUpgrade("1.0.0", "/tmp/test-binary-noasset")).rejects.toThrow(
      "No binary found",
    );
  });
});

// ─── checkForUpdate ───────────────────────────────────────────────────────────────

describe("checkForUpdate", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the latest version tag when a newer version exists", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v2.0.0",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v2.0.0",
          assets: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    const result = await checkForUpdate("1.0.0");
    expect(result).toBe("v2.0.0");
  });

  it("returns null when already on the latest version", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v1.0.0",
          html_url: "https://github.com/fulll/github-code-search/releases/tag/v1.0.0",
          assets: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    const result = await checkForUpdate("1.0.0");
    expect(result).toBeNull();
  });

  it("returns null for dev version", async () => {
    const result = await checkForUpdate("dev");
    expect(result).toBeNull();
  });

  it("returns null silently on network error", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("network failure"))) as typeof fetch;
    const result = await checkForUpdate("1.0.0");
    expect(result).toBeNull();
  });

  it("returns null on non-OK API response", async () => {
    globalThis.fetch = (async () => new Response("Not Found", { status: 404 })) as typeof fetch;
    const result = await checkForUpdate("1.0.0");
    expect(result).toBeNull();
  });

  it("returns null when given an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    // fetch will throw an AbortError; checkForUpdate must catch it and return null.
    globalThis.fetch = (async (_url: string, opts?: RequestInit) => {
      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      throw new Error("fetch should not succeed with an aborted signal");
    }) as typeof fetch;
    const result = await checkForUpdate("1.0.0", undefined, controller.signal);
    expect(result).toBeNull();
  });
});

// ─── performUpgrade — download path (covers downloadBinary) ──────────────────

describe("performUpgrade — download path", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origBunWrite = (Bun as any).write;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origBunSpawnSync = (Bun as any).spawnSync;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).write = origBunWrite;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).spawnSync = origBunSpawnSync;
  });

  /** Returns a release mock + matching asset name for the current platform. */
  function mockReleaseAndDownload(downloadResponse: Response): void {
    const platformMap: Record<string, string> = {
      darwin: "macos",
      win32: "windows",
    };
    const p = platformMap[process.platform] ?? process.platform;
    const suffix = p === "windows" ? ".exe" : "";
    const assetName = `github-code-search-${p}-${process.arch}${suffix}`;
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            tag_name: "v9.9.9",
            html_url: "https://github.com/fulll/github-code-search/releases/tag/v9.9.9",
            assets: [makeAsset(assetName)],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return downloadResponse;
    }) as typeof fetch;
  }

  it("throws when the binary download returns a non-OK status", async () => {
    mockReleaseAndDownload(new Response("Bad Gateway", { status: 502 }));
    await expect(performUpgrade("1.0.0", "/tmp/gcs-test-nonok")).rejects.toThrow(
      "Download failed (502)",
    );
  });

  it("throws when the downloaded binary is empty", async () => {
    mockReleaseAndDownload(new Response(new ArrayBuffer(0), { status: 200 }));
    await expect(performUpgrade("1.0.0", "/tmp/gcs-test-empty")).rejects.toThrow("empty file");
  });

  it("prints Upgrading and Successfully upgraded on a successful full upgrade", async () => {
    mockReleaseAndDownload(new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).write = async () => 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).spawnSync = () => ({
      exitCode: 0,
      stderr: { toString: () => "" },
    });

    const stdoutWrites: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      stdoutWrites.push(s);
      return true;
    }) as typeof process.stdout.write;

    await performUpgrade("1.0.0", "/tmp/gcs-test-success");
    process.stdout.write = origWrite;

    expect(stdoutWrites.some((s) => s.includes("Upgrading"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("Replacing"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("Welcome to github-code-search"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("What's new"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("blog/release-v9-9-9"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("Commit log"))).toBe(true);
    expect(stdoutWrites.some((s) => s.includes("Report a bug"))).toBe(true);
  });

  /** Sets up a release API mock and returns the per-platform asset name. */
  function mockReleaseApi(): string {
    const platformMap: Record<string, string> = { darwin: "macos", win32: "windows" };
    const p = platformMap[process.platform] ?? process.platform;
    const suffix = p === "windows" ? ".exe" : "";
    const assetName = `github-code-search-${p}-${process.arch}${suffix}`;
    let firstCall = true;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (firstCall) {
        firstCall = false;
        return new Response(
          JSON.stringify({
            tag_name: "v9.9.9",
            html_url: "https://github.com/fulll/github-code-search/releases/tag/v9.9.9",
            assets: [makeAsset(assetName)],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return origFetch(url, init);
    }) as typeof fetch;
    return assetName;
  }

  it("throws when the binary download redirects to a non-allowed host", async () => {
    mockReleaseApi();
    // Override fetch so the download returns a redirect to an attacker-controlled host
    const origFetch = globalThis.fetch;
    let releaseApiDone = false;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!releaseApiDone) {
        releaseApiDone = true;
        return origFetch(url, init);
      }
      return new Response(null, {
        status: 302,
        headers: { location: "https://attacker.example.com/evil-binary" },
      });
    }) as typeof fetch;

    await expect(performUpgrade("1.0.0", "/tmp/gcs-test-ssrf-redirect")).rejects.toThrow(
      "Redirect blocked",
    );
  });

  it("throws when the binary download redirects to an http (non-https) URL", async () => {
    mockReleaseApi();
    const origFetch = globalThis.fetch;
    let releaseApiDone = false;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!releaseApiDone) {
        releaseApiDone = true;
        return origFetch(url, init);
      }
      return new Response(null, {
        status: 302,
        headers: { location: "http://github.com/downgrade-attack" },
      });
    }) as typeof fetch;

    await expect(performUpgrade("1.0.0", "/tmp/gcs-test-http-redirect")).rejects.toThrow(
      "Redirect blocked",
    );
  });

  it("throws when the download exceeds the maximum number of redirects", async () => {
    mockReleaseApi();
    const origFetch = globalThis.fetch;
    let releaseApiDone = false;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!releaseApiDone) {
        releaseApiDone = true;
        return origFetch(url, init);
      }
      // Always redirect to an allowed host to hit the redirect limit
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://github.com/fulll/github-code-search/releases/download/v9.9.9/binary",
        },
      });
    }) as typeof fetch;

    await expect(performUpgrade("1.0.0", "/tmp/gcs-test-too-many-redirects")).rejects.toThrow(
      "Too many redirects",
    );
  });

  it("follows a redirect to githubusercontent.com and completes successfully", async () => {
    mockReleaseApi();
    const origFetch = globalThis.fetch;
    let releaseApiDone = false;
    let redirectDone = false;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!releaseApiDone) {
        releaseApiDone = true;
        return origFetch(url, init);
      }
      if (!redirectDone) {
        redirectDone = true;
        // Simulate github.com → objects.githubusercontent.com redirect
        return new Response(null, {
          status: 302,
          headers: { location: "https://objects.githubusercontent.com/v9.9.9/binary" },
        });
      }
      return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 });
    }) as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).write = async () => 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).spawnSync = () => ({ exitCode: 0, stderr: { toString: () => "" } });

    await expect(
      performUpgrade("1.0.0", "/tmp/gcs-test-githubusercontent-redirect"),
    ).resolves.toBeUndefined();
  });
});

// ─── refreshCompletions ───────────────────────────────────────────────────────

describe("refreshCompletions", () => {
  // Save and clear XDG env vars — GitHub Actions runners have these set,
  // which would make getCompletionFilePath ignore the injected homeDir.
  let savedXdgConfigHome: string | undefined;
  let savedXdgDataHome: string | undefined;

  beforeEach(() => {
    savedXdgConfigHome = process.env.XDG_CONFIG_HOME;
    savedXdgDataHome = process.env.XDG_DATA_HOME;
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
  });

  afterEach(() => {
    if (savedXdgConfigHome !== undefined) process.env.XDG_CONFIG_HOME = savedXdgConfigHome;
    if (savedXdgDataHome !== undefined) process.env.XDG_DATA_HOME = savedXdgDataHome;
  });

  it("returns null when shell is null", async () => {
    expect(await refreshCompletions(null)).toBeNull();
  });

  it("creates the file even if it did not already exist", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    try {
      const result = await refreshCompletions("fish", tmp);
      const dir = join(tmp, ".config", "fish", "completions");
      expect(result).toBe(join(dir, "github-code-search.fish"));
      expect(existsSync(join(dir, "github-code-search.fish"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("overwrites an existing fish completion file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    try {
      const dir = join(tmp, ".config", "fish", "completions");
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, "github-code-search.fish");
      writeFileSync(filePath, "# old content");

      const result = await refreshCompletions("fish", tmp);
      expect(result).toBe(filePath);

      const updated = await Bun.file(filePath).text();
      expect(updated).toContain("github-code-search");
      expect(updated).not.toContain("# old content");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("overwrites an existing zsh completion file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    try {
      const dir = join(tmp, ".zfunc");
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, "_github-code-search");
      writeFileSync(filePath, "# old zsh content");

      const result = await refreshCompletions("zsh", tmp);
      expect(result).toBe(filePath);

      const updated = await Bun.file(filePath).text();
      expect(updated).toContain("compdef");
      expect(updated).not.toContain("# old zsh content");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("overwrites an existing bash completion file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    try {
      const dir = join(tmp, ".local", "share", "bash-completion", "completions");
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, "github-code-search");
      writeFileSync(filePath, "# old bash content");

      const result = await refreshCompletions("bash", tmp);
      expect(result).toBe(filePath);

      const updated = await Bun.file(filePath).text();
      expect(updated).toContain("complete ");
      expect(updated).not.toContain("# old bash content");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits a debug line when no completion file exists and debug=true", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    const stdoutWrites: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      stdoutWrites.push(s);
      return true;
    }) as typeof process.stdout.write;
    try {
      await refreshCompletions("bash", tmp, true);
      expect(
        stdoutWrites.some((s) => s.includes("[debug]") && s.includes("installing completions")),
      ).toBe(true);
    } finally {
      process.stdout.write = origWrite;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits a debug line when the file is refreshed and debug=true", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "gcs-test-"));
    const stdoutWrites: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      stdoutWrites.push(s);
      return true;
    }) as typeof process.stdout.write;
    try {
      const dir = join(tmp, ".config", "fish", "completions");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "github-code-search.fish"), "# old");

      await refreshCompletions("fish", tmp, true);
      expect(
        stdoutWrites.some((s) => s.includes("[debug]") && s.includes("refreshing completions")),
      ).toBe(true);
    } finally {
      process.stdout.write = origWrite;
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
