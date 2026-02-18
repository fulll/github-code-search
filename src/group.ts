import type { RepoGroup, TeamSection } from "./types.ts";

// ─── Team-prefix grouping ─────────────────────────────────────────────────────

/**
 * Groups `RepoGroup[]` by GitHub team prefix(es).
 *
 * Algorithm (per prefix, in order):
 *   1. Collect remaining repos that have at least one team matching this prefix.
 *   2. Within that set, sub-group by the *number* of matching teams (1, then 2,
 *      then 3 …), so repos that belong to exactly one matching team come first.
 *   3. Within each count bucket, further sub-group by the sorted combination of
 *      matching team names → one `TeamSection` per unique combination.
 *   4. Move those repos out of the "remaining" pool and continue with the next
 *      prefix.
 *   5. Any repos that matched no prefix are collected into a final `"other"`
 *      section.
 *
 * Example with prefixes `["squad-", "chapter-"]` and a repo that belongs to
 * both `squad-frontend` and `squad-mobile`:
 *   - It falls under **2 matching** squad- teams → section label
 *     `"squad-frontend + squad-mobile"`, after all single-squad repos.
 */
export function groupByTeamPrefix(groups: RepoGroup[], prefixes: string[]): TeamSection[] {
  const sections: TeamSection[] = [];
  const remaining = new Set(groups);

  for (const prefix of prefixes) {
    // Repos that have at least one team starting with this prefix
    const matchingGroups = [...remaining].filter((g) =>
      (g.teams ?? []).some((t) => t.startsWith(prefix)),
    );
    if (matchingGroups.length === 0) continue;

    // Bucket by number of teams matching this prefix
    const byCount = new Map<number, RepoGroup[]>();
    for (const g of matchingGroups) {
      const matchingTeams = (g.teams ?? []).filter((t) => t.startsWith(prefix));
      const count = matchingTeams.length;
      if (!byCount.has(count)) byCount.set(count, []);
      byCount.get(count)!.push(g);
      remaining.delete(g);
    }

    // Process buckets in ascending count order (1 team, then 2, then 3 …)
    for (const count of [...byCount.keys()].toSorted((a, b) => a - b)) {
      const groupsInBucket = byCount.get(count)!;

      // Within each count-bucket, group by the sorted team combination
      const byCombo = new Map<string, RepoGroup[]>();
      for (const g of groupsInBucket) {
        const matchingTeams = (g.teams ?? [])
          .filter((t) => t.startsWith(prefix))
          .toSorted()
          .join(" + ");
        if (!byCombo.has(matchingTeams)) byCombo.set(matchingTeams, []);
        byCombo.get(matchingTeams)!.push(g);
      }

      // Stable ordering: emit combo sections in alphabetical order of the label
      for (const label of [...byCombo.keys()].toSorted()) {
        sections.push({ label, groups: byCombo.get(label)! });
      }
    }
  }

  // Repos not matched by any prefix
  if (remaining.size > 0) {
    sections.push({ label: "other", groups: [...remaining] });
  }

  return sections;
}

/**
 * Flattens `TeamSection[]` back into a plain `RepoGroup[]`, marking the first
 * repo of each section with `sectionLabel`. This is the format consumed by the
 * TUI renderer and output builders.
 *
 * Note: the original `RepoGroup` objects are not mutated; new objects with the
 * `sectionLabel` field added are returned.
 */
export function flattenTeamSections(sections: TeamSection[]): RepoGroup[] {
  const result: RepoGroup[] = [];
  for (const section of sections) {
    for (let i = 0; i < section.groups.length; i++) {
      const g = section.groups[i];
      if (i === 0) {
        // Spread to avoid mutating the original
        result.push({ ...g, sectionLabel: section.label });
      } else {
        // Remove any pre-existing sectionLabel from non-first entries
        const { sectionLabel: _removed, ...rest } = g;
        void _removed;
        result.push(rest as RepoGroup);
      }
    }
  }
  return result;
}
