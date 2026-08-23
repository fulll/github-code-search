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
    sections.push(...bucketSingleLevel(remaining, prefix));
  }

  // Repos not matched by any prefix
  if (remaining.size > 0) {
    sections.push({ label: "other", groups: [...remaining] });
  }

  return sections;
}

/**
 * Buckets the repos in `remaining` that have at least one team starting with
 * `prefix` into one `TeamSection` per matching-team combination, removing
 * matched repos from `remaining` (mutated in place). Repos are first bucketed
 * by the *number* of matching teams (1, then 2, then 3 …), then within each
 * count-bucket by the sorted combination of matching team names.
 *
 * Shared by `groupByTeamPrefix` (flat, single level) and
 * `groupByTeamHierarchy` (tree, applied at every depth of a prefix chain).
 * Returns an empty array when nothing in `remaining` matches `prefix`.
 */
function bucketSingleLevel(remaining: Set<RepoGroup>, prefix: string): TeamSection[] {
  const sections: TeamSection[] = [];
  const matchingGroups = [...remaining].filter((g) =>
    (g.teams ?? []).some((t) => t.startsWith(prefix)),
  );
  if (matchingGroups.length === 0) return sections;

  const byCount = new Map<number, RepoGroup[]>();
  for (const g of matchingGroups) {
    const matchingTeams = (g.teams ?? []).filter((t) => t.startsWith(prefix));
    const count = matchingTeams.length;
    if (!byCount.has(count)) byCount.set(count, []);
    byCount.get(count)!.push(g);
    remaining.delete(g);
  }

  for (const count of [...byCount.keys()].toSorted((a, b) => a - b)) {
    const groupsInBucket = byCount.get(count)!;

    const byCombo = new Map<string, RepoGroup[]>();
    for (const g of groupsInBucket) {
      const matchingTeams = (g.teams ?? [])
        .filter((t) => t.startsWith(prefix))
        .toSorted()
        .join(" + ");
      if (!byCombo.has(matchingTeams)) byCombo.set(matchingTeams, []);
      byCombo.get(matchingTeams)!.push(g);
    }

    for (const label of [...byCombo.keys()].toSorted()) {
      sections.push({ label, groups: byCombo.get(label)! });
    }
  }

  return sections;
}

// ─── Hierarchical (nested) team-prefix grouping ───────────────────────────────

/**
 * Groups `RepoGroup[]` into a *tree* of `TeamSection`s from one or more
 * independent prefix chains. Each chain is an ordered list of prefixes, one
 * per nesting depth: `["gamme-", "squad-"]` groups repos by teams matching
 * `gamme-` first, then sub-groups each resulting section by teams matching
 * `squad-`. Multiple chains are processed independently and sequentially
 * (like `groupByTeamPrefix`'s multi-prefix list), each drawing from the pool
 * of repos not yet claimed by an earlier chain.
 *
 * On top of the explicit chain depth, this also auto-nests sections whose
 * single-team label is a prefix of another single-team label at the same
 * depth (e.g. `gamme-lead-client` becomes the parent of
 * `gamme-lead-client-p1`) instead of listing them as unrelated siblings.
 * Combined-label sections (`"a + b"`) and `"other"` sections are never
 * auto-nested.
 *
 * Repos matching no prefix at a given depth are collected into an `"other"`
 * child at that depth; repos matching no chain at all are collected into a
 * single top-level `"other"` section, mirroring `groupByTeamPrefix`.
 *
 * Pure function — no mutation of `groups` or its elements.
 */
export function groupByTeamHierarchy(groups: RepoGroup[], chains: string[][]): TeamSection[] {
  const sections: TeamSection[] = [];
  const remaining = new Set(groups);

  for (const chain of chains) {
    if (chain.length === 0) continue;

    const siblings = bucketSingleLevel(remaining, chain[0]).map((s) => ({ ...s, level: 0 }));
    if (siblings.length === 0) continue;

    const nested = nestOverlappingLabels(siblings, 0);
    sections.push(...nested.map((s) => applyChainDepth(s, chain, 1)));
  }

  if (remaining.size > 0) {
    sections.push({ label: "other", groups: [...remaining], level: 0 });
  }

  return sections.map(pruneEmptyChildren);
}

