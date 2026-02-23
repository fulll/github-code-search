import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { fetchAllResults, fetchRepoTeams, searchCode, segmentLineCol } from "./api.ts";

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

// ─── searchCode ───────────────────────────────────────────────────────────────

describe("searchCode", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns items and total from GitHub API", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          items: [{ path: "src/foo.ts" }],
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    const result = await searchCode("myquery", "myorg", "mytoken", 1);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("passes page parameter in the request URL", async () => {
    let capturedUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ items: [], total_count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await searchCode("q", "org", "tok", 3);
    expect(capturedUrl).toContain("page=3");
  });

  it("throws on non-OK API response", async () => {
    globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch;

    await expect(searchCode("q", "org", "token")).rejects.toThrow("401");
  });

  it("returns empty items and zero total on empty results", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [], total_count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

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
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [], total_count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

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
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

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

  it("marks archived repos correctly", async () => {
    const fakeItem = {
      path: "lib/old.ts",
      html_url: "https://github.com/org/oldie/blob/main/lib/old.ts",
      repository: { full_name: "org/oldie", archived: true },
      text_matches: [],
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const results = await fetchAllResults("old", "org", "tok");
    expect(results[0].archived).toBe(true);
  });

  it("handles items without text_matches gracefully", async () => {
    const fakeItem = {
      path: "src/bar.ts",
      html_url: "https://github.com/org/repo/blob/main/src/bar.ts",
      repository: { full_name: "org/repo", archived: false },
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const results = await fetchAllResults("bar", "org", "tok");
    expect(results[0].textMatches).toHaveLength(0);
  });

  it("stops fetching once total is reached in first page", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
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
    }) as typeof fetch;

    await fetchAllResults("q", "org", "tok");
    expect(callCount).toBe(1);
  });

  it("fetches multiple pages until total is reached", async () => {
    // paginatedFetch stops when a page returns fewer than pageSize (100) items.
    // Page 1: exactly 100 items → full page → continue
    // Page 2: 3 items → partial page → stop
    let searchPage = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("raw.githubusercontent.com")) {
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
    }) as typeof fetch;

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
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("raw.githubusercontent.com")) {
        return new Response(fileContent, { status: 200 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

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
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("raw.githubusercontent.com")) {
        throw new Error("network error");
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const results = await fetchAllResults("hello", "org", "tok");
    // Fragment starts at line 1 (fallback); offset 0 → line 1
    expect(results[0].textMatches[0].matches[0].line).toBe(1);
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
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("raw.githubusercontent.com")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify({ items: [fakeItem], total_count: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const results = await fetchAllResults("hello", "org", "tok");
    expect(results[0].textMatches[0].matches[0].line).toBe(1);
  });
});

// ─── fetchRepoTeams ───────────────────────────────────────────────────────────

describe("fetchRepoTeams", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty map when no teams match the prefix", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ slug: "backend-core", name: "Backend" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"]);
    expect(result.size).toBe(0);
  });

  it("maps repos to matching team slugs", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
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
    }) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"]);
    expect(result.get("myorg/my-repo")).toEqual(["frontend-web"]);
  });

  it("assigns multiple team slugs to a repo that belongs to several matching teams", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
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
    }) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"]);
    const slugs = result.get("myorg/shared-ui") ?? [];
    expect(slugs).toContain("frontend-web");
    expect(slugs).toContain("frontend-mobile");
  });

  it("throws when the teams list request fails", async () => {
    globalThis.fetch = (async () => new Response("Forbidden", { status: 403 })) as typeof fetch;

    await expect(fetchRepoTeams("myorg", "tok", ["frontend"])).rejects.toThrow("403");
  });

  it("silently skips a team's repos when its repo list request fails", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/orgs/myorg/teams?")) {
        return new Response(JSON.stringify([{ slug: "frontend-web", name: "FE" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"]);
    expect(result.size).toBe(0);
  });

  it("paginates through teams when the first page returns 100 items", async () => {
    let teamPage = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
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
    }) as typeof fetch;

    await fetchRepoTeams("myorg", "tok", ["frontend"]);
    expect(teamPage).toBe(2);
  });

  it("paginates through repos when a team's first repo page returns 100 items", async () => {
    let repoPage = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
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
    }) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["frontend"]);
    expect(result.has("myorg/repo-extra")).toBe(true);
    expect(result.has("myorg/repo-0")).toBe(true);
  });

  it("prefix matching is case-insensitive", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
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
    }) as typeof fetch;

    const result = await fetchRepoTeams("myorg", "tok", ["FRONTEND"]);
    expect(result.has("myorg/repo-a")).toBe(true);
  });
});
