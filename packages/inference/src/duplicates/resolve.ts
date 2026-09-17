import { compareFindings, type Clock, type Finding } from "@concordance-wiki/core";

import { contentSimilarities, type ContentSimilarity } from "./content.js";
import {
  nameSimilarity,
  primarySignal,
  resolveDeclared,
  scorePair,
  type PrimaryName,
} from "./score.js";
import { comparisonKey, nameProfile } from "./similarity.js";
import type {
  DuplicateGroup,
  DuplicateInput,
  DuplicateOptions,
  DuplicatePair,
  DuplicateRepresentation,
  DuplicateResource,
  DuplicateResult,
  DuplicateStats,
} from "./types.js";

export const DUPLICATE_CHECK = "W-DUP-CANDIDATE";

const REMEDIATION =
  "Declare the twin in the markdown frontmatter under source, or record the pair as merged or separated in the lock file.";

const LOCK_CRITERION = "lock file";

/** How the page names what grouped the representations. */
const CRITERIA: Record<PrimaryName, string> = {
  declared: "declared in frontmatter",
  same_name: "same base name",
  similar_name: "similar base names",
  same_title: "title equal to the heading",
  similar_content: "similar content",
};

type Pair = [DuplicateResource, DuplicateResource];

interface Edge {
  a: string;
  b: string;
  criterion: string;
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function ordered(a: DuplicateResource, b: DuplicateResource): Pair {
  return a.id < b.id ? [a, b] : [b, a];
}

function keyOf([a, b]: Pair): string {
  return `${a.id}\n${b.id}`;
}

function timer(clock: Clock | undefined): () => number {
  if (clock === undefined) return () => 0;
  const started = clock.now().getTime();
  return () => clock.now().getTime() - started;
}

function groupBy(
  resources: readonly DuplicateResource[],
  keyFor: (resource: DuplicateResource) => string,
): Map<string, DuplicateResource[]> {
  const groups = new Map<string, DuplicateResource[]>();
  for (const resource of resources) {
    const key = keyFor(resource);
    if (key === "") continue;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [resource]);
    } else {
      group.push(resource);
    }
  }
  return groups;
}

function crossPairs(
  first: readonly DuplicateResource[],
  second: readonly DuplicateResource[],
): Pair[] {
  const pairs: Pair[] = [];
  for (const a of first) {
    for (const b of second) {
      if (a.id !== b.id) pairs.push(ordered(a, b));
    }
  }
  return pairs;
}

/** Every pair sharing or nearly sharing a base name: identical names within a bucket, close names across two. */
function namePairs(resources: readonly DuplicateResource[]): Pair[] {
  const buckets = [...groupBy(resources, (resource) => comparisonKey(resource.baseName))].map(
    ([key, members]) => ({ profile: nameProfile(key), members }),
  );
  const pairs: Pair[] = [];
  buckets.forEach(({ profile, members }, position) => {
    members.forEach((a, index) => {
      for (const b of members.slice(index + 1)) pairs.push(ordered(a, b));
    });
    for (const other of buckets.slice(position + 1)) {
      if (nameSimilarity(profile, other.profile) !== undefined) {
        pairs.push(...crossPairs(members, other.members));
      }
    }
  });
  return pairs;
}

/** Every pair where the title of one is the heading of the other. */
function titlePairs(resources: readonly DuplicateResource[]): Pair[] {
  const byHeading = groupBy(resources, (resource) => comparisonKey(resource.heading ?? ""));
  const pairs: Pair[] = [];
  for (const resource of resources) {
    const key = comparisonKey(resource.title ?? "");
    pairs.push(...crossPairs([resource], byHeading.get(key) ?? []));
  }
  return pairs;
}

/** Every pair where one declares the other in its frontmatter. */
function declaredPairs(resources: readonly DuplicateResource[]): Pair[] {
  const byLocation = new Map(
    resources.map((resource) => [`${resource.source}/${resource.path}`, resource]),
  );
  const pairs: Pair[] = [];
  for (const resource of resources) {
    const target = resolveDeclared(resource);
    if (target === undefined) continue;
    const twin = byLocation.get(`${target.source}/${target.path}`);
    if (twin !== undefined && twin.id !== resource.id) pairs.push(ordered(resource, twin));
  }
  return pairs;
}

function lockPairs(
  byId: ReadonlyMap<string, DuplicateResource>,
  listed: readonly (readonly [string, string])[] | undefined,
): Pair[] {
  const pairs: Pair[] = [];
  for (const [x, y] of listed ?? []) {
    const a = byId.get(x);
    const b = byId.get(y);
    if (a !== undefined && b !== undefined) pairs.push(ordered(a, b));
  }
  return pairs;
}

function representationFormat(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "file";
  const extension = name.slice(dot + 1).toLowerCase();
  return extension === "md" ? "markdown" : extension;
}

/**
 * Union-find over the merge edges, the lower identifier as root, so that the root of a component
 * is its lowest identifier whatever the order of the edges. Only non-root identifiers have a parent.
 * The root is found by a loop, never by recursion, and every identifier on the way is then
 * pointed at it: a component of thousands of resources merged in a chain costs no stack.
 */
