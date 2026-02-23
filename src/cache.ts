import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Team-list cache ──────────────────────────────────────────────────────────
//
// The GitHub team list is quasi-static and can require dozens of API requests.
// We cache the result on disk for 24 h so repeated runs within a workday don't
// re-fetch it. Users can bypass the cache with --no-cache or purge it manually.

export const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

/**
 * Returns the OS-appropriate cache directory for the application:
 * - macOS  → ~/Library/Caches/github-code-search
 * - Linux  → $XDG_CACHE_HOME/github-code-search  (fallback: ~/.cache/github-code-search)
 * - Other  → ~/.github-code-search/cache
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
  const filePath = join(getCacheDir(), key);
  try {
    const stat = statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > CACHE_TTL_MS) return null;
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Serialises `data` and writes it to the cache directory under `key`.
 * Creates the cache directory if it does not already exist.
 * Silently ignores write errors (e.g. read-only filesystem) — caching is
 * best-effort and must never crash the CLI.
 */
export function writeCache<T>(key: string, data: T): void {
  try {
    const dir = getCacheDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, key), JSON.stringify(data), "utf8");
  } catch {
    // Best-effort: ignore write errors
  }
}
