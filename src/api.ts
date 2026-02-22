import pc from "picocolors";
import type { CodeMatch } from "./types.ts";
import { fetchWithRetry, paginatedFetch } from "./api-utils.ts";

// ─── Raw GitHub API types (internal) ─────────────────────────────────────────

interface RawSearchSegment {
  text?: string;
  indices: [number, number];
}

interface RawTextMatch {
  fragment?: string;
  matches?: RawSearchSegment[];
}

interface RawCodeItem {
  path: string;
  html_url: string;
  repository: { full_name: string; archived?: boolean };
  text_matches?: RawTextMatch[];
}

interface SearchCodeResponse {
  items: RawCodeItem[];
  total_count: number;
}

interface RawTeam {
  slug: string;
  name: string;
}

interface RawRepo {
  full_name: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

/**
 * Build common GitHub API request headers.
 */
function githubHeaders(
  token: string,
  accept = "application/vnd.github.text-match+json",
): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Convert a GitHub blob URL to its raw.githubusercontent.com equivalent.
 * e.g. https://github.com/org/repo/blob/SHA/path → https://raw.githubusercontent.com/org/repo/SHA/path
 */
function toRawUrl(htmlUrl: string): string {
  return htmlUrl
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");
}

/**
 * Given the verbatim file content and a fragment returned by the GitHub Search
 * API, returns the 1-based absolute line number where the fragment starts.
 * Falls back to 1 when the fragment cannot be located in the content.
 */
function computeFragmentStartLine(fileContent: string, fragment: string): number {
  if (!fragment) return 1;
  const idx = fileContent.indexOf(fragment);
  if (idx === -1) return 1;
  return fileContent.slice(0, idx).split("\n").length;
}

/**
 * Compute the 1-based line and column of `offset` within `fragment`.
 * These are fragment-relative coordinates, used as a building block for
 * absolute line computation.
 */
export function segmentLineCol(fragment: string, offset: number): { line: number; col: number } {
  const before = fragment.slice(0, offset);
  const lines = before.split("\n");
  return {
    line: lines.length, // 1-based
    col: (lines[lines.length - 1]?.length ?? 0) + 1, // 1-based
  };
}

export async function searchCode(
  q: string,
  org: string,
  token: string,
  page = 1,
): Promise<{ items: RawCodeItem[]; total: number }> {
  const params = new URLSearchParams({
    // @see https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#constructing-a-search-query
    q: `${q} org:${org}`,
    per_page: "100",
    page: String(page),
  });
  // @see https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-code
  const res = await fetchWithRetry(`https://api.github.com/search/code?${params}`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as SearchCodeResponse;
  return { items: data.items ?? [], total: data.total_count ?? 0 };
}

export async function fetchAllResults(
  query: string,
  org: string,
  token: string,
): Promise<CodeMatch[]> {
  process.stderr.write(pc.dim("Fetching results from GitHub…\n"));
  const allItems: RawCodeItem[] = [];
  let page = 1;
  let total = Infinity;

  while (allItems.length < total) {
    const { items, total: t } = await searchCode(query, org, token, page);
    total = t;
    if (items.length === 0) break;
    allItems.push(...items);
    if (allItems.length >= total) break;
    page++;
    // GitHub caps code search at 1000 results
    if (allItems.length >= 1000) break;
    // Be kind to rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  // ─── Resolve absolute line numbers ──────────────────────────────────────
  // The GitHub Code Search API returns fragment-relative character indices
  // only; there are no absolute line numbers in the API response. Fetch each
  // unique file's raw content from raw.githubusercontent.com and use it to
  // find where the fragment starts so we can compute real line numbers.
  const urlsToFetch = [
    ...new Set(
      allItems
        .filter((item) => (item.text_matches ?? []).some((m) => m.fragment))
        .map((item) => item.html_url),
    ),
  ];
  const fileContentMap = new Map<string, string>();
  await Promise.all(
    urlsToFetch.map(async (htmlUrl) => {
      try {
        const res = await fetchWithRetry(toRawUrl(htmlUrl), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) fileContentMap.set(htmlUrl, await res.text());
      } catch {
        // Fall back to fragment-relative line numbers
      }
    }),
  );

  return allItems.map((item) => {
    const fileContent = fileContentMap.get(item.html_url);
    return {
      path: item.path,
      repoFullName: item.repository.full_name,
      htmlUrl: item.html_url,
      archived: item.repository.archived === true,
      textMatches: (item.text_matches ?? []).map((m) => {
        const fragment: string = m.fragment ?? "";
        const fragmentStartLine = fileContent ? computeFragmentStartLine(fileContent, fragment) : 1;
        return {
          fragment,
          matches: (m.matches ?? []).map((seg) => {
            const indices = seg.indices;
            const { line: fragLine, col } = segmentLineCol(fragment, indices[0]);
            const line = fragmentStartLine + fragLine - 1;
            return { text: seg.text ?? "", indices, line, col };
          }),
        };
      }),
    };
  });
}

// ─── Team → repo mapping ──────────────────────────────────────────────────────

/**
 * Fetches all org teams whose slug starts with at least one of `prefixes`,
 * then maps each matching team's repos back to a `Map<repoFullName, string[]>`
 * (the value is the list of matching team slugs for that repo).
 *
 * This requires the token to have `read:org` scope (or `admin:org`).
 */
export async function fetchRepoTeams(
  org: string,
  token: string,
  prefixes: string[],
): Promise<Map<string, string[]>> {
  const lowerPrefixes = prefixes.map((p) => p.toLowerCase());

  // ── 1. List all org teams (paginated) ──────────────────────────────────────
  // @see https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#list-teams
  const allTeams = await paginatedFetch<RawTeam>(async (page) => {
    const params = new URLSearchParams({ per_page: "100", page: String(page) });
    const res = await fetchWithRetry(`https://api.github.com/orgs/${org}/teams?${params}`, {
      headers: githubHeaders(token, "application/vnd.github+json"),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status} (list teams): ${body}`);
    }
    return (await res.json()) as RawTeam[];
  });

  const matchingTeamSlugs = allTeams
    .filter((t) => lowerPrefixes.some((p) => t.slug.toLowerCase().startsWith(p)))
    .map((t) => t.slug);

  process.stderr.write(
    pc.dim(
      `Fetching repos for ${matchingTeamSlugs.length} team${matchingTeamSlugs.length !== 1 ? "s" : ""} matching prefix${prefixes.length !== 1 ? "es" : ""} [${prefixes.join(", ")}]…\n`,
    ),
  );

  // ── 2. For each matching team fetch its repos (paginated) ──────────────────
  // @see https://docs.github.com/en/rest/teams/teams?apiVersion=2022-11-28#list-repos-in-a-team
  const repoTeams = new Map<string, string[]>();

  await Promise.all(
    matchingTeamSlugs.map(async (slug) => {
      const repos = await paginatedFetch<RawRepo>(async (p) => {
        const params = new URLSearchParams({ per_page: "100", page: String(p) });
        const res = await fetchWithRetry(
          `https://api.github.com/orgs/${org}/teams/${slug}/repos?${params}`,
          { headers: githubHeaders(token, "application/vnd.github+json") },
        );
        if (!res.ok) {
          // 404 is expected for nested/secret teams — skip silently.
          // Other errors are unexpected: log a warning and stop pagination.
          if (res.status !== 404) {
            process.stderr.write(
              pc.dim(`Warning: could not fetch repos for team "${slug}" (HTTP ${res.status})\n`),
            );
          }
          return [];
        }
        return (await res.json()) as RawRepo[];
      });
      for (const r of repos) {
        const list = repoTeams.get(r.full_name) ?? [];
        if (!list.includes(slug)) list.push(slug);
        repoTeams.set(r.full_name, list);
      }
    }),
  );

  return repoTeams;
}
