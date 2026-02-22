import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { fetchWithRetry, paginatedFetch } from "./api-utils.ts";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;

// Make all delays instant in tests so the suite stays fast
beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test-only shim
  globalThis.setTimeout = ((fn: () => void, _delay?: number) => {
    fn();
    return 0;
  }) as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
});

// ─── fetchWithRetry ───────────────────────────────────────────────────────────

describe("fetchWithRetry", () => {
  it("returns a 200 response immediately without retrying", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {});
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("returns a non-retryable error response (404) immediately without retrying", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  });

  it("returns a non-retryable error response (401) immediately without retrying", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(401);
    expect(calls).toBe(1);
  });

  it("retries on 429 and succeeds on the second attempt", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) return new Response("rate limited", { status: 429 });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("retries on 429 and reads the Retry-After header", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "5" },
        });
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("retries on 503 and succeeds on the third attempt", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) return new Response("service unavailable", { status: 503 });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it("returns the last 429 response after maxRetries exhausted", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("still rate limited", { status: 429 });
    }) as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 2);
    expect(res.status).toBe(429);
    // 1 initial + 2 retries = 3 total calls
    expect(calls).toBe(3);
  });

  it("passes the request options to fetch", async () => {
    let capturedOptions: RequestInit | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, opts?: RequestInit) => {
      capturedOptions = opts;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await fetchWithRetry("https://example.com", {
      headers: { Authorization: "Bearer token" },
    });
    expect((capturedOptions?.headers as Record<string, string>)?.["Authorization"]).toBe(
      "Bearer token",
    );
  });
});

// ─── paginatedFetch ───────────────────────────────────────────────────────────

describe("paginatedFetch", () => {
  it("returns empty array when first page is empty", async () => {
    const result = await paginatedFetch(async () => []);
    expect(result).toEqual([]);
  });

  it("returns all items when they fit in a single page", async () => {
    const result = await paginatedFetch(async () => ["a", "b", "c"], 100);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("fetches multiple pages until the last page has fewer items than pageSize", async () => {
    const pages = [
      ["a", "b"], // full page (pageSize = 2)
      ["c", "d"], // full page
      ["e"], // last page (< 2 items)
    ];
    let callCount = 0;
    const result = await paginatedFetch(async (page) => pages[page - 1] ?? [], 2);
    void callCount;
    expect(result).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("passes the correct page number to fetchPage", async () => {
    const capturedPages: number[] = [];
    await paginatedFetch(async (page) => {
      capturedPages.push(page);
      if (page < 3) return Array(2).fill("x");
      return ["x"]; // last page
    }, 2);
    expect(capturedPages).toEqual([1, 2, 3]);
  });

  it("triggers a second fetch when the page is exactly full, stops when the next page is empty", async () => {
    const pages: string[][] = [["a", "b"], []]; // full then empty
    const capturedPages: number[] = [];
    const result = await paginatedFetch(async (page) => {
      capturedPages.push(page);
      return pages[page - 1] ?? [];
    }, 2);
    expect(result).toEqual(["a", "b"]);
    expect(capturedPages).toEqual([1, 2]);
  });

  it("propagates errors thrown by fetchPage", async () => {
    await expect(
      paginatedFetch(async () => {
        throw new Error("API error");
      }),
    ).rejects.toThrow("API error");
  });
});
