import type { RepoGroup, TeamSection } from "./types.ts";

// ─── Team-prefix grouping ─────────────────────────────────────────────────────

/**
 * Removes any team whose name starts with one of `excludePrefixes` from every
 * repo's `teams` list, before grouping runs. Lets noisy/overly granular team
 * prefixes (e.g. many `chapter-validators-*` sub-teams) be excluded from
 * consideration entirely, reducing ambiguous combined sections at the source
 * rather than trying to resolve them after the fact.
 *
 * Matching is case-sensitive `startsWith`, same as `bucketSingleLevel`'s
 * `--group-by-team-prefix` matching, for consistency. A repo left with no
 * matching teams behaves exactly like a repo with no matching team today
 * (falls into `"other"` once grouped).
 *
 * Pure — returns new `RepoGroup` objects; does not mutate `groups` or its
 * elements. No-op (repos returned unchanged, but still copied) when
 * `excludePrefixes` is empty.
 */
export function excludeTeamsByPrefix(groups: RepoGroup[], excludePrefixes: string[]): RepoGroup[] {
  if (excludePrefixes.length === 0) return groups;
  return groups.map((g) => ({
    ...g,
    teams: (g.teams ?? []).filter((t) => !excludePrefixes.some((p) => t.startsWith(p))),
  }));
}

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
    const matchingTeams = dropRedundantSubTeams(
      (g.teams ?? []).filter((t) => t.startsWith(prefix)),
    );
    const count = matchingTeams.length;
    if (!byCount.has(count)) byCount.set(count, []);
    byCount.get(count)!.push(g);
    remaining.delete(g);
  }

  for (const count of [...byCount.keys()].toSorted((a, b) => a - b)) {
    const groupsInBucket = byCount.get(count)!;

    const byCombo = new Map<string, RepoGroup[]>();
    for (const g of groupsInBucket) {
      const matchingTeams = dropRedundantSubTeams(
        (g.teams ?? []).filter((t) => t.startsWith(prefix)),
      )
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

/**
 * Drops any team that is a proper prefix-extension of another team already
 * present in `teams` (e.g. `chapter-architect-a` is dropped when
 * `chapter-architect` is also present in the same repo's matching teams) —
 * the broader team already implies the narrower one for grouping purposes,
 * so keeping both only inflates combined-section labels with redundant
 * information. Pure — returns a new array.
 */
function dropRedundantSubTeams(teams: string[]): string[] {
  return teams.filter((t) => !teams.some((other) => other !== t && t.startsWith(other)));
}

// ─── Hierarchical (nested) team-prefix grouping ───────────────────────────────

/**
 * Groups `RepoGroup[]` into a *tree* of `TeamSection`s from one or more
 * independent prefix chains. Each chain is an ordered list of prefixes, one
 * per nesting depth: `["tribe-", "squad-"]` groups repos by teams matching
 * `tribe-` first, then sub-groups each resulting section by teams matching
 * `squad-`. Multiple chains are processed independently and sequentially
 * (like `groupByTeamPrefix`'s multi-prefix list), each drawing from the pool
 * of repos not yet claimed by an earlier chain.
 *
 * Within one chain, every level is tried in order against whatever the
 * earlier levels of *that same chain* haven't already claimed: a repo
 * matching only `chain[1]` (e.g. `squad-`) and not `chain[0]` (e.g.
 * `tribe-`) still gets its own top-level section from `chain[1]`, instead of
 * being invisible to the chain and falling through to a later chain or
 * `"other"`.
 *
 * On top of the explicit chain depth, this also combines sections whose
 * single-team label is a prefix of another single-team label at the same
 * depth (e.g. `tribe-a` and `tribe-a-p1`) into one `"tribe-a + tribe-a-p1"`
 * section, exactly like a multi-team combo — instead of nesting them into
 * extra heading levels the declared chain didn't ask for. Combined-label
 * sections (`"a + b"`) and `"other"` sections are left as-is.
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

    for (let i = 0; i < chain.length; i++) {
      const siblings = bucketSingleLevel(remaining, chain[i]).map((s) => ({ ...s, level: 0 }));
      if (siblings.length === 0) continue;

      const combined = combineOverlappingLabels(siblings, 0);
      sections.push(...combined.map((s) => applyChainDepth(s, chain, i + 1)));
    }
  }

  if (remaining.size > 0) {
    sections.push({ label: "other", groups: [...remaining], level: 0 });
  }

  return sections.map(pruneEmptyChildren);
}

/**
 * Recursively subdivides `node` by the next prefix in `chain` (at `depth`).
 * No-op once `depth` exceeds the chain or there is nothing left to split at
 * this node.
 */
function applyChainDepth(node: TeamSection, chain: string[], depth: number): TeamSection {
  if (depth >= chain.length || node.groups.length === 0) {
    return node;
  }

  const level = (node.level ?? 0) + 1;
  const localRemaining = new Set(node.groups);
  const siblings = bucketSingleLevel(localRemaining, chain[depth]).map((s) => ({ ...s, level }));
  if (localRemaining.size > 0) {
    siblings.push({ label: "other", groups: [...localRemaining], level });
  }

  const children = combineOverlappingLabels(siblings, level).map((c) =>
    applyChainDepth(c, chain, depth + 1),
  );

  return { ...node, groups: [], children };
}

/**
 * Combines sections whose single-team `label` is a proper prefix of another
 * single-team label at the same `level` (e.g. `tribe-a` and `tribe-a-p1`)
 * into one section labelled like a multi-team combo (`"tribe-a + tribe-a-p1"`,
 * teams sorted and joined), merging their `groups` — instead of nesting them
 * into extra heading levels. This lets `--pick-team` / `--pick-team-auto`
 * resolve them exactly like any other combined section. Combined-label
 * (`"a + b"`) and `"other"` sections are left untouched. Cascading overlaps
 * (A prefix of B prefix of C) merge into a single combined section for the
 * whole connected chain, since the string-prefix relation is transitive.
 *
 * Pure — returns a new flat array, no `children`/nesting introduced here.
 */
function combineOverlappingLabels(sections: TeamSection[], level: number): TeamSection[] {
  const nestable = sections.filter((s) => s.label !== "other" && !s.label.includes(" + "));
  const rest = sections
    .filter((s) => s.label === "other" || s.label.includes(" + "))
    .map((s) => ({ ...s, level }));

  const parent = new Map<string, string>();
  const find = (label: string): string => {
    let root = label;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const s of nestable) parent.set(s.label, s.label);
  for (const a of nestable) {
    for (const b of nestable) {
      if (a.label !== b.label && a.label.startsWith(b.label)) union(a.label, b.label);
    }
  }

  const clusters = new Map<string, TeamSection[]>();
  for (const s of nestable) {
    const root = find(s.label);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(s);
  }

  const combined: TeamSection[] = [];
  for (const members of clusters.values()) {
    if (members.length === 1) {
      combined.push({ ...members[0], level });
      continue;
    }
    combined.push({
      label: members
        .map((m) => m.label)
        .toSorted()
        .join(" + "),
      groups: members.flatMap((m) => m.groups),
      level,
    });
  }
  combined.sort((a, b) => a.label.localeCompare(b.label));

  return [...combined, ...rest];
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

/** One heading transition: a label at a given nesting depth. */
type PathEntry = { label: string; level: number };

/**
 * Flattens a `groupByTeamHierarchy` tree into a plain `RepoGroup[]`, tagging
 * the first repo of each leaf section with `sectionPath` — the list of
 * heading transitions (root-to-leaf labels, each with its `level`) that are
 * *new* since the previous leaf. Siblings under an unchanged ancestor don't
 * repeat that ancestor's heading, mirroring how nested markdown headings are
 * only printed once per transition.
 *
 * Consumers that need the full current path for every repo (e.g. JSON
 * output) should maintain a running cursor and, whenever `sectionPath` is
 * set, replace `cursor.slice(0, sectionPath[0].level)` with `sectionPath`.
 *
 * Note: the original `RepoGroup` objects are not mutated; new objects with
 * the `sectionPath` field added are returned.
 */
export function flattenTeamHierarchy(sections: TeamSection[]): RepoGroup[] {
  const result: RepoGroup[] = [];
  let previousPath: PathEntry[] = [];

  function emitLeafGroups(groups: RepoGroup[], path: PathEntry[]): void {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (i === 0) {
        const divergeAt = firstDivergingIndex(previousPath, path);
        const newHeadings = path.slice(divergeAt);
        result.push(newHeadings.length > 0 ? { ...g, sectionPath: newHeadings } : { ...g });
        previousPath = path;
      } else {
        // Remove any pre-existing sectionPath from non-first entries
        const { sectionPath: _removed, ...rest } = g;
        void _removed;
        result.push(rest as RepoGroup);
      }
    }
  }

  function visit(node: TeamSection, ancestors: PathEntry[]): void {
    const path = [...ancestors, { label: node.label, level: node.level ?? 0 }];
    // A node can own repos directly *and* have nested children at once (see
    // `TeamSection`) — emit its own groups under its own heading first, then
    // descend into children so none of its repos are dropped.
    if (node.groups.length > 0) emitLeafGroups(node.groups, path);
    if (node.children) {
      for (const child of node.children) visit(child, path);
    }
  }

  for (const section of sections) visit(section, []);
  return result;
}

function firstDivergingIndex(a: PathEntry[], b: PathEntry[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i].label === b[i].label && a[i].level === b[i].level) {
    i++;
  }
  return i;
}

// ─── Hierarchical (path-addressed) pick-team ──────────────────────────────────
//
// A section `label` alone is not unique across a `groupByTeamHierarchy` tree
// (e.g. `"other"` can appear under multiple parents), so hierarchy-aware pick
// operations address a section by its full root-to-node `path` (an array of
// ancestor labels ending with the section's own label). The same path,
// joined with `" > "`, is stored in `pickedFrom` so `undoSectionPickInTree`
// can find every repo picked from that exact section later. For a top-level
// section (`path.length === 1`), this is behaviourally identical to the flat
// `applyTeamPick` / `undoSectionPick` (same joined string as the bare label).

const PATH_SEPARATOR = " > ";

/**
 * Reconstructs a `groupByTeamHierarchy` tree from a flat `RepoGroup[]`
 * produced by `flattenTeamHierarchy`. The inverse of `flattenTeamHierarchy`.
 *
 * Walks the flat list maintaining a "current node per depth" stack; each
 * `sectionPath` entry pushes (or replaces, if shallower) a node onto that
 * stack, and repos are appended to whichever node is deepest on the stack
 * at the time they're encountered — correctly handling nodes that own repos
 * directly *and* have nested children (see `TeamSection`).
 */
export function rebuildTeamHierarchy(groups: RepoGroup[]): TeamSection[] {
  const roots: TeamSection[] = [];
  let stack: TeamSection[] = [];

  for (const g of groups) {
    if (g.sectionPath !== undefined && g.sectionPath.length > 0) {
      stack = stack.slice(0, g.sectionPath[0].level);
      for (const entry of g.sectionPath) {
        const node: TeamSection = { label: entry.label, groups: [], level: entry.level };
        if (stack.length === 0) {
          roots.push(node);
        } else {
          const parent = stack[stack.length - 1];
          parent.children = [...(parent.children ?? []), node];
        }
        stack.push(node);
      }
    }
    const { sectionPath: _removed, ...rest } = g;
    void _removed;
    const repo = rest as RepoGroup;
    if (stack.length === 0) {
      // No section context at all — shouldn't happen for hierarchy-produced
      // input, but keep the repo visible as its own top-level entry rather
      // than silently dropping it.
      roots.push({ label: repo.repoFullName, groups: [repo] });
      continue;
    }
    const leaf = stack[stack.length - 1];
    leaf.groups = [...leaf.groups, repo];
  }

  return roots;
}

/**
 * Navigates to the node at `parentPath` (ancestor labels, NOT including the
 * target section's own label) and replaces its children — or the top-level
 * `sections` array when `parentPath` is empty — with `updater`'s result.
 *
 * If a segment of `parentPath` is missing (e.g. an ancestor was pruned by
 * `removeMatchingRepos` because moving its only repo away left it with no
 * groups and no children), it is recreated fresh rather than silently
 * no-op-ing — otherwise undoing/re-picking the *last* repo under a branch
 * could make that branch permanently unreachable.
 */
function updateSiblingsAtPath(
  sections: TeamSection[],
  parentPath: string[],
  updater: (siblings: TeamSection[]) => TeamSection[],
): TeamSection[] {
  if (parentPath.length === 0) return updater(sections);

  const [head, ...rest] = parentPath;
  const idx = sections.findIndex((s) => s.label === head);
  if (idx === -1) {
    const children = updateSiblingsAtPath([], rest, updater);
    // Only materialize the missing ancestor if the update actually produced
    // something inside it — otherwise this is a genuine no-op (e.g. a
    // typo'd path) and adding an empty node here would pollute the tree.
    return children.length === 0 ? sections : [...sections, { label: head, groups: [], children }];
  }

  const updatedChildren = updateSiblingsAtPath(sections[idx].children ?? [], rest, updater);
  return sections.map((s, i) => (i === idx ? { ...s, children: updatedChildren } : s));
}

/**
 * Merges `repos` into the sibling named `label` under `parentPath`, creating
 * it — inserted before an `"other"` sibling, or appended — if it doesn't
 * already exist. Shared by every hierarchical pick/undo/move operation below.
 */
function mergeOrCreateAtPath(
  sections: TeamSection[],
  parentPath: string[],
  label: string,
  repos: RepoGroup[],
): TeamSection[] {
  return updateSiblingsAtPath(sections, parentPath, (siblings) => {
    const idx = siblings.findIndex((s) => s.label === label);
    if (idx !== -1) {
      return siblings.map((s, i) => (i === idx ? { ...s, groups: [...s.groups, ...repos] } : s));
    }
    const newSection: TeamSection = { label, groups: repos };
    const otherIdx = siblings.findIndex((s) => s.label === "other");
    return otherIdx === -1
      ? [...siblings, newSection]
      : [...siblings.slice(0, otherIdx), newSection, ...siblings.slice(otherIdx)];
  });
}

/**
 * Removes every repo matching `predicate` anywhere in the tree, dropping
 * sections left with no groups and no children afterward. Returns the
 * stripped tree; matched repos (untouched, `pickedFrom` included) are
 * appended to `collected` in the order encountered.
 */
function removeMatchingRepos(
  nodes: TeamSection[],
  predicate: (g: RepoGroup) => boolean,
  collected: RepoGroup[],
): TeamSection[] {
  return nodes
    .map((node) => {
      const kept: RepoGroup[] = [];
      for (const g of node.groups) {
        if (predicate(g)) collected.push(g);
        else kept.push(g);
      }
      const children = node.children
        ? removeMatchingRepos(node.children, predicate, collected)
        : undefined;
      return { ...node, groups: kept, ...(children ? { children } : {}) };
    })
    .filter((node) => node.groups.length > 0 || (node.children?.length ?? 0) > 0);
}

/** Strips `pickedFrom` from a repo (pure — returns a new object). */
function stripPickedFrom(g: RepoGroup): RepoGroup {
  const { pickedFrom: _p, ...rest } = g;
  void _p;
  return rest as RepoGroup;
}

/**
 * Tree-aware equivalent of `applyTeamPick`: reassigns the ENTIRE subtree of
 * the combined section identified by `combinedPath` (e.g.
 * `["tribe-a", "squad-a + squad-b"]`) — its own `groups` *and* any
 * nested `children` (e.g. it was already subdivided by a further chain
 * level) — to a sibling section named `chosenTeam` at that same depth
 * (merged into it if it already exists, otherwise created in its place).
 * Every repo in the moved subtree (own groups and every descendant) is
 * tagged with `pickedFrom = combinedPath.join(" > ")` so
 * `undoSectionPickInTree` can find all of them later.
 *
 * No-op (returns `sections` unchanged) if any segment of `combinedPath` does
 * not resolve to an existing node. Pure — does not mutate `sections`.
 */
export function applyTeamPickInTree(
  sections: TeamSection[],
  combinedPath: string[],
  chosenTeam: string,
): TeamSection[] {
  if (combinedPath.length === 0) return sections;
  const parentPath = combinedPath.slice(0, -1);
  const combinedLabel = combinedPath[combinedPath.length - 1];
  const pathKey = combinedPath.join(PATH_SEPARATOR);

  return updateSiblingsAtPath(sections, parentPath, (siblings) => {
    const idx = siblings.findIndex((s) => s.label === combinedLabel);
    if (idx === -1) return siblings;

    const picked = tagPickedFrom(siblings[idx], pathKey);
    const remaining = siblings.filter((_, i) => i !== idx);

    const targetIdx = remaining.findIndex((s) => s.label === chosenTeam);
    if (targetIdx !== -1) {
      return remaining.map((s, i) =>
        i === targetIdx
          ? {
              ...s,
              groups: [...s.groups, ...picked.groups],
              ...(picked.children && picked.children.length > 0
                ? { children: [...(s.children ?? []), ...picked.children] }
                : {}),
            }
          : s,
      );
    }

    const newSection: TeamSection = {
      label: chosenTeam,
      groups: picked.groups,
      level: siblings[idx].level,
      ...(picked.children && picked.children.length > 0 ? { children: picked.children } : {}),
    };
    const result = [...remaining];
    result.splice(idx, 0, newSection);
    return result;
  });
}

/**
 * Recursively tags every repo in `node` (its own `groups` and every
 * descendant's, through `children`) with `pickedFrom`, preserving the
 * subtree's shape. Pure — returns a new tree, does not mutate `node`.
 */
function tagPickedFrom(node: TeamSection, pathKey: string): TeamSection {
  return {
    ...node,
    groups: node.groups.map((g) => ({ ...g, pickedFrom: pathKey })),
    ...(node.children ? { children: node.children.map((c) => tagPickedFrom(c, pathKey)) } : {}),
  };
}

/**
 * Tree-aware equivalent of `undoSectionPick`: restores every repo anywhere in
 * the tree whose `pickedFrom` matches `combinedPathString` (the joined path
 * produced by `applyTeamPickInTree`) back to the section at that path,
 * recreating it if it no longer exists. `pickedFrom` is stripped from
 * restored repos. Sections left empty after the removal are dropped.
 *
 * No-op (returns `sections` unchanged) if no repo has a matching `pickedFrom`.
 * Pure — does not mutate `sections`.
 */
export function undoSectionPickInTree(
  sections: TeamSection[],
  combinedPathString: string,
): TeamSection[] {
  const collected: RepoGroup[] = [];
  const stripped = removeMatchingRepos(
    sections,
    (g) => g.pickedFrom === combinedPathString,
    collected,
  );
  if (collected.length === 0) return sections;

  const combinedPath = combinedPathString.split(PATH_SEPARATOR);
  const parentPath = combinedPath.slice(0, -1);
  const combinedLabel = combinedPath[combinedPath.length - 1];
  return mergeOrCreateAtPath(stripped, parentPath, combinedLabel, collected.map(stripPickedFrom));
}

/**
 * Tree-aware equivalent of `moveRepoToSection`: moves the repo identified by
 * `repoFullName` (wherever it currently sits in the tree) to a sibling named
 * `targetTeam` under `parentPath` (created in place if absent). The repo's
 * `pickedFrom` is preserved so a later undo can still restore it.
 *
 * No-op (returns `sections` unchanged) if the repo isn't found in the tree.
 * Pure — does not mutate `sections`.
 */
export function moveRepoToSectionInTree(
  sections: TeamSection[],
  repoFullName: string,
  parentPath: string[],
  targetTeam: string,
): TeamSection[] {
  const collected: RepoGroup[] = [];
  const stripped = removeMatchingRepos(sections, (g) => g.repoFullName === repoFullName, collected);
  if (collected.length === 0) return sections;
  return mergeOrCreateAtPath(stripped, parentPath, targetTeam, collected);
}

/**
 * Tree-aware equivalent of `undoPickedRepo`: restores a single previously
 * picked repo (identified by `repoFullName`) back to its original combined
 * section (read from its own `pickedFrom`), recreating that section if it no
 * longer exists. `pickedFrom` is stripped from the restored repo.
 *
 * No-op (returns `sections` unchanged) if the repo isn't found or has no
 * `pickedFrom`. Pure — does not mutate `sections`.
 */
export function undoPickedRepoInTree(sections: TeamSection[], repoFullName: string): TeamSection[] {
  const collected: RepoGroup[] = [];
  const stripped = removeMatchingRepos(
    sections,
    (g) => g.repoFullName === repoFullName && g.pickedFrom !== undefined,
    collected,
  );
  if (collected.length === 0) return sections;

  const combinedPathString = collected[0].pickedFrom!;
  const combinedPath = combinedPathString.split(PATH_SEPARATOR);
  const parentPath = combinedPath.slice(0, -1);
  const combinedLabel = combinedPath[combinedPath.length - 1];
  return mergeOrCreateAtPath(stripped, parentPath, combinedLabel, collected.map(stripPickedFrom));
}

/**
 * Returns the full path (ancestor labels, root first) of every combined
 * (`"a + b"`) section anywhere in the tree — used to resolve an unqualified
 * `--pick-team` label (auto-pick when exactly one match) or report the
 * available candidates when it's ambiguous or not found.
 */
export function findCombinedSectionPaths(sections: TeamSection[]): string[][] {
  const paths: string[][] = [];

  function visit(nodes: TeamSection[], ancestors: string[]): void {
    for (const node of nodes) {
      const path = [...ancestors, node.label];
      if (node.label.includes(" + ")) paths.push(path);
      if (node.children) visit(node.children, path);
    }
  }

  visit(sections, []);
  return paths;
}

/**
 * Auto-resolves every combined (`"a + b"`) section whose candidate team names
 * share a single common-prefix "parent" — one team name that is a literal
 * string-prefix of every other team name in the combo (e.g. `"tribe-lead-
 * client"` for `"tribe-a + tribe-a-p1"`) — applying the
 * same tree update as an explicit `--pick-team` assignment. Combined sections
 * with no such prefix relationship (e.g. `"squad-frontend + squad-mobile"`)
 * are left combined and unresolved, same as today.
 *
 * Applies independently at every hierarchy depth. Pure — does not mutate
 * `sections`.
 */
export function autoPickTeamsByCommonPrefix(sections: TeamSection[]): TeamSection[] {
  let result = sections;

  for (const path of findCombinedSectionPaths(sections)) {
    const combinedLabel = path[path.length - 1];
    const candidates = combinedLabel.split(" + ").map((c) => c.trim());
    const winner = findCommonPrefixTeam(candidates);
    if (winner === undefined) continue;

    result = applyTeamPickInTree(result, path, winner);
  }

  return result;
}

/**
 * Returns the one candidate that is a literal string-prefix of every other
 * candidate (its common-prefix "parent"), or `undefined` when no single
 * candidate satisfies that for all the others.
 */
function findCommonPrefixTeam(candidates: string[]): string | undefined {
  const winners = candidates.filter((c) => candidates.every((other) => other.startsWith(c)));
  return winners.length === 1 ? winners[0] : undefined;
}

/** Returns whether `path` (root-first ancestor labels) resolves to an actual node in the tree. */
function pathExistsInTree(sections: TeamSection[], path: string[]): boolean {
  let level = sections;
  for (let i = 0; i < path.length; i++) {
    const node = level.find((s) => s.label === path[i]);
    if (!node) return false;
    if (i === path.length - 1) return true;
    level = node.children ?? [];
  }
  return path.length === 0;
}

// ─── CLI option parsing (pure) ─────────────────────────────────────────────────

/**
 * Parses the `--group-by-team-prefix` value into one or more prefix chains
 * for `groupByTeamHierarchy`: `,` separates independent chains, `/` separates
 * nesting levels within one chain. E.g. `"tribe-/squad-,chapter-"` produces
 * `[["tribe-", "squad-"], ["chapter-"]]`.
 *
 * Malformed segments (empty chain from a stray/leading/trailing/double `,`,
 * or an empty level from a stray `/`) are dropped rather than propagated as
 * an empty-string prefix, with a human-readable warning for each so the
 * caller can surface it on stderr. A chain that has no valid level left
 * after cleanup is dropped entirely (also warned).
 */
export function parseTeamPrefixChains(spec: string): { chains: string[][]; warnings: string[] } {
  const warnings: string[] = [];
  const chains: string[][] = [];

  for (const rawChain of spec.split(",")) {
    const rawLevels = rawChain.split("/");
    const levels = rawLevels.map((l) => l.trim()).filter((l) => l.length > 0);

    if (levels.length === 0) {
      warnings.push(`--group-by-team-prefix: ignoring empty chain segment in "${spec}"`);
      continue;
    }
    if (levels.length !== rawLevels.length) {
      warnings.push(
        `--group-by-team-prefix: chain "${rawChain.trim()}" has empty prefix level(s); using "${levels.join("/")}"`,
      );
    }
    chains.push(levels);
  }

  return { chains, warnings };
}

/** Successfully resolved `--pick-team` assignment, ready for `applyTeamPickInTree`. */
export interface ResolvedPickTeam {
  path: string[];
  chosen: string;
}

/**
 * Parses and resolves one `--pick-team` assignment (`"combined=chosen"`)
 * against the current `sections` tree, returning either the resolved
 * `{ path, chosen }` (ready for `applyTeamPickInTree`) or a human-readable
 * `error` describing why it was rejected — the caller decides how to surface
 * it (e.g. a stderr warning).
 *
 * The combined side may be:
 *  - a bare label (e.g. `"squad-a + squad-b"`), auto-resolved via
 *    `findCombinedSectionPaths` — succeeds only when exactly one match
 *    exists anywhere in the tree;
 *  - a fully-qualified path joined with `" > "` (e.g.
 *    `"tribe-a > squad-a + squad-b"`), used as-is without validating
 *    against `findCombinedSectionPaths` (so it still resolves correctly
 *    right after an earlier assignment already changed the tree shape).
 *
 * `chosen` must be one of the `" + "`-separated candidate teams in the
 * resolved combined label.
 */
export function resolvePickTeamAssignment(
  sections: TeamSection[],
  assignment: string,
): ResolvedPickTeam | { error: string } {
  const eqIndex = assignment.indexOf("=");
  if (eqIndex === -1) {
    return { error: `--pick-team "${assignment}" is missing the = separator; skipping` };
  }
  const combinedInput = assignment.slice(0, eqIndex).trim();
  const chosen = assignment.slice(eqIndex + 1).trim();
  if (!combinedInput || !chosen) {
    return {
      error: `--pick-team "${assignment}" must have non-empty combined and chosen labels; skipping`,
    };
  }

  let path: string[];
  if (combinedInput.includes(PATH_SEPARATOR)) {
    path = combinedInput.split(PATH_SEPARATOR).map((s) => s.trim());
    // Fix: validate the explicit path actually resolves to a node in the
    // current tree — otherwise applyTeamPickInTree silently no-ops while the
    // caller still records a bogus assignment for replay — see review on #190.
    // (Checked generally, not just against combined sections, so a valid path
    // to a non-combined section still falls through to the clearer
    // "not a multi-team section" error below instead of this one.)
    if (!pathExistsInTree(sections, path)) {
      const available = findCombinedSectionPaths(sections)
        .map((p) => `  "${p.join(PATH_SEPARATOR)}"`)
        .join("\n");
      return {
        error:
          `--pick-team: no combined section found at path "${combinedInput}"\n` +
          (available
            ? `  Available combined sections:\n${available}`
            : "  (no combined sections remain)"),
      };
    }
  } else {
    const matches = findCombinedSectionPaths(sections).filter(
      (p) => p[p.length - 1] === combinedInput,
    );
    if (matches.length === 0) {
      const available = findCombinedSectionPaths(sections)
        .map((p) => `  "${p.join(PATH_SEPARATOR)}"`)
        .join("\n");
      return {
        error:
          `--pick-team: no section found with label "${combinedInput}"\n` +
          (available
            ? `  Available combined sections:\n${available}`
            : "  (no combined sections remain)"),
      };
    }
    if (matches.length > 1) {
      const candidates = matches.map((p) => `  "${p.join(PATH_SEPARATOR)}"`).join("\n");
      return {
        error:
          `--pick-team: label "${combinedInput}" is ambiguous (found in ${matches.length} places).\n` +
          `  Qualify it with the full path, e.g.:\n${candidates}`,
      };
    }
    path = matches[0];
  }

  const combinedLabel = path[path.length - 1];
  const candidateTeams = combinedLabel
    .split(" + ")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (candidateTeams.length < 2) {
    return {
      error: `--pick-team "${assignment}" has combined label "${combinedLabel}" which is not a multi-team section; skipping`,
    };
  }
  if (!candidateTeams.includes(chosen)) {
    return {
      error:
        `--pick-team "${assignment}" has chosen label "${chosen}" which is not one of the teams in ` +
        `"${combinedLabel}". Allowed choices: ${candidateTeams.map((c) => `"${c}"`).join(", ")}; skipping`,
    };
  }

  return { path, chosen };
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
