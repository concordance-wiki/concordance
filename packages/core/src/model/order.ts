/** What a link needs to be ordered: the source-target-relation triple. */
export interface LinkOrder {
  from: string;
  to: string;
  relation: string;
}

/** What a provenance needs to be ordered: the method, then where it was found. */
export interface ProvenanceOrder {
  method: string;
  path?: string;
  line?: number;
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Canonical order of links: source, target, relation. */
export function compareLinks(a: LinkOrder, b: LinkOrder): number {
  return byCodeUnit(a.from, b.from) || byCodeUnit(a.to, b.to) || byCodeUnit(a.relation, b.relation);
}

/** Canonical order of provenances: method, path, line; a missing path or line sorts first. */
export function compareProvenances(a: ProvenanceOrder, b: ProvenanceOrder): number {
  return (
    byCodeUnit(a.method, b.method) ||
    byCodeUnit(a.path ?? "", b.path ?? "") ||
    (a.line ?? 0) - (b.line ?? 0)
  );
}

/** A sorted copy; the input is left untouched so that producers never see their order change. */
export function sortCanonically<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare);
}