/**
 * Recursively subdivides `node` by the next prefix in `chain` (at `depth`).
 * Any pre-existing overlap-nested `children` haven't consumed `chain[depth]`
 * yet either, so they're recursed into first (at the same `depth`); `node`'s
 * own `groups` (repos owned directly by this section, which can coexist with
 * overlap children — see `TeamSection`) are then split into *additional*
 * children. No-op once `depth` exceeds the chain or there is nothing left to
 * split at this node.
 */
function applyChainDepth(node: TeamSection, chain: string[], depth: number): TeamSection {
  const recursedChildren = (node.children ?? []).map((c) => applyChainDepth(c, chain, depth));

  if (depth >= chain.length || node.groups.length === 0) {
    return recursedChildren.length > 0 ? { ...node, children: recursedChildren } : node;
  }

  const level = (node.level ?? 0) + 1;
  const localRemaining = new Set(node.groups);
  const siblings = bucketSingleLevel(localRemaining, chain[depth]).map((s) => ({ ...s, level }));
  if (localRemaining.size > 0) {
    siblings.push({ label: "other", groups: [...localRemaining], level });
  }

  const splitChildren = nestOverlappingLabels(siblings, level).map((c) =>
    applyChainDepth(c, chain, depth + 1),
  );

  return { ...node, groups: [], children: [...recursedChildren, ...splitChildren] };
}

/**
 * Nests sections whose single-team `label` is a proper prefix of another
 * single-team label at the same `level` (e.g. `gamme-lead-client` becomes the
 * parent of `gamme-lead-client-p1`), instead of leaving them as siblings.
 * Combined-label (`"a + b"`) and `"other"` sections are left untouched at
 * `level` and passed through unnested. When a chain of overlaps exists
 * (A prefix of B prefix of C), nesting cascades and `level` is incremented
 * once per hop from the shallowest ancestor.
 */
function nestOverlappingLabels(sections: TeamSection[], level: number): TeamSection[] {
  const nestable = sections.filter((s) => s.label !== "other" && !s.label.includes(" + "));
  const rest = sections
    .filter((s) => s.label === "other" || s.label.includes(" + "))
    .map((s) => ({ ...s, level }));

  const nodeByLabel = new Map<string, TeamSection & { children: TeamSection[] }>(
    nestable.map((s) => [s.label, { ...s, level, children: [] }]),
  );

  const parentOf = new Map<string, string>();
  for (const s of nestable) {
    let bestParent: string | undefined;
    for (const other of nestable) {
      if (other.label === s.label) continue;
      if (
        s.label.startsWith(other.label) &&
        (bestParent === undefined || other.label.length > bestParent.length)
      ) {
        bestParent = other.label;
      }
    }
    if (bestParent !== undefined) parentOf.set(s.label, bestParent);
  }

  for (const [child, parent] of parentOf) {
    nodeByLabel.get(parent)!.children.push(nodeByLabel.get(child)!);
  }

  const roots = nestable
    .filter((s) => !parentOf.has(s.label))
    .map((s) => assignLevels(nodeByLabel.get(s.label)!, level));

  return [...roots, ...rest];
}

/** Sets `level` on `node` (and cascades +1 per depth into its children), mutating in place. */
function assignLevels(node: TeamSection, lvl: number): TeamSection {
  node.level = lvl;
  if (node.children && node.children.length > 0) {
    node.children = node.children.map((c) => assignLevels(c, lvl + 1));
  }
  return node;
}

// ─── Advanced consolidated rendering ──────────────────────────────────────────

/**
 * Collapses chains of single-child nesting in a `groupByTeamHierarchy` tree
 * into one node, so a run of unambiguous nesting (a parent with exactly one
 * child, that child with exactly one child, …) renders as a single heading
 * with an "(including …)" suffix listing the collapsed labels, instead of
 * one heading per level. A node whose next level has 0 or 2+ children is
 * left as-is at that point (only unambiguous single-branch chains collapse).
 *
 * The `"other"` label reads as `"unset"` inside the suffix (e.g. `"gamme-
 * lead-client (including p1, unset)"`), matching how an unassigned bucket
 * reads in prose, without changing the underlying section's `label`.
 *
 * Pure function — no mutation of the input tree; `level` is recomputed on
 * the resulting (shallower) tree.
 */
