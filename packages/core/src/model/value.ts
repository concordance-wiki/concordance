/**
 * What a value read from a document may be. A configuration file, a profile, a type module and a
 * model are all unknown data until something has looked at them, and every reader needs the same
 * two answers: is this an object with keys, and how is one file of one source named.
 */

/** Whether a value is an object with keys: neither null, nor an array, nor a primitive. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The key one file of one source is looked up under, `<source name>/<path>`. Two sources may hold
 * the same path, so a path alone never names a file of the corpus.
 */
export function fileKey(source: string, path: string): string {
  return `${source}/${path}`;
}
