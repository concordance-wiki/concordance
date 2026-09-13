import { compareEntities, type Entity } from "../entity.js";
import { compareFindings, type Finding } from "../finding.js";
import type { Link, Provenance, ProvenanceOccurrence } from "../link.js";
import { compareLinks, compareProvenances, sortCanonically } from "../order.js";
import type {
  Candidates,
  CanonicalModel,
  DuplicateCandidate,
  ModelSource,
  Neighbour,
  Neighbours,
  TermCandidate,
  TermContext,
} from "./types.js";

export interface AssembleModelInput {
  /** Version of the tool, recorded as `build.tool`. */
  version: string;
  /** ISO 8601 date from the injected clock, recorded as `build.at`. */
  timestamp: string;
  profileFingerprint: string;
  /** Recorded as `build.cross_source_links` when given, so that a linter reading the model knows how links were resolved. */
  crossSourceLinks?: boolean;
  sources: readonly ModelSource[];
  entities: readonly Entity[];
  links: readonly Link[];
  findings: readonly Finding[];
  candidates?: Candidates;
  neighbours?: Neighbours;
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function compareSources(a: ModelSource, b: ModelSource): number {
  return byCodeUnit(a.name, b.name);
}

function compareOccurrences(a: ProvenanceOccurrence, b: ProvenanceOccurrence): number {
  return a.line - b.line || (a.position ?? 0) - (b.position ?? 0);
}

function sortProvenance(provenance: Provenance): Provenance {
  return provenance.occurrences === undefined
    ? provenance
    : { ...provenance, occurrences: sortCanonically(provenance.occurrences, compareOccurrences) };
}

function sortLink(link: Link): Link {
  return {
    ...link,
    provenance: sortCanonically(link.provenance, compareProvenances).map(sortProvenance),
  };
}

function compareContexts(a: TermContext, b: TermContext): number {
  return byCodeUnit(a.path, b.path) || a.line - b.line;
}

/** Best score first, so that the list reads as a ranking; the text breaks ties. */
function compareTerms(a: TermCandidate, b: TermCandidate): number {
  return b.score - a.score || byCodeUnit(a.text, b.text);
}

function sortTerm(term: TermCandidate): TermCandidate {
  return term.contexts === undefined
    ? term
    : { ...term, contexts: sortCanonically(term.contexts, compareContexts) };
}

function sortDuplicate(duplicate: DuplicateCandidate): DuplicateCandidate {
  const sorted: DuplicateCandidate = {
    ...duplicate,
    resources: [...duplicate.resources].sort(byCodeUnit),
  };
  return duplicate.signals === undefined
    ? sorted
    : { ...sorted, signals: [...duplicate.signals].sort(byCodeUnit) };
}

function compareDuplicates(a: DuplicateCandidate, b: DuplicateCandidate): number {
  return b.score - a.score || byCodeUnit(a.resources.join("\n"), b.resources.join("\n"));
}

/** Most frequent neighbour first; the identifier breaks ties, as the neighbourhood step ranks them. */
function compareNeighbours(a: Neighbour, b: Neighbour): number {
  return b.count - a.count || byCodeUnit(a.id, b.id);
}

function sortNeighbours(neighbours: Neighbours): Neighbours {
  const sorted: Neighbours = {};
  for (const [id, ranked] of Object.entries(neighbours).sort(([a], [b]) => byCodeUnit(a, b))) {
    sorted[id] = sortCanonically(ranked, compareNeighbours);
  }
  return sorted;
}

/** Puts every block in canonical order; the input is never mutated, so producers keep their own order. */
export function assembleModel(input: AssembleModelInput): CanonicalModel {
  const candidates = input.candidates ?? { terms: [], duplicates: [] };
  const model: CanonicalModel = {
    version: 1,
    build: {
      tool: input.version,
      at: input.timestamp,
      profile_hash: input.profileFingerprint,
      sources: sortCanonically(input.sources, compareSources),
      ...(input.crossSourceLinks === undefined
        ? {}
        : { cross_source_links: input.crossSourceLinks }),
    },
    entities: sortCanonically(input.entities, compareEntities),
    links: sortCanonically(input.links, compareLinks).map(sortLink),
    findings: sortCanonically(input.findings, compareFindings),
    candidates: {
      terms: sortCanonically(candidates.terms, compareTerms).map(sortTerm),
      duplicates: sortCanonically(candidates.duplicates, compareDuplicates).map(sortDuplicate),
    },
  };
  return input.neighbours === undefined
    ? model
    : { ...model, neighbours: sortNeighbours(input.neighbours) };
}
