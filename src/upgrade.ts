// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  assets: ReleaseAsset[];
}

// ─── Version comparison ───────────────────────────────────────────────────────

/**
 * Returns true if `latest` is strictly newer than `current`.
 * Both strings may be prefixed with "v" (e.g. "v1.2.3" or "1.2.3").
 * When `current` is "dev" (running from source), always returns false.
 */
const parseVersion = (v: string) => v.replace(/^v/, "").split(".").map(Number);

export function isNewerVersion(current: string, latest: string): boolean {
  if (current === "dev") return false;
  const a = parseVersion(current);
  const b = parseVersion(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (bi > ai) return true;
    if (ai > bi) return false;
  }
  return false;
}

// ─── Asset selection ──────────────────────────────────────────────────────────

/**
 * Picks the release asset matching the current platform and architecture.
 * Expected asset naming convention:
 *   github-code-search-<platform>-<arch>          (e.g. darwin-arm64)
 *   github-code-search-<platform>-<arch>.exe      (Windows)
 */
export function selectAsset(
  assets: ReleaseAsset[],
  platform: string,
  arch: string,
): ReleaseAsset | null {
  const suffix = platform === "win32" ? ".exe" : "";
  const name = `github-code-search-${platform}-${arch}${suffix}`;
  return assets.find((a) => a.name === name) ?? null;
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

export async function fetchLatestRelease(token?: string): Promise<GithubRelease> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("https://api.github.com/repos/fulll/github-code-search/releases/latest", {
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<GithubRelease>;
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Downloads a binary from `url` and atomically replaces `dest`.
 * Uses a ".tmp" sibling file so the replacement is atomic on the same FS.
 */
async function downloadBinary(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const tmpPath = `${dest}.tmp`;
  await Bun.write(tmpPath, res);
  // Make executable and atomically replace the binary
  const chmod = Bun.spawnSync(["chmod", "+x", tmpPath]);
  if (chmod.exitCode !== 0) {
    throw new Error(`chmod failed: ${chmod.stderr.toString()}`);
  }
  const mv = Bun.spawnSync(["mv", tmpPath, dest]);
  if (mv.exitCode !== 0) {
    throw new Error(`mv failed: ${mv.stderr.toString()}`);
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Checks for a newer release and, if found, downloads and replaces `execPath`.
 */
export async function performUpgrade(
  currentVersion: string,
  execPath: string,
  token?: string,
): Promise<void> {
  if (currentVersion === "dev") {
    process.stdout.write(
      "Running from source (dev). Upgrade is only available for compiled binaries.\n",
    );
    return;
  }

  process.stdout.write("Checking for updates…\n");
  const release = await fetchLatestRelease(token);
  const latestVersion = release.tag_name;

  if (!isNewerVersion(currentVersion, latestVersion)) {
    process.stdout.write(`Already up to date (${currentVersion}).\n`);
    return;
  }

  const asset = selectAsset(release.assets, process.platform, process.arch);
  if (!asset) {
    throw new Error(
      `No binary found for platform ${process.platform}/${process.arch} in release ${latestVersion}.`,
    );
  }

  process.stdout.write(`Upgrading ${currentVersion} → ${latestVersion}…\n`);
  await downloadBinary(asset.browser_download_url, execPath);
  process.stdout.write(`Successfully upgraded to ${latestVersion}.\n`);
}
