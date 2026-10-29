import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mockFetch } from "./test-setup.ts";
import { visibleWidth } from "./render.ts";
import {
  buildFetchProgress,
  buildLineResolutionProgress,
  deriveSegmentText,
  fetchAllResults,
  fetchRepoTeams,
  searchCode,
  segmentLineCol,
} from "./api.ts";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;

// ─── segmentLineCol ───────────────────────────────────────────────────────────

describe("segmentLineCol (api)", () => {
  it("returns line 1 col 1 for offset 0", () => {
    expect(segmentLineCol("hello", 0)).toEqual({ line: 1, col: 1 });
  });

  it("handles multi-line fragments", () => {
    const fragment = "line1\nline2\nline3";
    expect(segmentLineCol(fragment, 6)).toEqual({ line: 2, col: 1 });
  });

  it("handles column within a line", () => {
    expect(segmentLineCol("abcdef", 3)).toEqual({ line: 1, col: 4 });
  });
});

// ─── deriveSegmentText (issue #151, restores PR #133) ─────────────────────────────────────

describe("deriveSegmentText", () => {
  it("returns seg.text unchanged when GitHub provides it", () => {
    expect(deriveSegmentText("hello world", { text: "hello", indices: [0, 5] })).toBe("hello");
  });

  it("derives the text from fragment + indices when seg.text is omitted", () => {
    expect(deriveSegmentText("hello world", { indices: [6, 11] })).toBe("world");
  });

  it("returns an empty string for out-of-range indices", () => {
    expect(deriveSegmentText("hello", { indices: [10, 20] })).toBe("");
  });

  it("returns an empty string when end is before start", () => {
    expect(deriveSegmentText("hello", { indices: [4, 1] })).toBe("");
  });
});

// ─── searchCode ───────────────────────────────────────────────────────────────

