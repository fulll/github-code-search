import { afterEach, describe, expect, it } from "bun:test";
import { fetchLatestRelease, isNewerVersion, performUpgrade, selectAsset } from "./upgrade.ts";
import type { ReleaseAsset } from "./upgrade.ts";

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
    browser_download_url: `https://example.com/releases/${name}`,
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
      new Response(JSON.stringify({ tag_name: "v1.2.0", assets: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const release = await fetchLatestRelease("faketoken");
    expect(release.tag_name).toBe("v1.2.0");
    expect(release.assets).toHaveLength(0);
  });

  it("works without a token", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tag_name: "v2.0.0", assets: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
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
      new Response(JSON.stringify({ tag_name: "v1.0.0", assets: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => {
      writes.push(s);
      return true;
    }) as typeof process.stdout.write;

    await performUpgrade("1.0.0", "/tmp/test-binary-uptodate");
    process.stdout.write = origWrite;

    expect(writes.some((s) => s.includes("up to date"))).toBe(true);
  });

  it("throws when no matching binary asset found in the release", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tag_name: "v9.9.9", assets: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    await expect(performUpgrade("1.0.0", "/tmp/test-binary-noasset")).rejects.toThrow(
      "No binary found",
    );
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
    const platformMap: Record<string, string> = { darwin: "macos", win32: "windows" };
    const p = platformMap[process.platform] ?? process.platform;
    const suffix = p === "windows" ? ".exe" : "";
    const assetName = `github-code-search-${p}-${process.arch}${suffix}`;
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ tag_name: "v9.9.9", assets: [makeAsset(assetName)] }),
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
    (Bun as any).spawnSync = () => ({ exitCode: 0, stderr: { toString: () => "" } });

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
    expect(stdoutWrites.some((s) => s.includes("Successfully upgraded"))).toBe(true);
  });
});
