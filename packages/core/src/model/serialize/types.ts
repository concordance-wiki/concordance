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
  duplicates: DuplicateCandidate[];
}

export interface Neighbour {
  id: string;
  count: number;
}

/** The K best co-occurrence neighbours of every entity, keyed by identifier. */
export type Neighbours = Record<string, Neighbour[]>;

/** What `dist/model.json` holds, as described by `schemas/model.schema.json`. */
export interface CanonicalModel {
  version: 1;
  build: ModelBuild;
  entities: Entity[];
  links: Link[];
  findings: Finding[];
  candidates: Candidates;
  neighbours?: Neighbours;
}
