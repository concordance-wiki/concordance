/** What the accumulation needs of an occurrence: the entity it names and the paragraph it sits in. */
export interface OccurrenceLike {
  target: { id: string };
  source?: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  line: number;
}

export interface Neighbour {
  id: string;
  /** Number of paragraphs where both entities appear. */
  count: number;
}

export interface Neighbourhood {
  k: number;
  /** Nodes in identifier order; each holds at most `k` neighbours, by count then by identifier. */
  nodes: ReadonlyMap<string, Neighbour[]>;
}

export interface NeighbourhoodOptions {
  k: number;
}
