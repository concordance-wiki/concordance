import type { ContentSimilarity } from "./content.js";
import {
  comparisonKey,
  directoryProximity,
  jaroWinkler,
  nameProfile,
  sharedCodeUnits,
  type NameProfile,
} from "./similarity.js";
import type {
  DuplicateOptions,
  DuplicatePair,
  DuplicateResource,
  DuplicateSignal,
} from "./types.js";

const WEIGHTS = {
  declared: 1,
  sameNameSameFolder: 0.7,
  sameNameElsewhere: 0.5,
  similarNameFactor: 0.8,
  sameTitle: 0.6,
  contentHigh: 0.7,
  contentLow: 0.4,
  sameCommit: 0.3,
  directory: 0.2,
} as const;

/** Jaro-Winkler similarity from which two base names count as close. */
export const SIMILAR_NAME = 0.9;
const CONTENT_HIGH = 0.8;
const CONTENT_LOW = 0.6;

export const INCLUSION_NOTE =
  "similar content, very different sizes: an inclusion rather than a duplicate";

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function percent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

/** The source and path a frontmatter `source` names, relative to the folder of the note or `<source>:<path>`. */
export function resolveDeclared(
  resource: DuplicateResource,
): { source: string; path: string } | undefined {
  const declared = resource.declaredSource;
  if (declared === undefined) return undefined;
  const colon = declared.indexOf(":");
  if (colon !== -1) {
    return { source: declared.slice(0, colon), path: declared.slice(colon + 1) };
  }
  const segments: string[] = resource.folder === "" ? [] : resource.folder.split("/");
  let climbed = false;
  for (const segment of declared.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment !== "..") {
      segments.push(segment);
    } else if (segments.length > 0) {
      segments.pop();
    } else {
      climbed = true;
    }
  }
  if (!climbed) return { source: resource.source, path: segments.join("/") };
  // Climbing above the root lands in a sibling source: `../<source>/<path>`.
  const sibling = segments.join("/");
  const slash = sibling.indexOf("/");
  return slash === -1
    ? undefined
    : { source: sibling.slice(0, slash), path: sibling.slice(slash + 1) };
}

function declares(from: DuplicateResource, to: DuplicateResource): boolean {
  const target = resolveDeclared(from);
  return target?.source === to.source && target.path === to.path;
}

function declaredSignal(a: DuplicateResource, b: DuplicateResource): DuplicateSignal | undefined {
  const declaring = declares(a, b) ? a : declares(b, a) ? b : undefined;
  return declaring === undefined
    ? undefined
    : {
        name: "declared",
        weight: WEIGHTS.declared,
        detail: `declared in the frontmatter of ${declaring.path}`,
      };
}

/**
 * Jaro-Winkler at `SIMILAR_NAME` needs Jaro at `(SIMILAR_NAME - 0.4) / 0.6`, the prefix bonus
 * covering at most 0.4 of the distance to 1, and Jaro with `m` matches is at most
 * `(m / |a| + m / |b| + 1) / 3`: the matches must reach `MATCH_FACTOR * |a| * |b| / (|a| + |b|)`.
 */
const MATCH_FACTOR = 3 * ((SIMILAR_NAME - 0.4) / 0.6) - 1;

/** The Jaro-Winkler similarity of two base names in comparison form when it relates them, 1 for the same name. */
export function nameSimilarity(a: NameProfile, b: NameProfile): number | undefined {
  const lengthA = a.key.length;
  const lengthB = b.key.length;
  // Matches never exceed the shared code units: most pairs of distinct names stop here.
  if (sharedCodeUnits(a, b) * (lengthA + lengthB) < MATCH_FACTOR * lengthA * lengthB) {
    return undefined;
  }
  const similarity = jaroWinkler(a.key, b.key);
  return similarity >= SIMILAR_NAME ? similarity : undefined;
}

function nameSignal(a: DuplicateResource, b: DuplicateResource): DuplicateSignal | undefined {
  const keyA = comparisonKey(a.baseName);
  const keyB = comparisonKey(b.baseName);
  const similarity = nameSimilarity(nameProfile(keyA), nameProfile(keyB));
  if (similarity === undefined) return undefined;
  const sameFolder = a.source === b.source && a.folder === b.folder;
  const weight = sameFolder ? WEIGHTS.sameNameSameFolder : WEIGHTS.sameNameElsewhere;
  const where = sameFolder
    ? "in the same folder"
    : a.source === b.source
      ? "in another folder"
      : "across sources";
  if (keyA === keyB) {
    return { name: "same_name", weight, detail: `same base name ${where}` };
  }
  return {
    name: "similar_name",
    weight: round(weight * WEIGHTS.similarNameFactor),
    detail: `similar base names ${where} (Jaro-Winkler ${similarity.toFixed(2)})`,
  };
}