export function consolidateTeamHierarchy(sections: TeamSection[]): TeamSection[] {
  return sections.map((s) => assignLevels(consolidateNode(s), s.level ?? 0));
}

function consolidateNode(node: TeamSection): TeamSection {
  const collapsedLabels: string[] = [];
  let current = node;
  while (current.children && current.children.length === 1) {
    const only = current.children[0];
    collapsedLabels.push(only.label === "other" ? "unset" : only.label);
    current = only;
  }

  const label =
    collapsedLabels.length > 0
      ? `${node.label} (including ${collapsedLabels.join(", ")})`
      : node.label;

  const children =
    current.children && current.children.length > 0
      ? current.children.map((c) => consolidateNode(c))
      : undefined;

  return {
    label,
    groups: current.groups,
    level: node.level,
    ...(children ? { children } : {}),
  };
}

/**
 * Recursively drops an empty `children` array so the field is only present
 * when a section actually has nested sub-sections, matching `TeamSection`'s
 * documented invariant. Pure — returns a new tree, does not mutate `node`.
 */
function pruneEmptyChildren(node: TeamSection): TeamSection {
  if (!node.children) return node;
  if (node.children.length === 0) {
    const { children: _empty, ...rest } = node;
    void _empty;
    return rest as TeamSection;
  }
  return { ...node, children: node.children.map(pruneEmptyChildren) };
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Inserts `newSection` before the `"other"` section, or appends it at the end
 * when no `"other"` section exists. Keeps `"other"` as the last section, which
 * is an invariant established by `groupByTeamPrefix`.
 */
function insertBeforeOther(sections: TeamSection[], newSection: TeamSection): TeamSection[] {
  const otherIdx = sections.findIndex((s) => s.label === "other");
  return otherIdx === -1
    ? [...sections, newSection]
    : [...sections.slice(0, otherIdx), newSection, ...sections.slice(otherIdx)];
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
    // No existing section found — insert before "other" (which must remain last)
    // or append at the end when "other" is absent.
    sections = insertBeforeOther(sections, { label: combinedLabel, groups: [restoredRepo] });
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
    // Target section doesn't exist yet — insert before "other" (which must remain last)
    // or append at the end when "other" is absent.
    sections = insertBeforeOther(intermediate, { label: targetTeam, groups: [groupToMove] });
  }

  return flattenTeamSections(sections);
}

// ─── Undo section pick helper ─────────────────────────────────────────────────

/**
 * Restores ALL repos that were assigned from `combinedLabel` (every repo whose
 * `pickedFrom === combinedLabel`) back to the combined section in one operation.
 *
 * This is the inverse of the full `applyTeamPick` for that label — it removes
 * all per-repo picks made from a combined section, so that the `confirmedPicks`
 * entry and the replay `--pick-team` flag can be cleanly removed without leaving
 * the interactive state in a partially-undone, non-replayable configuration.
 *
 * Pure function — no mutation.
 */
export function undoSectionPick(groups: RepoGroup[], combinedLabel: string): RepoGroup[] {
  if (!groups.some((g) => g.pickedFrom === combinedLabel)) return groups;

  let sections = rebuildTeamSections(groups);

  // Collect all repos to restore (preserving their relative order across sections)
  const toRestore: RepoGroup[] = [];
  sections = sections
    .map((s) => {
      const keep: RepoGroup[] = [];
      for (const g of s.groups) {
        if (g.pickedFrom === combinedLabel) {
          const { pickedFrom: _p, ...rest } = g;
          void _p;
          toRestore.push(rest as RepoGroup);
        } else {
          keep.push(g);
        }
      }
      return { ...s, groups: keep };
    })
    .filter((s) => s.groups.length > 0);

  if (toRestore.length === 0) return groups;

  // Append to existing combined section or create a new one
  const dstIdx = sections.findIndex((s) => s.label === combinedLabel);
  if (dstIdx !== -1) {
    sections = sections.map((s, i) =>
      i === dstIdx ? { ...s, groups: [...s.groups, ...toRestore] } : s,
    );
  } else {
    sections = insertBeforeOther(sections, { label: combinedLabel, groups: toRestore });
  }

  return flattenTeamSections(sections);
}
