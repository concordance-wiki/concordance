import type { OccurrenceLike } from "../../src/neighbourhood/types.js";

/** One occurrence per identifier, all in the same paragraph of `path`. */
export function paragraph(
  path: string,
  line: number,
  ids: readonly string[],
  source?: string,
): OccurrenceLike[] {
  return ids.map((id) => ({
    target: { id },
    path,
    line,
    ...(source === undefined ? {} : { source }),
  }));
}

/** A linear congruential generator: the same seed gives the same sequence on every run. */
export function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
