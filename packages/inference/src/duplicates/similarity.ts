const combiningMarks = /\p{M}+/gu;
const separators = /[^\p{L}\p{N}]+/gu;

/** The form base names and titles are compared on: lowercase, accents stripped, punctuation folded to spaces. */
export function comparisonKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(separators, " ")
    .trim();
}

// Code units rather than code points: base names are compared by the thousands and the keys are already folded.
function jaro(a: string, b: string): number {
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const matchedA = new Uint8Array(a.length);
  const matchedB = new Uint8Array(b.length);
  let matches = 0;
  for (let index = 0; index < a.length; index++) {
    const code = a.charCodeAt(index);
    const end = Math.min(index + window + 1, b.length);
    for (let other = Math.max(0, index - window); other < end; other++) {
      if (matchedB[other] === 1 || b.charCodeAt(other) !== code) continue;
      matchedA[index] = 1;
      matchedB[other] = 1;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let other = 0;
  for (let index = 0; index < a.length; index++) {
    if (matchedA[index] !== 1) continue;
    while (matchedB[other] !== 1) other++;
    if (a.charCodeAt(index) !== b.charCodeAt(other)) transpositions++;
    other++;
  }
  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
}

/** Jaro similarity with the Winkler bonus for a common prefix of up to four characters. */
export function jaroWinkler(a: string, b: string): number {
  const similarity = jaro(a, b);
  let prefix = 0;
  // Past the end of either string the code unit is NaN, which never compares equal.
  while (prefix < 4 && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++;
  return similarity + prefix * 0.1 * (1 - similarity);
}

/**
 * A name with the count of its code units per class (code unit modulo 32) and the set of classes
 * present, which bound what it can share with another name.
 */
export interface NameProfile {
  key: string;
  /** One byte per class, `counts.getUint8(unitClass)`; a base name never has 256 code units of one class. */
  counts: DataView;
  classes: number;
}

export function nameProfile(key: string): NameProfile {
  const counts = new DataView(new ArrayBuffer(32));
  let classes = 0;
  for (let index = 0; index < key.length; index++) {
    const unitClass = key.charCodeAt(index) & 31;
    counts.setUint8(unitClass, counts.getUint8(unitClass) + 1);
    classes |= 1 << unitClass;
  }
  return { key, counts, classes };
}

/**
 * An upper bound of the code units two names have in common: their counts merged by class, since
 * a minimum of sums is at least a sum of minimums. Walks the shared classes only.
 */
export function sharedCodeUnits(a: NameProfile, b: NameProfile): number {
  let shared = 0;
  for (let remaining = a.classes & b.classes; remaining !== 0;) {
    const unitClass = 31 - Math.clz32(remaining);
    remaining ^= 1 << unitClass;
    shared += Math.min(a.counts.getUint8(unitClass), b.counts.getUint8(unitClass));
  }
  return shared;
}

/** Depth of the common prefix over the deeper folder, 1 for the same folder; the root has depth 0. */
export function directoryProximity(a: string, b: string): number {
  const segmentsA = a.split("/");
  const segmentsB = b.split("/");
  let common = 0;
  while (common < segmentsA.length && segmentsA[common] === segmentsB[common]) common++;
  return common / Math.max(segmentsA.length, segmentsB.length);
}
