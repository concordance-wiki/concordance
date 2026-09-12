import type { Link } from "@concordance-wiki/core";

import type { DisplayableEntity } from "../../src/display/types.js";

export function entity(id: string, type = "screen", keyword?: boolean): DisplayableEntity {
  const words = id.slice(id.indexOf("/") + 1).replace(/-/g, " ");
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  return { id, type, title, ...(keyword === true ? { keyword } : {}) };
}

export function link(from: string, to: string, confidence: number, relation = "related"): Link {
  return {
    from,
    to,
    relation,
    confidence,
    provenance: [{ method: "explicit_link", confidence }],
  };
}

/** A Fisher-Yates shuffle driven by the given source of numbers, so that a seed fixes the order. */
export function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    // Both indices lie within the array: the loop and the floor bound them.
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
