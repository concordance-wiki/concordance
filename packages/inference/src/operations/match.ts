import {
  CONTRACT_METHOD,
  CONTRACT_RELATION,
  compareEntities,
  type Entity,
  type Link,
} from "@concordance-wiki/core";
import type { Profile } from "@concordance-wiki/profile";

import { indexEntities, resolveReference } from "../frontmatter/resolve.js";

/** The three rungs of the matching, tried in this order; a note stops at the first one that matches. */
export type MatchRung = "operation_id" | "method_path" | "title";

export const MATCH_RUNGS: readonly MatchRung[] = ["operation_id", "method_path", "title"];

/** An `endpoint` entity a contract plugin produced, with what the `exposes` link says about it. */
export interface ImportedOperation {
  entity: Entity;
  /** Identifier of the `api` entity that declares the contract. */
  api: string;
  /** The contract location as written in the API note. */
  location: string;
  /** The operation name as the contract writes it. */
  name: string;
}

/** A hand-written `endpoint` note and the APIs whose operations it may describe. */
export interface OperationNote {
  entity: Entity;
  /** Identifiers of the candidate APIs, sorted; every API of the source when the note names none. */
  apis: readonly string[];
  /** Whether the note names its API, in frontmatter or through a recorded link. */
  declared: boolean;
}

export interface OperationMatch {
  note: Entity;
  operation: ImportedOperation;
  rung: MatchRung;
}

/** A note that matches several operations, or an operation that several notes claim, at one rung; candidates are in identifier order. */
export type Ambiguity =
  | { kind: "note"; rung: MatchRung; note: Entity; operations: ImportedOperation[] }
  | { kind: "operation"; rung: MatchRung; operation: ImportedOperation; notes: Entity[] };

