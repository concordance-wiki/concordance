/** Rows per band: with 128 functions, 32 bands catch a pair at 0.6 similarity with probability 0.99. */
export const LSH_ROWS = 4;

interface Placed<T> {
  index: number;
  item: T;
}

/**
 * The pairs of items whose signatures agree on at least one band, each pair once with the
 * earlier item first, in item order. Two items that share no band are never compared.
 */
export function candidatePairs<T>(
  items: readonly T[],
  signatureOf: (item: T) => Uint32Array,
  rows: number = LSH_ROWS,
): [T, T][] {
  const placed = items.map((item, index): Placed<T> => ({ index, item }));
  const first = items[0];
  const functions = first === undefined ? 0 : signatureOf(first).length;
  const bands = Math.floor(functions / rows);
  const pairs = new Map<number, [T, T]>();
  const width = items.length;
  for (let band = 0; band < bands; band++) {
    const buckets = new Map<string, Placed<T>[]>();
    for (const entry of placed) {
      const key = signatureOf(entry.item)
        .subarray(band * rows, (band + 1) * rows)
        .join(",");
      const bucket = buckets.get(key);
      if (bucket === undefined) {
        buckets.set(key, [entry]);
      } else {
        bucket.push(entry);
      }
    }
    for (const bucket of buckets.values()) {
      bucket.forEach((first, position) => {
        for (const second of bucket.slice(position + 1)) {
          pairs.set(first.index * width + second.index, [first.item, second.item]);
        }
      });
    }
  }
  return [...pairs].sort(([a], [b]) => a - b).map(([, pair]) => pair);
}
