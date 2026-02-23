// ─── API utilities — pagination and retry helpers ─────────────────────────────
//
// Pure-async helpers with no side effects beyond network I/O. These are the
// only place in the codebase that knows about GitHub rate-limit semantics.

const RETRYABLE_STATUSES = new Set([429, 503]);
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;
// Above this threshold the user is told to wait manually rather than blocking.
const MAX_AUTO_RETRY_WAIT_MS = 10_000; // 10 seconds

/**
 * Format a millisecond duration as a human-readable "retry in …" string.
 * Values ≥ 60 s are expressed in minutes (and seconds when non-zero).
 *
 * @example formatRetryWait(90_000) → "1 minute and 30 seconds"
 * @example formatRetryWait(3_600_000) → "60 minutes"
 * @example formatRetryWait(5_000) → "5 seconds"
 */
export function formatRetryWait(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1_000);
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const minStr = `${mins} minute${mins !== 1 ? "s" : ""}`;
    if (secs === 0) return minStr;
    return `${minStr} and ${secs} second${secs !== 1 ? "s" : ""}`;
  }
  return `${totalSeconds} second${totalSeconds !== 1 ? "s" : ""}`;
}

/**
 * Returns true when the response is a GitHub primary rate-limit 403
 * (x-ratelimit-remaining is "0").
 */
function isRateLimitExceeded(res: Response): boolean {
  return res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
}

/**
 * Compute the delay in milliseconds before the next retry attempt.
 * Prefers x-ratelimit-reset (Unix timestamp) > Retry-After header >
 * exponential back-off.
 */
function getRetryDelayMs(res: Response, attempt: number): number {
  // x-ratelimit-reset: Unix timestamp (seconds) when the quota refills
  const resetHeader = res.headers.get("x-ratelimit-reset");
  if (resetHeader !== null) {
    const resetTime = parseInt(resetHeader, 10);
    if (Number.isFinite(resetTime)) {
      return Math.max(0, resetTime * 1_000 - Date.now());
    }
  }
  // Retry-After: seconds to wait (used by 429 / secondary rate limits)
  const retryAfterHeader = res.headers.get("Retry-After");
  if (retryAfterHeader !== null) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1_000;
    }
  }
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

/**
 * Performs a `fetch` with automatic retry on 429 (rate-limited), 503
 * (server unavailable) and 403 primary rate-limit responses, using
 * exponential backoff with optional `Retry-After` / `x-ratelimit-reset`
 * header support.
 *
 * Non-retryable responses (including successful ones) are returned immediately.
 * After `maxRetries` exhausted the last response is returned — callers must
 * still check `res.ok`.
 *
 * When the computed wait exceeds MAX_AUTO_RETRY_WAIT_MS the function throws a
 * descriptive error so the user isn't silently blocked for minutes.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);

    // Fix: handle GitHub primary rate-limit (403 + x-ratelimit-remaining: 0)
    // in addition to the standard 429/503 retryable statuses — see issue #22
    const retryable = RETRYABLE_STATUSES.has(res.status) || isRateLimitExceeded(res);
    if (!retryable || attempt >= maxRetries) {
      return res;
    }

    // Compute the base delay (no jitter yet) so the threshold check and the
    // error message both reflect the real wait time reported by the API.
    const baseDelayMs = getRetryDelayMs(res, attempt);

    if (baseDelayMs > MAX_AUTO_RETRY_WAIT_MS) {
      // Cancel the response body before throwing to allow connection reuse
      await res.body?.cancel();
      throw new Error(
        `GitHub API rate limit exceeded. Please retry in ${formatRetryWait(baseDelayMs)}.`,
      );
    }

    // Add ±10 % jitter to avoid thundering-herd on concurrent retries
    const delayMs = baseDelayMs * (0.9 + Math.random() * 0.2);
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