export interface MatchResult {
  matches: OperationMatch[];
  ambiguities: Ambiguity[];
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function stringAttribute(entity: Entity, key: string): string | undefined {
  const value = entity.attributes[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** The imported operations of the entities: the `endpoint` entities of contract origin that an `exposes` link attaches to an API. */
export function importedOperations(
  entities: readonly Entity[],
  links: readonly Link[],
): ImportedOperation[] {
  const exposed = new Map<string, Link>();
  for (const link of links) {
    if (link.relation === CONTRACT_RELATION) exposed.set(link.to, link);
  }
  const operations: ImportedOperation[] = [];
  for (const entity of entities) {
    if (entity.type !== "endpoint" || entity.type_origin !== "contract") continue;
    const link = exposed.get(entity.id);
    if (link === undefined) continue;
    const imported = link.provenance.find((provenance) => provenance.method === CONTRACT_METHOD);
    operations.push({
      entity,
      api: link.from,
      location: entity.source.path,
      name: imported?.operation ?? entity.title,
    });
  }
  return operations.sort((a, b) => compareEntities(a.entity, b.entity));
}

/** The names of the `endpoint` attributes that reference an `api`, `api` in the default profile. */
function apiAttributes(profile: Profile): string[] {
  const attributes = profile.types["endpoint"]?.attributes ?? {};
  return Object.entries(attributes)
    .filter(([, definition]) => {
      if (definition.type !== "ref" && definition.type !== "ref[]") return false;
      const { target } = definition;
      const targets = typeof target === "string" ? [target] : (target ?? []);
      return targets.includes("api");
    })
    .map(([name]) => name)
    .sort(byCodeUnit);
}

function declaredApi(
  note: Entity,
  attributes: readonly string[],
  entities: readonly Entity[],
  apis: ReadonlySet<string>,
): string | undefined {
  const index = indexEntities(entities);
  for (const attribute of attributes) {
    const value = stringAttribute(note, attribute);
    if (value === undefined) continue;
    const resolution = resolveReference(value, { from: note, index });
    if (resolution.kind === "resolved" && apis.has(resolution.entity.id)) {
      return resolution.entity.id;
    }
  }
  return undefined;
}

/** The APIs a recorded link joins to the note, in either direction: a markdown link to the API note, typically. */
function linkedApis(note: Entity, links: readonly Link[], apis: ReadonlySet<string>): string[] {
  const linked = new Set<string>();
  for (const link of links) {
    if (link.from === note.id && apis.has(link.to)) linked.add(link.to);
    if (link.to === note.id && apis.has(link.from)) linked.add(link.from);
  }
  return [...linked].sort(byCodeUnit);
}

/**
 * The hand-written `endpoint` notes with their candidate APIs: the API a reference attribute of
 * the profile names, else the APIs a recorded link joins to the note, else every API of the note's
 * source that has imported operations. Only APIs with imported operations count.
 */
export function operationNotes(
  entities: readonly Entity[],
  links: readonly Link[],
  operations: readonly ImportedOperation[],
  profile: Profile,
): OperationNote[] {
  const apis = new Set(operations.map((operation) => operation.api));
  const byApi = new Map(
    entities.filter((entity) => apis.has(entity.id)).map((entity) => [entity.id, entity]),
  );
  const attributes = apiAttributes(profile);
  const notes: OperationNote[] = [];
  for (const entity of [...entities].sort(compareEntities)) {
    if (entity.type !== "endpoint" || entity.type_origin === "contract") continue;
    const declared = declaredApi(entity, attributes, entities, apis);
    if (declared !== undefined) {
      notes.push({ entity, apis: [declared], declared: true });
      continue;
    }
    const linked = linkedApis(entity, links, apis);
    if (linked.length > 0) {
      notes.push({ entity, apis: linked, declared: true });
      continue;
    }
    const sameSource = [...byApi.values()]
      .filter((api) => api.source.name === entity.source.name)
      .map((api) => api.id)
      .sort(byCodeUnit);
    notes.push({ entity, apis: sameSource, declared: false });
  }
  return notes;
}

/** The comparison form without spaces or punctuation, so that `List entities` equals `listEntities`. */
function compact(text: string, normalize: (text: string) => string): string {
  return normalize(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

type Normalize = (text: string) => string;

/** The keys an imported operation answers to at a rung; an operation without the attributes of a rung has none. */
function operationKeys(
  operation: ImportedOperation,
  rung: MatchRung,
  normalize: Normalize,
): string[] {
  const { entity, name } = operation;
  const id = stringAttribute(entity, "operation_id");
  if (rung === "operation_id") return id === undefined ? [] : [id];
  if (rung === "method_path") {
    const method = stringAttribute(entity, "method");
    const path = stringAttribute(entity, "path");
    const port = stringAttribute(entity, "port");
    return [
      ...(method !== undefined && path !== undefined
        ? [`http ${method.toUpperCase()} ${path}`]
        : []),
      ...(port === undefined ? [] : [`soap ${port} ${compact(name, normalize)}`]),
    ];
  }
  const titles = [entity.title, name, ...(id === undefined ? [] : [id])];
  return [...new Set(titles.map((title) => compact(title, normalize)))].filter((key) => key !== "");
}

/** The keys a note offers at a rung: the operation identifier, the method and path or the port and title, the title. */
function noteKeys(note: Entity, rung: MatchRung, normalize: Normalize): string[] {
  if (rung === "operation_id") {
    const id = stringAttribute(note, "operation_id");
    return id === undefined ? [] : [id];
  }
  if (rung === "method_path") {
    const method = stringAttribute(note, "method");
    const path = stringAttribute(note, "path");
    const port = stringAttribute(note, "port");
    return [
      ...(method !== undefined && path !== undefined
        ? [`http ${method.toUpperCase()} ${path}`]
        : []),
      ...(port === undefined ? [] : [`soap ${port} ${compact(note.title, normalize)}`]),
    ];
  }
  const title = compact(note.title, normalize);
  return title === "" ? [] : [title];
}

interface Claims {
  byNote: Map<string, ImportedOperation[]>;
  byOperation: Map<string, Entity[]>;
}

/** The operations by API and key at the rung; an operation with several keys sits under each. */
function keyedOperations(
  operations: readonly ImportedOperation[],
  rung: MatchRung,
  normalize: Normalize,
): Map<string, ImportedOperation[]> {
  const keyed = new Map<string, ImportedOperation[]>();
  for (const operation of operations) {
    for (const key of operationKeys(operation, rung, normalize)) {
      const bucket = keyed.get(`${operation.api}\n${key}`) ?? [];
      bucket.push(operation);
      keyed.set(`${operation.api}\n${key}`, bucket);
    }
  }
  return keyed;
}

/** The operations of the note's candidate APIs whose key equals one of the note's, in entity order. */
function claimedBy(
  note: OperationNote,
  keyed: ReadonlyMap<string, ImportedOperation[]>,
  rung: MatchRung,
  normalize: Normalize,
): ImportedOperation[] {
  const claimed = new Map<string, ImportedOperation>();
  for (const api of note.apis) {
    for (const key of noteKeys(note.entity, rung, normalize)) {
      for (const operation of keyed.get(`${api}\n${key}`) ?? []) {
        claimed.set(operation.entity.id, operation);
      }
    }
  }
  return [...claimed.values()].sort((a, b) => compareEntities(a.entity, b.entity));
}

function claimsAt(
  rung: MatchRung,
  notes: readonly OperationNote[],
  operations: readonly ImportedOperation[],
  normalize: Normalize,
): Claims {
  const keyed = keyedOperations(operations, rung, normalize);
  const byNote = new Map<string, ImportedOperation[]>();
  const byOperation = new Map<string, Entity[]>();
  for (const note of notes) {
    const found = claimedBy(note, keyed, rung, normalize);
    if (found.length === 0) continue;
    byNote.set(note.entity.id, found);
    for (const operation of found) {
      const claimants = byOperation.get(operation.entity.id) ?? [];
      claimants.push(note.entity);
      byOperation.set(operation.entity.id, claimants);
    }
  }
  return { byNote, byOperation };
}

/** What one rung settles: the entities it takes out of the later rungs, with their matches and ambiguities. */
interface Settled {
  ids: Set<string>;
  matches: OperationMatch[];
  ambiguities: Ambiguity[];
}

/** A note claiming several operations is an ambiguity that settles the note and every operation it claims. */
function hesitantNotes(
  rung: MatchRung,
  notes: readonly OperationNote[],
  claims: Claims,
  out: Settled,
): void {
  for (const note of notes) {
    const claimed = claims.byNote.get(note.entity.id);
    if (claimed !== undefined && claimed.length > 1) {
      out.ids.add(note.entity.id);
      for (const operation of claimed) out.ids.add(operation.entity.id);
      out.ambiguities.push({ kind: "note", rung, note: note.entity, operations: claimed });
    }
  }
}

/** An operation claimed by several notes is an ambiguity that settles the operation and every claimant. */
function contestedOperations(
  rung: MatchRung,
  operations: readonly ImportedOperation[],
  claims: Claims,
  out: Settled,
): void {
  for (const operation of operations) {
    const claimants = claims.byOperation.get(operation.entity.id);
    if (claimants !== undefined && claimants.length > 1) {
      out.ids.add(operation.entity.id);
      for (const note of claimants) out.ids.add(note.id);
      out.ambiguities.push({ kind: "operation", rung, operation, notes: claimants });
    }
  }
}

/**
 * A note left unsettled claims exactly one operation, which nobody else claims: the ambiguities
 * settled every note of a contested operation and every operation of a hesitant note.
 */
function oneToOne(
  rung: MatchRung,
  notes: readonly OperationNote[],
  claims: Claims,
  out: Settled,
): void {
  for (const note of notes) {
    const [operation] = claims.byNote.get(note.entity.id) ?? [];
    if (operation === undefined || out.ids.has(note.entity.id)) continue;
    out.ids.add(note.entity.id);
    out.ids.add(operation.entity.id);
    out.matches.push({ note: note.entity, operation, rung });
  }
}

/**
 * Matches the notes to the operations rung by rung: the operation identifier, then the method and
 * path (or the port and the operation name for SOAP), then the title in comparison form. At each
 * rung a note claims the operations of its candidate APIs whose key equals one of its own; a note
 * claiming several operations, or an operation claimed by several notes, is an ambiguity that
 * attaches nothing and takes its entities out of the later rungs. The rest attach one to one and
 * leave the later rungs to the notes and operations still free.
 */
export function matchOperations(
  notes: readonly OperationNote[],
  operations: readonly ImportedOperation[],
  normalize: Normalize,
): MatchResult {
  const matches: OperationMatch[] = [];
  const ambiguities: Ambiguity[] = [];
  let freeNotes = [...notes];
  let freeOperations = [...operations];
  for (const rung of MATCH_RUNGS) {
    const claims = claimsAt(rung, freeNotes, freeOperations, normalize);
    const settled: Settled = { ids: new Set<string>(), matches, ambiguities };
    hesitantNotes(rung, freeNotes, claims, settled);
    contestedOperations(rung, freeOperations, claims, settled);
    oneToOne(rung, freeNotes, claims, settled);
    freeNotes = freeNotes.filter((note) => !settled.ids.has(note.entity.id));
    freeOperations = freeOperations.filter((operation) => !settled.ids.has(operation.entity.id));
  }
  return { matches, ambiguities };
}