describe("searchCode", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns items and total from GitHub API", async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            items: [{ path: "src/foo.ts" }],
            total_count: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const result = await searchCode("myquery", "myorg", "mytoken", 1);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("passes page parameter in the request URL", async () => {
    let capturedUrl = "";
    mockFetch(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ items: [], total_count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await searchCode("q", "org", "tok", 3);
    expect(capturedUrl).toContain("page=3");
  });

  it("throws on non-OK API response", async () => {
    mockFetch(async () => new Response("Unauthorized", { status: 401 }));

    await expect(searchCode("q", "org", "token")).rejects.toThrow("401");
  });

  it("returns empty items and zero total on empty results", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [], total_count: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await searchCode("q", "org", "tok");
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── fetchAllResults ──────────────────────────────────────────────────────────

const makeFetchItem = (i: number) => ({
  path: `src/file${i}.ts`,
  html_url: `https://github.com/org/repo/blob/main/src/file${i}.ts`,
  repository: { full_name: "org/repo", archived: false },
  text_matches: [],
});

describe("fetch progress lifecycle (issues #247 and #248)", () => {
  let writes: string[];
  let stderr: ReturnType<typeof spyOn<typeof process.stderr, "write">>;
  const columnsDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "columns");

  beforeEach(() => {
    writes = [];
    Object.defineProperty(process.stderr, "columns", {
      configurable: true,
      value: 200,
      writable: true,
    });
    stderr = spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    stderr.mockRestore();
    globalThis.fetch = originalFetch;
    if (columnsDescriptor) Object.defineProperty(process.stderr, "columns", columnsDescriptor);
    else Reflect.deleteProperty(process.stderr, "columns");
  });

  it.each([0, 1])("clears the results progress line after fetching %i results", async (count) => {
    mockFetch(async () =>
      Response.json({
        items: Array.from({ length: count }, (_, i) => makeFetchItem(i)),
        total_count: count,
      }),
    );

    await fetchAllResults("q", "org", "tok");

    expect(writes.at(-1)).toBe("\x1b[2K\r");
    expect(writes).not.toContain("\n");
  });

  it("clears the results progress line before propagating an API error", async () => {
    mockFetch(async () => Response.json({ message: "Unauthorized" }, { status: 401 }));

    await expect(fetchAllResults("q", "org", "tok")).rejects.toThrow("401");

    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it("clears results before line resolution and clears resolution when finished", async () => {
    mockFetch(async (url) =>
      new URL(String(url)).hostname === "raw.githubusercontent.com"
        ? new Response("hello")
        : Response.json({
            items: [{ ...makeFetchItem(0), text_matches: [{ fragment: "hello" }] }],
            total_count: 1,
          }),
    );

    await fetchAllResults("hello", "org", "tok");

    const resolutionStart = writes.findIndex((line) => line.includes("Resolving line numbers"));
    expect(writes[resolutionStart - 1]).toBe("\x1b[2K\r");
    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it.each([0, 1, 2])("shows matching progress style for %i teams and clears it", async (count) => {
    mockFetch(async (url) =>
      String(url).includes("/teams?")
        ? Response.json(
            Array.from({ length: count }, (_, i) => ({ slug: `squad-${i}`, name: `Team ${i}` })),
          )
        : new Response(null, { status: 404 }),
    );

    await fetchRepoTeams("org", "tok", ["squad-", "chapter-"], false);

    const label = `Fetching repos for ${count} team${count !== 1 ? "s" : ""} matching prefixes [squad-, chapter-]…`;
    const expected = (done: number) =>
      buildLineResolutionProgress(done, count).replace("Resolving line numbers…", label);
    expect(writes).toEqual([
      expected(0),
      ...Array.from({ length: count }, (_, i) => expected(i + 1)),
      "\x1b[2K\r",
    ]);
  });

  it("counts a team only after all of its repository pages finish", async () => {
    mockFetch(async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith("/teams")) {
        return Response.json([{ slug: "squad-web", name: "Web" }]);
      }
      expect(writes.at(-1)).toContain("0/1");
      return Response.json(
        parsed.searchParams.get("page") === "1"
          ? Array.from({ length: 100 }, (_, i) => ({ full_name: `org/repo-${i}` }))
          : [],
      );
    });

    const teams = await fetchRepoTeams("org", "tok", ["squad-"], false);

    expect(teams.size).toBe(100);
    expect(writes.at(-2)).toContain("1/1");
    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it("clears team progress before propagating a repository fetch error", async () => {
    mockFetch(async (url) =>
      String(url).includes("/teams?")
        ? Response.json([{ slug: "squad-web", name: "Web" }])
        : Response.json({ message: "Unauthorized" }, { status: 401 }),
    );

    await expect(fetchRepoTeams("org", "tok", ["squad-"], false)).rejects.toThrow("401");

    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it.each(["results", "teams"])(
    "clears %s progress before a countdown writes a newline",
    async (phase) => {
      let limited = false;
      mockFetch(async (url) => {
        if (phase === "teams" && new URL(String(url)).pathname.endsWith("/teams")) {
          return Response.json([{ slug: "squad-web", name: "Web" }]);
        }
        if (!limited) {
          limited = true;
          return new Response(null, { status: 429, headers: { "Retry-After": "11" } });
        }
        return phase === "results"
          ? Response.json({ items: [], total_count: 0 })
          : Response.json([]);
      });
      const countdown = async () => {
        expect(writes.at(-1)).toBe("\x1b[2K\r");
        process.stderr.write("\n");
      };

      if (phase === "results") await fetchAllResults("q", "org", "tok", countdown);
      else await fetchRepoTeams("org", "tok", ["squad-"], false, countdown);

      expect(writes.at(-1)).toBe("\x1b[2K\r");
    },
  );

  it.each(["results", "teams"])("clears %s progress when a countdown rejects", async (phase) => {
    mockFetch(async (url) => {
      if (phase === "teams" && new URL(String(url)).pathname.endsWith("/teams")) {
        return Response.json([{ slug: "squad-web", name: "Web" }]);
      }
      return new Response(null, { status: 429, headers: { "Retry-After": "11" } });
    });
    const countdown = async () => {
      expect(writes.at(-1)).toBe("\x1b[2K\r");
      process.stderr.write("\n");
      throw new Error("Countdown cancelled");
    };

    await expect(
      phase === "results"
        ? fetchAllResults("q", "org", "tok", countdown)
        : fetchRepoTeams("org", "tok", ["squad-"], false, countdown),
    ).rejects.toThrow("Countdown cancelled");
    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it("keeps all 93-team progress updates on one row at 80 columns", async () => {
    process.stderr.columns = 80;
    mockFetch(async (url) =>
      new URL(String(url)).pathname.endsWith("/teams")
        ? Response.json(
            Array.from({ length: 93 }, (_, i) => ({ slug: `squad-${i}`, name: `Team ${i}` })),
          )
        : Response.json([]),
    );

    await fetchRepoTeams("org", "tok", ["squad-", "chapter-"], false);

    for (const line of writes.slice(0, -1)) {
      expect(visibleWidth(line)).toBeLessThan(80);
      expect(line).toContain("\x1b[38;5;129m");
      expect(line).toMatch(/\d+\/93$/);
    }
    expect(writes.at(-2)).toContain("93/93");
    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });

  it("does not redraw team progress while another team is showing a countdown", async () => {
    let releaseCountdown!: () => void;
    let signalCountdown!: () => void;
    const countdownStarted = new Promise<void>((resolve) => {
      signalCountdown = resolve;
    });
    const countdownFinished = new Promise<void>((resolve) => {
      releaseCountdown = resolve;
    });
    let limited = false;
    mockFetch(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/teams")) {
        return Response.json([
          { slug: "squad-limited", name: "Limited" },
          { slug: "squad-fast", name: "Fast" },
        ]);
      }
      if (path.endsWith("/squad-limited/repos") && !limited) {
        limited = true;
        return new Response(null, { status: 429, headers: { "Retry-After": "11" } });
      }
      if (path.endsWith("/squad-fast/repos")) await countdownStarted;
      return Response.json([]);
    });
    const fetch = fetchRepoTeams("org", "tok", ["squad-"], false, async () => {
      process.stderr.write("\nCOUNTDOWN");
      signalCountdown();
      await countdownFinished;
    });
    await countdownStarted;
    // Let the other worker finish while the countdown still owns stderr.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const lastDuringCountdown = writes.at(-1);
    releaseCountdown();
    await fetch;

    expect(lastDuringCountdown).toBe("\nCOUNTDOWN");
    expect(writes.at(-2)).toContain("2/2");
    expect(writes.at(-1)).toBe("\x1b[2K\r");
  });
});

describe("fetchAllResults", () => {
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

  it("returns empty array when API returns no items", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [], total_count: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await fetchAllResults("q", "org", "tok");
    expect(results).toHaveLength(0);
  });

  it("maps API response to CodeMatch objects with correct fields", async () => {
    const fakeItem = {
      path: "src/foo.ts",
      html_url: "https://github.com/org/repo/blob/main/src/foo.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [
        {
          fragment: "hello world",
          matches: [{ text: "hello", indices: [0, 5] }],
        },
      ],
    };
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await fetchAllResults("hello", "org", "tok");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("src/foo.ts");
    expect(results[0].repoFullName).toBe("org/repo");
    expect(results[0].htmlUrl).toContain("src/foo.ts");
    expect(results[0].archived).toBe(false);
    expect(results[0].textMatches[0].fragment).toBe("hello world");
    expect(results[0].textMatches[0].matches[0].line).toBe(1);
    expect(results[0].textMatches[0].matches[0].col).toBe(1);
  });

  it("derives matchedText from fragment + indices when GitHub omits the segment's text field (issue #151)", async () => {
    const fakeItem = {
      path: "src/foo.ts",
      html_url: "https://github.com/org/repo/blob/main/src/foo.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [
        {
          fragment: "hello world",
          matches: [{ indices: [6, 11] }],
        },
      ],
    };
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await fetchAllResults("world", "org", "tok");
    expect(results[0].textMatches[0].matches[0].text).toBe("world");
  });

  it("marks archived repos correctly", async () => {
    const fakeItem = {
      path: "lib/old.ts",
      html_url: "https://github.com/org/oldie/blob/main/lib/old.ts",
      repository: { full_name: "org/oldie", archived: true },
      text_matches: [],
    };
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await fetchAllResults("old", "org", "tok");
    expect(results[0].archived).toBe(true);
  });

  it("handles items without text_matches gracefully", async () => {
    const fakeItem = {
      path: "src/bar.ts",
      html_url: "https://github.com/org/repo/blob/main/src/bar.ts",
      repository: { full_name: "org/repo", archived: false },
    };
    mockFetch(
      async () =>
        new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const results = await fetchAllResults("bar", "org", "tok");
    expect(results[0].textMatches).toHaveLength(0);
  });

  it("stops fetching once total is reached in first page", async () => {
    let callCount = 0;
    mockFetch(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          items: [
            {
              path: "a.ts",
              html_url: "https://github.com/org/repo/blob/main/a.ts",
              repository: { full_name: "org/repo", archived: false },
              text_matches: [],
            },
          ],
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await fetchAllResults("q", "org", "tok");
    expect(callCount).toBe(1);
  });

  it("fetches multiple pages until total is reached", async () => {
    // paginatedFetch stops when a page returns fewer than pageSize (100) items.
    // Page 1: exactly 100 items → full page → continue
    // Page 2: 3 items → partial page → stop
    let searchPage = 0;
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response("", { status: 404 });
      }
      searchPage++;
      const items =
        searchPage === 1
          ? Array.from({ length: 100 }, (_, i) => makeFetchItem(i))
          : Array.from({ length: 3 }, (_, i) => makeFetchItem(100 + i));
      return new Response(JSON.stringify({ items, total_count: 103 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("q", "org", "tok");
    expect(results).toHaveLength(103);
    expect(searchPage).toBe(2);
  });

  it("uses raw content to compute accurate absolute line numbers", async () => {
    const fileContent = "line one\nline two\nconst x = doSomething()\n";
    const fragment = "const x = doSomething()";
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [
        {
          fragment,
          matches: [{ text: "doSomething", indices: [10, 21] }],
        },
      ],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response(fileContent, { status: 200 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("doSomething", "org", "tok");
    // "const x = doSomething()" starts on line 3; match offset 10 is within that line
    expect(results[0].textMatches[0].matches[0].line).toBe(3);
  });

  it("falls back to fragment-relative lines when raw content fetch throws", async () => {
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [
        {
          fragment: "hello world",
          matches: [{ text: "hello", indices: [0, 5] }],
        },
      ],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        throw new Error("network error");
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("hello", "org", "tok");
    // Fragment starts at line 1 (fallback); offset 0 → line 1
    expect(results[0].textMatches[0].matches[0].line).toBe(1);
  });

  it("does not request page 11 when total_count is exactly 1000 (10 full pages)", async () => {
    // Regression guard for the 422 "Cannot access beyond the first 1000 results"
    // error that occurred when total_count was an exact multiple of 100.
    let searchCallCount = 0;
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response("", { status: 404 });
      }
      searchCallCount++;
      return new Response(
        JSON.stringify({
          items: Array.from({ length: 100 }, (_, i) => makeFetchItem(i)),
          total_count: 1000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const results = await fetchAllResults("q", "org", "tok");
    expect(results).toHaveLength(1000);
    // Exactly 10 pages fetched — page 11 must never be requested
    expect(searchCallCount).toBe(10);
  });

  it("falls back when raw content fetch returns non-ok status", async () => {
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [
        {
          fragment: "hello",
          matches: [{ text: "hello", indices: [0, 5] }],
        },
      ],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("hello", "org", "tok");
    expect(results[0].textMatches[0].matches[0].line).toBe(1);
  });

  it("propagates the downloaded raw content into fileContent when keepFileContent is true", async () => {
    const fileContent = "line one\nline two\nconst x = doSomething()\n";
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [{ fragment: "const x = doSomething()", matches: [] }],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response(fileContent, { status: 200 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("doSomething", "org", "tok", undefined, true);
    expect(results[0].fileContent).toBe(fileContent);
  });

  it("leaves fileContent absent when the raw content fetch fails, even with keepFileContent true", async () => {
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [{ fragment: "hello world", matches: [] }],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const results = await fetchAllResults("hello", "org", "tok", undefined, true);
    expect(results[0].fileContent).toBeUndefined();
  });

  it("does not retain fileContent when keepFileContent is false (default — non-regex queries)", async () => {
    const fileContent = "line one\nline two\nconst x = doSomething()\n";
    const fakeItem = {
      path: "src/mod.ts",
      html_url: "https://github.com/org/repo/blob/main/src/mod.ts",
      repository: { full_name: "org/repo", archived: false },
      text_matches: [{ fragment: "const x = doSomething()", matches: [] }],
    };
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (new URL(urlStr).hostname === "raw.githubusercontent.com") {
        return new Response(fileContent, { status: 200 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    // No keepFileContent argument — defaults to false.
    const results = await fetchAllResults("doSomething", "org", "tok");
    expect(results[0].fileContent).toBeUndefined();
  });
});

// ─── fetchRepoTeams ──────────────────────────────────────────────────────────

describe("fetchRepoTeams", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty map when no teams match the prefix", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify([{ slug: "backend-core", name: "Backend" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    expect(result.size).toBe(0);
  });

  it("maps repos to matching team slugs", async () => {
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/orgs/myorg/teams?")) {
        return new Response(JSON.stringify([{ slug: "frontend-web", name: "Frontend Web" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // team repos request
      return new Response(JSON.stringify([{ full_name: "myorg/my-repo" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    expect(result.get("myorg/my-repo")).toEqual(["frontend-web"]);
  });

  it("assigns multiple team slugs to a repo that belongs to several matching teams", async () => {
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/orgs/myorg/teams?")) {
        return new Response(
          JSON.stringify([
            { slug: "frontend-web", name: "FE Web" },
            { slug: "frontend-mobile", name: "FE Mobile" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // Both teams own the same repo
      return new Response(JSON.stringify([{ full_name: "myorg/shared-ui" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    const slugs = result.get("myorg/shared-ui") ?? [];
    expect(slugs).toContain("frontend-web");
    expect(slugs).toContain("frontend-mobile");
  });

  it("throws when the teams list request fails", async () => {
    mockFetch(async () => new Response("Forbidden", { status: 403 }));

    await expect(fetchRepoTeams("myorg", "tok", ["frontend"], false)).rejects.toThrow("403");
  });

  it("silently skips a team's repos when its repo list request fails", async () => {
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/orgs/myorg/teams?")) {
        return new Response(JSON.stringify([{ slug: "frontend-web", name: "FE" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    expect(result.size).toBe(0);
  });

  it("paginates through teams when the first page returns 100 items", async () => {
    let teamPage = 0;
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/teams?")) {
        teamPage++;
        if (teamPage === 1) {
          const teams = Array.from({ length: 100 }, (_, i) => ({
            slug: `frontend-${i}`,
            name: `Team ${i}`,
          }));
          return new Response(JSON.stringify(teams), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        // Page 2: fewer than 100 → stop pagination
        return new Response(JSON.stringify([{ slug: "frontend-extra", name: "Extra" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Repo lists: empty
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    expect(teamPage).toBe(2);
  });

  it("paginates through repos when a team's first repo page returns 100 items", async () => {
    let repoPage = 0;
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/teams?")) {
        return new Response(JSON.stringify([{ slug: "frontend-web", name: "FE" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Team repos endpoint
      repoPage++;
      if (repoPage === 1) {
        const repos = Array.from({ length: 100 }, (_, i) => ({
          full_name: `myorg/repo-${i}`,
        }));
        return new Response(JSON.stringify(repos), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify([{ full_name: "myorg/repo-extra" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"], false);
    expect(result.has("myorg/repo-extra")).toBe(true);
    expect(result.has("myorg/repo-0")).toBe(true);
  });

  it("throws a clean rate-limit error when the team repo list returns 403 rate-limit", async () => {
    const resetTimestamp = Math.ceil((Date.now() + 300_000) / 1_000); // 5 minutes from now
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/teams?")) {
        return new Response(JSON.stringify([{ slug: "frontend-web", name: "FE" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Team repos endpoint → rate-limited
      return new Response(
        JSON.stringify({ message: "API rate limit exceeded for user ID 1234.", status: "403" }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetTimestamp),
          },
        },
      );
    });

    await expect(fetchRepoTeams("myorg", "tok", ["frontend"], false)).rejects.toThrow(
      /GitHub API rate limit exceeded\. Please retry in \d+ minute/,
    );
  });

  it("prefix matching is case-insensitive", async () => {
    mockFetch(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/teams?")) {
        return new Response(JSON.stringify([{ slug: "Frontend-Web", name: "FE" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify([{ full_name: "myorg/repo-a" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await fetchRepoTeams("myorg", "tok", ["FRONTEND"], false);
    expect(result.has("myorg/repo-a")).toBe(true);
  });
});

// ─── buildFetchProgress ───────────────────────────────────────────────────────

describe("buildFetchProgress", () => {
  it("starts with \\r to overwrite the current line", () => {
    const s = buildFetchProgress(1, 10);
    expect(s.startsWith("\r")).toBe(true);
  });

  it("contains bright purple ANSI escape 38;5;129m", () => {
    const s = buildFetchProgress(1, 10);
    expect(s).toContain("\x1b[38;5;129m");
  });

  it("contains page counter text", () => {
    const s = buildFetchProgress(3, 10);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("3/10");
  });

  it("full bar when currentPage equals totalPages — no empty block character", () => {
    const s = buildFetchProgress(10, 10);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("░");
  });

  it("empty bar at page 0 — no filled block character", () => {
    const s = buildFetchProgress(0, 10);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("▓");
  });

  it("does not throw when currentPage exceeds totalPages (out-of-range guard)", () => {
    // paginatedFetch may request one extra empty page after the 1 000-result cap
    expect(() => buildFetchProgress(11, 10)).not.toThrow();
  });
});

// ─── buildLineResolutionProgress ─────────────────────────────────────────────────

describe("buildLineResolutionProgress", () => {
  it("starts with \\r to overwrite the current line", () => {
    const s = buildLineResolutionProgress(5, 20);
    expect(s.startsWith("\r")).toBe(true);
  });

  it("contains bright purple ANSI escape 38;5;129m", () => {
    const s = buildLineResolutionProgress(5, 20);
    expect(s).toContain("\x1b[38;5;129m");
  });

  it("contains done/total counter text", () => {
    const s = buildLineResolutionProgress(12, 47);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("12/47");
  });

  it("full bar when done equals total — no empty block character", () => {
    const s = buildLineResolutionProgress(20, 20);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("░");
  });

  it("empty bar at done=0 — no filled block character", () => {
    const s = buildLineResolutionProgress(0, 20);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).not.toContain("▓");
  });

  it("contains 'Resolving line numbers' label", () => {
    const s = buildLineResolutionProgress(3, 10);
    const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Resolving line numbers");
  });

  it("does not throw when done exceeds total (out-of-range guard)", () => {
    expect(() => buildLineResolutionProgress(21, 20)).not.toThrow();
  });
});
