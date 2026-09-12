/** The seed every build uses: signatures never depend on the run. */
export const MINHASH_SEED = 0x5f3759df;

// FNV-1a over the UTF-16 code units: cheap, and every shingle gets one base hash.
function baseHash(shingle: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < shingle.length; index++) {
    hash = Math.imul(hash ^ shingle.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

// The finaliser of murmur3, for the second base hash of a shingle.
function mix(value: number): number {
  let hash = value;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * The two base hashes of a shingle: hash function `i` is `first + i * second` modulo 2^32, the
 * double hashing that gives as many functions as wanted from two, the second one odd so that
 * every function is a bijection of the first.
 */
interface Hashed {
  first: number;
  second: number;
}

function hashed(shingle: string, seed: number): Hashed {
  const first = (baseHash(shingle) ^ seed) >>> 0;
  return { first, second: mix(first) | 1 };
}

export interface MinHash {
  functions: number;
  /** The minimum of every hash function over the shingles; all ones for an empty set. */
  signature(shingles: Iterable<string>): Uint32Array;
}

export function createMinHash(functions: number, seed = MINHASH_SEED): MinHash {
  return {
    functions,
    signature(shingles) {
      const bases = Array.from(shingles, (shingle) => hashed(shingle, seed));
      const signature = new Uint32Array(functions);
      for (let index = 0; index < functions; index++) {
        let minimum = 0xffffffff;
        // One expression per shingle: this loop runs once per shingle and per function.
        for (const base of bases)
          minimum = Math.min(minimum, (base.first + Math.imul(index, base.second)) >>> 0);
        signature[index] = minimum;
      }
      return signature;
    },
  };
}

/** The share of equal positions, an unbiased estimate of the Jaccard index of the two sets. */
export function estimatedJaccard(a: Uint32Array, b: Uint32Array): number {
  let equal = 0;
  a.forEach((value, index) => {
    if (value === b[index]) equal++;
  });
  return equal / a.length;
}
