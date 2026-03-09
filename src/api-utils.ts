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
 * Returns true when the response is a GitHub rate-limit response.
 *
 * Standard rate limit: 429 Too Many Requests
 * Primary rate limit:  403 + x-ratelimit-remaining: 0
 * Secondary rate limit: 403 + Retry-After header
 *   (see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
 */
function isRateLimitExceeded(res: Response): boolean {
  // 429 Too Many Requests is always a rate-limit response.
  if (res.status === 429) return true;
  // 403 is a GitHub-specific rate-limit when accompanied by the right headers.
  if (res.status !== 403) return false;
  return (
    res.headers.get("x-ratelimit-remaining") === "0" || res.headers.get("Retry-After") !== null
  );
}

/**
 * Compute the delay in milliseconds before the next retry attempt.
 * Prefers x-ratelimit-reset (Unix timestamp) > Retry-After header >
 * exponential back-off.
 */
function getRetryDelayMs(res: Response, attempt: number): number {
  // x-ratelimit-reset: Unix timestamp (seconds) when the quota refills.
  // Add a 1 s buffer to guard against clock skew between client and GitHub
  // servers — without it the first retry can arrive fractionally early and
  // immediately hit the same limit again.
  const resetHeader = res.headers.get("x-ratelimit-reset");
  if (resetHeader !== null) {
    const resetTime = parseInt(resetHeader, 10);
    if (Number.isFinite(resetTime)) {
      return Math.max(0, resetTime * 1_000 - Date.now() + 1_000);
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
 * Sleep for `ms` milliseconds. If `signal` is provided and aborts before the
 * timer fires, the promise rejects with the signal's abort reason. This makes
 * the inter-retry delay abort-aware, consistent with the `fetch` call itself.
 */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    // Extract the handler so it can be removed when the timer fires, preventing
    // listener accumulation across many retries.
    const onAbort = () => {
      clearTimeout(id);
      reject(signal!.reason ?? new DOMException("Aborted", "AbortError"));
    };
    // Attach the listener BEFORE starting the timer so an abort that fires
    // between the initial check and addEventListener is not missed.
    signal?.addEventListener("abort", onAbort, { once: true });
    // Re-check after attaching to close the race window: if the signal was
    // aborted in between, clean up and reject synchronously.
    if (signal?.aborted) {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
  });
}

/**
 * Performs a `fetch` with automatic retry on 429 (rate-limited), 503
 * (server unavailable) and 403 rate-limit responses (both primary and
 * secondary), using exponential backoff with optional `Retry-After` /
 * `x-ratelimit-reset` header support.
 *
 * Non-retryable responses (including successful ones) are returned immediately.
 * After `maxRetries` exhausted the last response is returned — callers must
 * still check `res.ok`.
 *
 * When the computed wait exceeds MAX_AUTO_RETRY_WAIT_MS:
 * - Without `onRateLimit`: throws a descriptive error immediately.
 * - With `onRateLimit`: **awaits** the callback, which **must** sleep for (at
 *   least) `waitMs` milliseconds — e.g. by showing a countdown timer. A
 *   callback that returns immediately without sleeping will cause the loop to
 *   retry at once and exhaust `longWaitAttempts` very quickly.
 *   These long waits do **not** count against `maxRetries`; a separate
 *   `longWaitAttempts` counter (also capped at `maxRetries`) prevents infinite
 *   loops when the rate-limit never clears.
 *
 * Short retries (wait ≤ MAX_AUTO_RETRY_WAIT_MS) honour `options.signal` —
 * aborting during the delay rejects the promise with the signal's abort reason.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  onRateLimit?: (waitMs: number) => Promise<void>,
): Promise<Response> {
  let attempt = 0;
  let longWaitAttempts = 0;
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
      // Cancel the response body before waiting/throwing to allow connection reuse
      await res.body?.cancel();
      if (!onRateLimit || longWaitAttempts >= maxRetries) {
        // Produce an accurate message: 403/429 are rate-limit errors; 503 is a
        // server backoff that should not be labelled "rate limit exceeded".
        const messagePrefix = isRateLimitExceeded(res)
          ? "GitHub API rate limit exceeded."
          : "GitHub API requested a long backoff before retrying.";
        throw new Error(`${messagePrefix} Please retry in ${formatRetryWait(baseDelayMs)}.`);
      }
      // Fix: await the callback — it owns the sleep so it can show a countdown
      // and honour an AbortSignal. Long waits do NOT count against maxRetries;
      // longWaitAttempts (capped at maxRetries) guards against infinite loops.
      // — see issue #102
      longWaitAttempts++;
      await onRateLimit(baseDelayMs);
      continue; // do NOT increment attempt
    }

    // Add ±10 % jitter to avoid thundering-herd on concurrent retries
    const delayMs = baseDelayMs * (0.9 + Math.random() * 0.2);
    // Cancel the response body to allow the connection to be reused
    await res.body?.cancel();
    // Honour the caller's AbortSignal during the short wait
    await abortableDelay(delayMs, options.signal ?? undefined);
    attempt++;
  }
}

/**
 * Runs `fn` over every item in `items` with at most `concurrency` tasks
 * running in parallel at any one time (semaphore pattern, no extra deps).
 *
 * Results are returned in input order regardless of completion order.
 * All items are processed even if some `fn` calls throw; the first error
 * encountered is recorded and re-thrown only after all work has completed.
 */
export async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  { concurrency = 20 }: { concurrency?: number } = {},
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(
      `concurrentMap: concurrency must be a positive integer, got ${concurrency}`,
    );
  }
  const results: R[] = Array.from({ length: items.length }) as R[];
  let nextIndex = 0;
  let firstError: unknown;
  let hasError = false;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        if (!hasError) {
          hasError = true;
          firstError = err;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (hasError) throw firstError;
  return results;
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
