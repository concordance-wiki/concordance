import {
  compareEntities,
  compareFindings,
  compareLinks,
  type Entity,
  type Finding,
  type Link,
} from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

import {
  importedOperations,
  matchOperations,
  operationNotes,
  type Ambiguity,
  type MatchRung,
} from "./match.js";
import { mergeOperation, redirectLinks } from "./merge.js";

export const OPERATION_AMBIGUOUS = "W-OPERATION-AMBIGUOUS";

const REMEDIATION =
  "Give each operation note the operation_id of exactly one operation of its API, name the API in the api attribute when the source declares several contracts, or remove the note that duplicates another.";

/** How a finding names the rung an ambiguity was met at. */
const RUNG_LABELS: Record<MatchRung, string> = {
  operation_id: "the operation identifier",
  method_path: "the method and path",
  title: "the title",
};

export interface AttachOperationsInput {
  entities: readonly Entity[];
  /** The links recorded so far, the `exposes` links of the contract import among them. */
  links: readonly Link[];
  profile: Profile;
  /** The comparison form of a text; the language pack of the project provides it. */
  normalize: (text: string) => string;
}

export interface AttachOperationsResult {
  entities: Entity[];
  links: Link[];
  findings: Finding[];
}

function ambiguityFinding(ambiguity: Ambiguity): Finding {
  const rung = RUNG_LABELS[ambiguity.rung];
  if (ambiguity.kind === "note") {
    const { note, operations } = ambiguity;
    const named = operations.map((operation) => operation.entity.id).join(", ");
    return {
      check: OPERATION_AMBIGUOUS,
      severity: "warning",
      message: `operation note ${note.id} matches ${String(operations.length)} operations on ${rung}: ${named}; none is attached`,
      remediation: REMEDIATION,
      source: note.source.name,
      path: note.source.path,
      line: 1,
      entity: note.id,
    };
  }
  const { operation, notes } = ambiguity;
  const named = notes.map((note) => note.id).join(", ");
  return {
    check: OPERATION_AMBIGUOUS,
    severity: "warning",
    message: `operation ${operation.entity.id} of ${operation.api} is claimed by ${String(notes.length)} notes on ${rung}: ${named}; none is attached`,
    remediation: REMEDIATION,
    source: operation.entity.source.name,
    path: operation.location,
    entity: operation.entity.id,
  };
}

/**
 * Attaches the hand-written `endpoint` notes to the operations imported from the contracts:
 * a matched pair merges into the note, which keeps its identifier, its markdown and its frontmatter
 * and gains the contract attributes it does not set, the contract as a representation and the rung
 * as `grouped_by`; the imported operation disappears and every link that named it, the `exposes`
 * link first of all, now names the note. An ambiguous match attaches nothing and is reported as
 * `W-OPERATION-AMBIGUOUS`. Pure and deterministic: every output is in canonical order.
 */
export function attachOperations(input: AttachOperationsInput): AttachOperationsResult {
  const { entities, links, profile, normalize } = input;
  const operations = importedOperations(entities, links);
  const notes = operationNotes(entities, links, operations, profile);
  const { matches, ambiguities } = matchOperations(notes, operations, normalize);
  const merged = new Map<string, Entity>();
  const redirections = new Map<string, string>();
  for (const match of matches) {
    merged.set(match.note.id, mergeOperation(match.note, match.operation, match.rung));
    redirections.set(match.operation.entity.id, match.note.id);
  }
  return {
    entities: entities
      .filter((entity) => !redirections.has(entity.id))
      .map((entity) => merged.get(entity.id) ?? entity)
      .sort(compareEntities),
    links: redirectLinks(links, redirections).sort(compareLinks),
    findings: ambiguities.map(ambiguityFinding).sort(compareFindings),
  };
}

export {
  MATCH_RUNGS,
  importedOperations,
  matchOperations,
  operationNotes,
  type Ambiguity,
  type ImportedOperation,
  type MatchResult,
  type MatchRung,
  type OperationMatch,
  type OperationNote,
} from "./match.js";
export { CONTRACT_REPRESENTATION, mergeOperation, redirectLinks } from "./merge.js";
