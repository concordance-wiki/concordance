import type { CandidateObject, ContractRecord } from "../contract.js";
import type { Entity } from "../entity.js";
import type { Finding } from "../finding.js";
import type { Link } from "../link.js";

/** One source as recorded in the `build` block: its name, and its commit and URL when it is a git repository. */
export interface ModelSource {
  name: string;
  commit?: string;
  url?: string;
  locale?: string;
  files?: number;
}

/** The only dated block of the model; everything else is a pure function of the sources. */
export interface ModelBuild {
  /** Version of the command line that wrote the model. */
  tool: string;
  /** ISO 8601 date of the build, from the injected clock. */
  at: string;
  /** Fingerprint of the merged profile, so that two builds can be compared. */
  profile_hash: string;
  sources: ModelSource[];
  counts?: Record<string, unknown>;
  /** The contracts imported by the build; absent when no source plugin read one. */
  contracts?: ContractRecord[];
  /** Whether links across sources were resolved (`inference.cross_source_links`); absent in older models. */
  cross_source_links?: boolean;
}

export interface TermContext {
  path: string;
  line: number;
  context: string;
}

/** A recurring expression that no note defines. */
export interface TermCandidate {
  text: string;
  normalized?: string;
  score: number;
  occurrences: number;
  documents: number;
  page?: boolean;
  contexts?: TermContext[];
}

/** Resources that look like the same document. */
export interface DuplicateCandidate {
  resources: string[];
  score: number;
  signals?: string[];
}

export interface Candidates {
  terms: TermCandidate[];
  /** Objects named by an imported contract that have no note; absent when no contract was read. */
  objects?: CandidateObject[];
  duplicates: DuplicateCandidate[];
}

export interface Neighbour {
  id: string;
  count: number;
}

/** The K best co-occurrence neighbours of every entity, keyed by identifier. */
export type Neighbours = Record<string, Neighbour[]>;

/** One node of the mini-map of a page, as serialised under `displayed_neighbourhood`. */
export interface DisplayedNeighbour {
  id: string;
  title: string;
  type: string;
  /** `keyword` for a noteless word, `entity` for a typed entity. */
  kind: "entity" | "keyword";
  relation: string;
  /** Where the links between the page and the neighbour point, seen from the page. */
  direction: "out" | "in" | "both";
  confidence: number;
  /** Position of the neighbour's type in the `display.neighbours_order` of the page's type; unlisted types share the rank after the last one. */
  rank: number;
}

/** The one-hop neighbours shown on the page of every entity, keyed by identifier, best first. */
export type DisplayedNeighbourhood = Record<string, DisplayedNeighbour[]>;

/** What `dist/model.json` holds, as described by `schemas/model.schema.json`. */
export interface CanonicalModel {
  version: 1;
  build: ModelBuild;
  entities: Entity[];
  links: Link[];
  findings: Finding[];
  candidates: Candidates;
  neighbours?: Neighbours;
  displayed_neighbourhood?: DisplayedNeighbourhood;
}
