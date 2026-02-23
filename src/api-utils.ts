// ─── API utilities — pagination and retry helpers ─────────────────────────────
//
// Pure-async helpers with no side effects beyond network I/O. These are the
// only place in the codebase that knows about GitHub rate-limit semantics.

const RETRYABLE_STATUSES = new Set([429, 503]);
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Performs a `fetch` with automatic retry on 429 (rate-limited) and 503
 * (server unavailable), using exponential backoff with optional `Retry-After`
 * header support.
 *
 * Non-retryable responses (including successful ones) are returned immediately.
 * After `maxRetries` exhausted the last response is returned — callers must
 * still check `res.ok`.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (!RETRYABLE_STATUSES.has(res.status) || attempt >= maxRetries) {
      return res;
    }
    const retryAfterHeader = res.headers.get("Retry-After");
    let delayMs: number;
    if (retryAfterHeader !== null) {
      const seconds = parseInt(retryAfterHeader, 10);
      delayMs =
        Number.isFinite(seconds) && seconds > 0
          ? seconds * 1_000
          : Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
    } else {
      delayMs = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
    }
    // Add ±10 % jitter to avoid thundering-herd on concurrent retries
    delayMs = delayMs * (0.9 + Math.random() * 0.2);
    // Cancel the response body to allow the connection to be reused
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, delayMs));
    attempt++;
  }
}

/**
 * Fetches all pages from a paginated GitHub API endpoint.
 *
 * Calls `fetchPage(pageNumber)` starting at page 1 and stops when the
 * returned array contains fewer items than `pageSize` (last page signal).
 *
 * @param fetchPage  Function that fetches a single page and returns its items.
 *                   Should throw on unrecoverable errors.
 * @param pageSize   Expected maximum items per page (default 100). Used as the
 *                   stop condition: `items.length < pageSize → last page`.
 * @param delayMs    Optional inter-page delay in milliseconds. Useful to stay
 *                   polite with rate limits on high-volume endpoints.
 */
export async function paginatedFetch<T>(
  fetchPage: (page: number) => Promise<T[]>,
  pageSize = 100,
  delayMs = 0,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < pageSize) break;
    page++;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return all;
}
