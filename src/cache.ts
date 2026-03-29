import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

// ─── Team-list cache ──────────────────────────────────────────────────────────
//
// The GitHub team list is quasi-static and can require dozens of API requests.
// We cache the result on disk for 24 h so repeated runs within a workday don't
// re-fetch it. Users can bypass the cache with --no-cache or purge it manually.

export const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

/**
 * Returns the OS-appropriate cache directory for the application:
 * - macOS   → ~/Library/Caches/github-code-search
 * - Linux   → $XDG_CACHE_HOME/github-code-search  (fallback: ~/.cache/github-code-search)
 * - Windows → %LOCALAPPDATA%\github-code-search   (fallback: ~/AppData/Local/github-code-search)
 * - Other   → ~/.github-code-search/cache
 *
 * Override with `GITHUB_CODE_SEARCH_CACHE_DIR` env var (useful in tests and CI).
 */
export function getCacheDir(): string {
  const override = process.env.GITHUB_CODE_SEARCH_CACHE_DIR;
  if (override && override.trim() !== "") return override.trim();

  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Caches", "github-code-search");
  }
  if (platform === "linux") {
    const xdg = process.env.XDG_CACHE_HOME;
    const base = xdg && xdg.trim() !== "" ? xdg : join(homedir(), ".cache");
    return join(base, "github-code-search");
  }
  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const base =
      localAppData && localAppData.trim() !== ""
        ? localAppData
        : join(homedir(), "AppData", "Local");
    return join(base, "github-code-search");
  }
  return join(homedir(), ".github-code-search", "cache");
}

// Replace characters that are problematic in file names with underscores
function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * Returns a deterministic, filesystem-safe cache key (file name) for a given
 * org + prefixes combination. Prefixes are sorted before hashing so that
 * `["squad-", "chapter-"]` and `["chapter-", "squad-"]` hit the same entry.
 */
export function getCacheKey(org: string, prefixes: string[]): string {
  const sortedPrefixes = prefixes.toSorted();
  const parts = [safeFilename(org), ...sortedPrefixes.map(safeFilename)].join("__");
  return `teams__${parts}.json`;
}

/**
 * Reads and deserialises a cache entry from disk.
 * Returns `null` when:
 * - the file does not exist
 * - the file cannot be parsed as JSON
 * - the file is older than `CACHE_TTL_MS`
 */
export function readCache<T>(key: string): T | null {
  // Reject keys containing path separators or absolute-path markers
  // before any filesystem operation (defence-in-depth for static analysers).
  if (key.includes("/") || key.includes("\\") || isAbsolute(key)) return null;
  const base = resolve(getCacheDir());
  const target = resolve(base, key);
  const rel = relative(base, target);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) return null;
  // Fix: open the file once and use fstatSync on the same fd to avoid a
  // TOCTOU race condition between the age check and the read.
  // O_NOFOLLOW prevents symlink hijacking in world-writable directories
  // (CWE-377). On Windows the constant is undefined so we fall back to 0.
  const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;
  let fd: number | null = null;
  try {
    fd = openSync(target, constants.O_RDONLY | O_NOFOLLOW);
    const stat = fstatSync(fd);
    // Verify the descriptor points to a regular file — prevents reading from
    // FIFOs or device files that could block or expose unintended data (CWE-377).
    if (!stat.isFile()) return null;
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > CACHE_TTL_MS) return null;
    const raw = readFileSync(fd, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/**
 * Serialises `data` and writes it to the cache directory under `key`.
 * Creates the cache directory if it does not already exist.
 * Silently ignores write errors (e.g. read-only filesystem) — caching is
 * best-effort and must never crash the CLI.
 */
export function writeCache<T>(key: string, data: T): void {
  // Fix: write to a randomly-named temp file first, then rename atomically to
  // the target path. This avoids symlink/race attacks on the cache directory
  // and ensures readers never observe a partially-written file.
  try {
    // Reject keys containing path separators or absolute-path markers
    // before any filesystem operation (defence-in-depth for static analysers).
    if (key.includes("/") || key.includes("\\") || isAbsolute(key)) return;
    const dir = getCacheDir();
    const base = resolve(dir);
    const target = resolve(base, key);
    const rel = relative(base, target);
    if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) return;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmpPath = `${target}.${randomBytes(6).toString("hex")}.tmp`;
    // mode 0o600: owner-only read/write, so the temp file is private even
    // when the parent directory is world-writable (CWE-377).
    writeFileSync(tmpPath, JSON.stringify(data), { encoding: "utf8", flag: "wx", mode: 0o600 });
    // Fix: on Windows, renameSync fails if the destination already exists
    // (unlike POSIX where it is atomic). Unlink the target first on win32
    // to restore replace semantics without sacrificing atomicity on POSIX.
    if (process.platform === "win32") {
      try {
        unlinkSync(target);
      } catch {
        // Target may not exist yet — ignore
      }
    }
    renameSync(tmpPath, target);
  } catch {
    // Best-effort: ignore write errors
  }
}
