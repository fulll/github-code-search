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
 *   github-code-search-<platform>-<arch>          (e.g. macos-arm64)
 *   github-code-search-<platform>-<arch>.exe      (Windows)
 *
 * Node.js/Bun platform names are mapped to artifact names:
 *   darwin → macos
 *   win32  → windows
 *
 * A legacy fallback also tries the raw Node.js platform name (darwin, win32)
 * so that binaries built before v1.2.1 can still upgrade themselves.
 */
export function selectAsset(
  assets: ReleaseAsset[],
  platform: string,
  arch: string,
): ReleaseAsset | null {
  const platformMap: Record<string, string> = {
    darwin: "macos",
    win32: "windows",
  };
  const artifactPlatform = platformMap[platform] ?? platform;
  const suffix = artifactPlatform === "windows" ? ".exe" : "";
  const name = `github-code-search-${artifactPlatform}-${arch}${suffix}`;
  // Fix: fall back to legacy platform names (darwin, win32) published alongside
  // the canonical names for backward-compat with pre-v1.2.1 binaries — see issue #45
  const legacySuffix = platform === "win32" ? ".exe" : "";
  const legacyName = `github-code-search-${platform}-${arch}${legacySuffix}`;
  return assets.find((a) => a.name === name) ?? assets.find((a) => a.name === legacyName) ?? null;
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
async function downloadBinary(url: string, dest: string, debug = false): Promise<void> {
  if (debug) process.stdout.write(`[debug] downloading from ${url}\n`);
  const res = await fetch(url);
  if (debug)
    process.stdout.write(
      `[debug] fetch response: status=${res.status} ok=${res.ok} url=${res.url}\n`,
    );
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  // Fix: read the body explicitly as an ArrayBuffer rather than passing the
  // Response object to Bun.write, which avoids edge-case issues with Response
  // body streaming on certain Bun versions.
  const buffer = await res.arrayBuffer();
  if (debug) process.stdout.write(`[debug] downloaded ${buffer.byteLength} bytes\n`);
  if (buffer.byteLength === 0) {
    throw new Error(`Downloaded empty file from ${url}`);
  }
  const tmpPath = `${dest}.tmp`;
  process.stdout.write(`Replacing ${dest}…\n`);
  await Bun.write(tmpPath, buffer);
  if (debug) process.stdout.write(`[debug] wrote tmp file ${tmpPath}\n`);
  // Remove quarantine attribute if present (macOS only) so Gatekeeper
  // does not block the replaced binary on the next run.
  if (process.platform === "darwin") {
    const xattr = Bun.spawnSync(["xattr", "-d", "com.apple.quarantine", tmpPath]);
    if (debug) process.stdout.write(`[debug] xattr exit=${xattr.exitCode} (ignore ENOATTR)\n`);
  }
  // Make executable and atomically replace the binary
  const chmod = Bun.spawnSync(["chmod", "+x", tmpPath]);
  if (chmod.exitCode !== 0) {
    throw new Error(`chmod failed: ${chmod.stderr.toString()}`);
  }
  if (debug) process.stdout.write(`[debug] chmod +x done\n`);
  const mv = Bun.spawnSync(["mv", tmpPath, dest]);
  if (mv.exitCode !== 0) {
    throw new Error(`mv failed: ${mv.stderr.toString()}`);
  }
  if (debug) process.stdout.write(`[debug] mv done → ${dest}\n`);
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Checks for a newer release and, if found, downloads and replaces `execPath`.
 */
export async function performUpgrade(
  currentVersion: string,
  execPath: string,
  token?: string,
  debug = false,
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
  if (debug) {
    process.stdout.write(
      `[debug] available assets: ${release.assets.map((a) => a.name).join(", ")}\n`,
    );
    process.stdout.write(`[debug] selected asset: ${asset?.name ?? "(none)"}\n`);
  }
  if (!asset) {
    throw new Error(
      `No binary found for platform ${process.platform}/${process.arch} in release ${latestVersion}.`,
    );
  }

  process.stdout.write(`Upgrading ${currentVersion} → ${latestVersion}…\n`);
  await downloadBinary(asset.browser_download_url, execPath, debug);
  process.stdout.write(`Successfully upgraded to ${latestVersion}.\n`);
}