function titleMatchesHeading(titled: DuplicateResource, headed: DuplicateResource): boolean {
  if (titled.title === undefined || headed.heading === undefined) return false;
  const title = comparisonKey(titled.title);
  return title !== "" && title === comparisonKey(headed.heading);
}

function titleSignal(a: DuplicateResource, b: DuplicateResource): DuplicateSignal | undefined {
  return titleMatchesHeading(a, b) || titleMatchesHeading(b, a)
    ? { name: "same_title", weight: WEIGHTS.sameTitle, detail: "title equal to the heading" }
    : undefined;
}

function contentDetail(content: ContentSimilarity): string {
  const jaccard = `${content.exact ? "exact" : "estimated"} Jaccard ${content.jaccard.toFixed(2)}`;
  return content.sharedLines === undefined
    ? jaccard
    : `${jaccard}, ${percent(content.sharedLines)} of lines in common`;
}

function contentSignal(
  content: ContentSimilarity | undefined,
  options: DuplicateOptions,
): DuplicateSignal | undefined {
  if (content === undefined || content.jaccard < CONTENT_LOW) return undefined;
  const weight = content.jaccard >= CONTENT_HIGH ? WEIGHTS.contentHigh : WEIGHTS.contentLow;
  if (content.sizeRatio < options.sizeRatioMin) {
    return {
      name: "similar_content",
      weight: Math.min(weight, WEIGHTS.contentLow),
      detail: `${INCLUSION_NOTE} (${contentDetail(content)}, size ratio ${content.sizeRatio.toFixed(2)})`,
    };
  }
  return { name: "similar_content", weight, detail: `similar content (${contentDetail(content)})` };
}

function commitSignal(a: DuplicateResource, b: DuplicateResource): DuplicateSignal | undefined {
  return a.commit !== undefined && a.commit === b.commit
    ? { name: "same_commit", weight: WEIGHTS.sameCommit, detail: `added in commit ${a.commit}` }
    : undefined;
}

function directorySignal(a: DuplicateResource, b: DuplicateResource): DuplicateSignal | undefined {
  if (a.source !== b.source) return undefined;
  const proximity = directoryProximity(a.folder, b.folder);
  return proximity === 0
    ? undefined
    : {
        name: "same_directory",
        weight: round(proximity * WEIGHTS.directory),
        detail: `directory proximity ${proximity.toFixed(2)}`,
      };
}

function compareSignals(a: DuplicateSignal, b: DuplicateSignal): number {
  return b.weight - a.weight || Number(a.name > b.name) - Number(a.name < b.name);
}

/** The signals a pair can be enumerated from; the commit and the directory only reinforce them. */
export type PrimaryName = Exclude<DuplicateSignal["name"], "same_commit" | "same_directory">;

function isPrimary(signal: DuplicateSignal): signal is DuplicateSignal & { name: PrimaryName } {
  return signal.name !== "same_commit" && signal.name !== "same_directory";
}

/** The strongest primary signal of a pair, which names the grouping criterion; none for a pair that only shares a commit or a folder. */
export function primarySignal(
  pair: DuplicatePair,
): (DuplicateSignal & { name: PrimaryName }) | undefined {
  return pair.signals.find(isPrimary);
}

/** The additive score of a pair, capped at 1, with every signal that contributed. `a` has the lower identifier. */
export function scorePair(
  a: DuplicateResource,
  b: DuplicateResource,
  content: ContentSimilarity | undefined,
  options: DuplicateOptions,
): DuplicatePair {
  const signals = [
    declaredSignal(a, b),
    nameSignal(a, b),
    titleSignal(a, b),
    contentSignal(content, options),
    commitSignal(a, b),
    directorySignal(a, b),
  ]
    .filter((signal): signal is DuplicateSignal => signal !== undefined)
    .sort(compareSignals);
  const total = signals.reduce((sum, signal) => sum + signal.weight, 0);
  return { a: a.id, b: b.id, score: round(Math.min(1, total)), signals };
}
