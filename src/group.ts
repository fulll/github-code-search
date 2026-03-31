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
 * Assigns all repos from the combined-label section (e.g. `"squad-frontend + squad-mobile"`)
 * to a single chosen team section.
 *
 * If the chosen team's section already exists, the repos are appended to it.
 * Otherwise a new single-team section is inserted at the position the combined
 * section occupied.
 *
 * If no section with `combinedLabel` exists, returns the original `sections`
 * array unchanged (no-op). Otherwise returns a new `TeamSection[]` without
 * mutating the input array or its elements.
 */
export function applyTeamPick(
  sections: TeamSection[],
  combinedLabel: string,
  chosenTeam: string,
): TeamSection[] {
  const combinedIdx = sections.findIndex((s) => s.label === combinedLabel);
  if (combinedIdx === -1) return sections;

  // Tag every moved repo so the TUI can mark them as "picked" and later offer a split
  const reposToMove = sections[combinedIdx].groups.map((g) => ({
    ...g,
    pickedFrom: combinedLabel,
  }));

  // Build array without the combined section
  const remaining = sections.filter((_, i) => i !== combinedIdx);

  // Find if the chosen team already has a section
  const targetIdx = remaining.findIndex((s) => s.label === chosenTeam);
  if (targetIdx !== -1) {
    // Append repos to the existing chosen-team section
    return remaining.map((s, i) =>
      i === targetIdx ? { ...s, groups: [...s.groups, ...reposToMove] } : s,
    );
  }

  // Insert a new single-team section where the combined section was
  const newSection: TeamSection = { label: chosenTeam, groups: reposToMove };
  const result = [...remaining];
  result.splice(combinedIdx, 0, newSection);
  return result;
}

/**
 * Reconstructs a `TeamSection[]` from a flat `RepoGroup[]` that was produced
 * by `flattenTeamSections`. Repos whose `sectionLabel` is set start a new
 * section; subsequent repos (no `sectionLabel`) belong to the current section.
 */
export function rebuildTeamSections(groups: RepoGroup[]): TeamSection[] {
  const sections: TeamSection[] = [];
  for (const g of groups) {
    if (g.sectionLabel !== undefined) {
      sections.push({ label: g.sectionLabel, groups: [g] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].groups.push(g);
    }
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

// ─── Undo pick helper ─────────────────────────────────────────────────────────

/**
 * Restores a previously picked repo back to its original combined section.
 *
 * The target repo is identified by `repoIndex` in the flat `groups` array.
 * It must have a `pickedFrom` field set (otherwise the array is returned as-is).
 * The repo is removed from its current section and placed in the `pickedFrom`
 * combined section (which is created if it no longer exists).
 * `pickedFrom` is stripped from the restored repo so it is treated as a plain
 * unassigned entry again.
 *
 * Pure function — no mutation.
 */
export function undoPickedRepo(groups: RepoGroup[], repoIndex: number): RepoGroup[] {
  const g = groups[repoIndex];
  if (!g?.pickedFrom) return groups;

  const combinedLabel = g.pickedFrom;
  // Strip pick metadata from the repo being restored
  const { pickedFrom: _p, ...restored } = g;
  void _p;
  const restoredRepo = restored as RepoGroup;

  let sections = rebuildTeamSections(groups);

  // Remove the repo from its current section (drop section if it becomes empty)
  const srcIdx = sections.findIndex((s) => s.groups.some((r) => r.repoFullName === g.repoFullName));
  if (srcIdx !== -1) {
    const newSrcGroups = sections[srcIdx].groups.filter((r) => r.repoFullName !== g.repoFullName);
    sections =
      newSrcGroups.length > 0
        ? sections.map((s, i) => (i === srcIdx ? { ...s, groups: newSrcGroups } : s))
        : sections.filter((_, i) => i !== srcIdx);
  }

  // Place the repo into the original combined section (create if absent)
  const dstIdx = sections.findIndex((s) => s.label === combinedLabel);
  if (dstIdx !== -1) {
    sections = sections.map((s, i) =>
      i === dstIdx ? { ...s, groups: [...s.groups, restoredRepo] } : s,
    );
  } else {
    // No existing section found — append a new combined section at the end.
    sections = [...sections, { label: combinedLabel, groups: [restoredRepo] }];
  }

  return flattenTeamSections(sections);
}

// ─── Re-pick move helper ──────────────────────────────────────────────────────

/**
 * Moves a single repo (identified by its full `org/repo` name) into the
 * target team's section. Used by the TUI re-pick confirmation handler.
 *
 * The repo's `pickedFrom` field is preserved so an undo can restore it later.
 *
 * Returns a new `RepoGroup[]` without mutating the input.
 */
export function moveRepoToSection(
  groups: RepoGroup[],
  repoFullName: string,
  targetTeam: string,
): RepoGroup[] {
  let sections = rebuildTeamSections(groups);

  const srcIdx = sections.findIndex((s) => s.groups.some((g) => g.repoFullName === repoFullName));
  if (srcIdx === -1) return groups;

  const groupToMove = sections[srcIdx].groups.find((g) => g.repoFullName === repoFullName)!;
  const newSrcGroups = sections[srcIdx].groups.filter((g) => g.repoFullName !== repoFullName);

  const intermediate =
    newSrcGroups.length > 0
      ? sections.map((s, i) => (i === srcIdx ? { ...s, groups: newSrcGroups } : s))
      : sections.filter((_, i) => i !== srcIdx);

  const dstIdx = intermediate.findIndex((s) => s.label === targetTeam);
  if (dstIdx !== -1) {
    sections = intermediate.map((s, i) =>
      i === dstIdx ? { ...s, groups: [...s.groups, groupToMove] } : s,
    );
  } else {
    sections = [...intermediate, { label: targetTeam, groups: [groupToMove] }];
  }

  return flattenTeamSections(sections);
}
