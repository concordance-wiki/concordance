/** One entity as the proposal reads it: whether it may become a pivot and whether it may be filed. */
export interface DomainNode {
  id: string;
  /** True for a term with a note of its own that is neither a stopword nor a rejected term. */
  candidate: boolean;
  /** True for a note no declaration files, the only ones a proposal attaches. */
  attachable: boolean;
}

/** An undirected edge of the neighbourhood graph: a typed link or a co-occurrence. */
export interface DomainEdge {
  a: string;
  b: string;
}

export interface EmergentDomainsInput {
  nodes: readonly DomainNode[];
  edges: readonly DomainEdge[];
}

export interface EmergentDomainsOptions {
  /** Degree from which a candidate becomes a pivot. */
  minNeighbours: number;
  /** Degree above which a term is a hub, never a pivot; undefined for no bound. */
  maxNeighbours?: number;
  /** Distance, in edges, within which a note belongs to a pivot. */
  radius: number;
  /** Whether the pipeline files the attached notes; the walk itself never reads it. */
  assign: boolean;
}

export interface Pivot {
  id: string;
  /** Distinct neighbours in the graph. */
  degree: number;
}

/** A note attached to its closest pivot. */
export interface Attachment {
  id: string;
  pivot: string;
  distance: number;
}

export interface EmergentDomains {
  /** By degree, largest first, then by identifier. */
  pivots: Pivot[];
  /** By note identifier. */
  attachments: Attachment[];
}