export function components(edges: readonly Edge[]): (id: string) => string {
  const parent = new Map<string, string>();
  const rootOf = (id: string): string => {
    let root = id;
    for (let next = parent.get(root); next !== undefined; next = parent.get(root)) root = next;
    let node = id;
    for (let next = parent.get(node); next !== undefined; next = parent.get(node)) {
      parent.set(node, root);
      node = next;
    }
    return root;
  };
  for (const edge of edges) {
    const a = rootOf(edge.a);
    const b = rootOf(edge.b);
    if (a < b) {
      parent.set(b, a);
    } else if (b < a) {
      parent.set(a, b);
    }
  }
  return rootOf;
}

function groupsOf(
  resources: readonly DuplicateResource[],
  rootOf: (id: string) => string,
  edges: readonly Edge[],
): DuplicateGroup[] {
  const members = groupBy(resources, (resource) => rootOf(resource.id));
  const groups: DuplicateGroup[] = [];
  for (const [root, grouped] of members) {
    if (grouped.length < 2) continue;
    const representations = grouped.map((resource): DuplicateRepresentation => ({
      id: resource.id,
      path: resource.path,
      format: representationFormat(resource.path),
    }));
    // Members are in identifier order: the first note is the lowest one.
    const note = representations.find((representation) => representation.format === "markdown");
    const criteria = new Set(
      edges.filter((edge) => rootOf(edge.a) === root).map((edge) => edge.criterion),
    );
    groups.push({
      id: note === undefined ? root : note.id,
      representations,
      criterion: [...criteria].sort(byCodeUnit).join(", "),
    });
  }
  return groups.sort((a, b) => byCodeUnit(a.id, b.id));
}

function candidateFinding(
  a: DuplicateResource,
  b: DuplicateResource,
  pair: DuplicatePair,
): Finding {
  const breakdown = pair.signals
    .map((signal) => `${signal.detail} ${signal.weight.toFixed(2)}`)
    .join(", ");
  return {
    check: DUPLICATE_CHECK,
    severity: "info",
    source: a.source,
    path: a.path,
    entity: a.id,
    message: `${a.source}/${a.path} and ${b.source}/${b.path} look like two representations of one document (score ${pair.score.toFixed(2)}: ${breakdown}); they stay separate`,
    remediation: REMEDIATION,
  };
}

/**
 * Merges the resources whose score passes `mergeAbove` into groups, reports a candidate finding
 * for every pair at or above `candidateAbove`, and applies the lock: `merged` pairs merge whatever
 * their score, `separated` pairs neither merge nor produce a finding. A pair enters the scoring
 * through a declaration, a base name, a title or its content; the commit and the folder only
 * reinforce a pair found that way.
 */
export function resolveDuplicateResources(
  input: DuplicateInput,
  options: DuplicateOptions,
): DuplicateResult {
  const elapsed = timer(input.clock);
  const resources = [...input.resources].sort((a, b) => byCodeUnit(a.id, b.id));
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  if (byId.size !== resources.length) {
    throw new Error("every resource needs a distinct identifier");
  }
  const content = contentSimilarities(resources, input.normalizeText, options);
  const similarities = new Map<string, ContentSimilarity>();
  const candidates = new Map<string, Pair>();
  for (const { a, b, similarity } of content.pairs) {
    similarities.set(keyOf([a, b]), similarity);
    candidates.set(keyOf([a, b]), [a, b]);
  }
  for (const pair of [
    ...namePairs(resources),
    ...titlePairs(resources),
    ...declaredPairs(resources),
  ]) {
    candidates.set(keyOf(pair), pair);
  }
  const separated = new Set(lockPairs(byId, input.lock?.separated).map(keyOf));
  const edges: Edge[] = lockPairs(byId, input.lock?.merged).map(([a, b]): Edge => ({
    a: a.id,
    b: b.id,
    criterion: LOCK_CRITERION,
  }));
  const pairs: DuplicatePair[] = [];
  const scored: [Pair, DuplicatePair][] = [];
  let scoredPairs = 0;
  for (const [key, [a, b]] of [...candidates].sort(([x], [y]) => byCodeUnit(x, y))) {
    if (separated.has(key)) continue;
    scoredPairs++;
    const pair = scorePair(a, b, similarities.get(key), options);
    const primary = primarySignal(pair);
    if (primary === undefined || pair.score < options.candidateAbove) continue;
    pairs.push(pair);
    if (pair.score > options.mergeAbove) {
      edges.push({ a: a.id, b: b.id, criterion: CRITERIA[primary.name] });
    } else {
      scored.push([[a, b], pair]);
    }
  }
  const rootOf = components(edges);
  const groups = groupsOf(resources, rootOf, edges);
  const findings = scored
    .filter(([[a, b]]) => rootOf(a.id) !== rootOf(b.id))
    .map(([[a, b], pair]) => candidateFinding(a, b, pair))
    .sort(compareFindings);
  return {
    groups,
    findings,
    pairs,
    stats: {
      resources: resources.length,
      candidatePairs: content.pairs.length,
      scoredPairs,
      exactVerifications: content.exactVerifications,
      merged: groups.length,
      candidates: findings.length,
      timeMs: elapsed(),
    },
  };
}

/** The lines the build summary prints. */
export function formatDuplicateStats(stats: DuplicateStats): string[] {
  return [
    `duplicate candidate pairs: ${String(stats.candidatePairs)} by content, ${String(stats.scoredPairs)} scored, of ${String(stats.resources)} resources`,
    `duplicate exact verifications: ${String(stats.exactVerifications)}`,
    `duplicates merged: ${String(stats.merged)}, candidates: ${String(stats.candidates)}`,
    `duplicate detection time: ${String(stats.timeMs)} ms`,
  ];
}
