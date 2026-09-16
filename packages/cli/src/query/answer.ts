import type { CanonicalModel, Entity, Link, Provenance } from "@concordance-wiki/core";

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The types whose notes are listed apart, as what happened to the entity: the decisions and the sessions. */
const RELATED_TYPES = new Set(["decision", "meeting"]);

export interface Bounds {
  /** Notes listed under the occurrences and entities listed under the links; the rest is counted. */
  limit: number;
  /** Occurrences listed per note; the rest is counted. */
  context: number;
}

/** One place the entity is named: a line of a file of the sources. */
export interface Occurrence {
  path: string;
  line: number;
  context: string;
  /** The method of the link that recorded the occurrence; absent for a passage of a keyword page. */
  method?: string;
}

/** The note whose files hold some occurrences. */
export interface OccurrenceNote {
  id: string;
  title: string;
  type: string;
}

/** The occurrences one note holds, across its files when the note has several. */
export interface NoteOccurrences {
  source: string;
  /** The note whose files hold the occurrences; absent when no note of the model owns the file. */
  note?: OccurrenceNote;
  occurrences: Occurrence[];
  /** Occurrences the bound left out of the list. */
  more: number;
}

export interface Occurrences {
  notes: NoteOccurrences[];
  /** Notes the bound left out of the list. */
  more_notes: number;
  /** Every occurrence, listed or not. */
  total: number;
}

/** One entity linked to the queried one, in either direction. */
export interface Linked {
  id: string;
  title: string;
  type: string;
  domain?: string;
  relation: string;
  /** `out` when the queried entity is the source of the link. */
  direction: "out" | "in";
  confidence: number;
  /** The methods that claim the link, in code-unit order. */
  methods: string[];
}

export interface Links {
  entries: Linked[];
  more: number;
}

/** A passage of a keyword page, as the fragment next to the model records it. */
export interface KeywordPassage {
  source: string;
  path: string;
  line: number;
  context: string;
}

export interface Answer {
  model: {
    file: string;
    at: string;
    tool: string;
    sources: string[];
    /** The age of the model worded from the clock; absent when the caller asked for none. */
    age?: string;
  };
  entity: Entity;
  occurrences: Occurrences;
  links: Links;
  /** The decisions and the sessions linked to the entity, every one of them. */
  related: Linked[];
}

function occurrencesOf(provenance: Provenance, holder: Entity): Occurrence[] {
  const path = provenance.path ?? holder.source.path;
  const found = (provenance.occurrences ?? []).map((occurrence): Occurrence => ({
    path,
    line: occurrence.line,
    context: occurrence.context,
    method: provenance.method,
  }));
  if (found.length === 0 && provenance.line !== undefined) {
    found.push({
      path,
      line: provenance.line,
      context: provenance.text ?? "",
      method: provenance.method,
    });
  }
  return found;
}

/** The note that owns a file of the sources, by its own path or one of its representations. */
function ownersOf(model: CanonicalModel): Map<string, Entity> {
  const owners = new Map<string, Entity>();
  for (const entity of model.entities) {
    if (entity.keyword === true) continue;
    for (const representation of entity.representations ?? []) {
      owners.set(`${entity.source.name}/${representation.path}`, entity);
    }
    owners.set(`${entity.source.name}/${entity.source.path}`, entity);
  }
  return owners;
}

/** What orders a group among those of its source: its note, else the path of its files. */
function keyOf(group: NoteOccurrences): string {
  return group.note?.id ?? group.occurrences.map((occurrence) => occurrence.path).join("\n");
}

function bounded(groups: Map<string, NoteOccurrences>, bounds: Bounds): Occurrences {
  // By source, then by note; the files no note owns come after the notes of their source, by path.
  const notes = [...groups.values()].sort(
    (a, b) =>
      byCodeUnit(a.source, b.source) ||
      Number(a.note === undefined) - Number(b.note === undefined) ||
      byCodeUnit(keyOf(a), keyOf(b)),
  );
  let total = 0;
  for (const note of notes) {
    // A written link and a mention on the same line are one occurrence: the longer context stays.
    const byPlace = new Map<string, Occurrence>();
    for (const occurrence of note.occurrences) {
      const key = `${occurrence.path}:${String(occurrence.line)}`;
      const kept = byPlace.get(key);
      if (kept === undefined || kept.context.length < occurrence.context.length) {
        byPlace.set(key, occurrence);
      }
    }
    note.occurrences = [...byPlace.values()].sort(
      (a, b) => byCodeUnit(a.path, b.path) || a.line - b.line,
    );
    total += note.occurrences.length;
    note.more = Math.max(0, note.occurrences.length - bounds.context);
    note.occurrences = note.occurrences.slice(0, bounds.context);
  }
  return {
    notes: notes.slice(0, bounds.limit),
    more_notes: Math.max(0, notes.length - bounds.limit),
    total,
  };
}

function groupOf(
  groups: Map<string, NoteOccurrences>,
  source: string,
  owner: Entity | undefined,
  key: string,
): NoteOccurrences {
  const group = groups.get(key) ?? {
    source,
    ...(owner === undefined
      ? {}
      : { note: { id: owner.id, title: owner.title, type: owner.type } }),
    occurrences: [],
    more: 0,
  };
  groups.set(key, group);
  return group;
}

/**
 * Where the entity is named. A note is named in the files of the entities that link to it,
 * where the links record the line and the context of each mention; a keyword page has no
 * link of its own, its passages come from the fragment written next to the model.
 */
export function occurrencesIn(
  model: CanonicalModel,
  entity: Entity,
  passages: readonly KeywordPassage[],
  bounds: Bounds,
): Occurrences {
  const byId = new Map(model.entities.map((candidate) => [candidate.id, candidate]));
  const groups = new Map<string, NoteOccurrences>();
  if (entity.keyword === true) {
    const owners = ownersOf(model);
    for (const passage of passages) {
      const owner = owners.get(`${passage.source}/${passage.path}`);
      const key = owner === undefined ? `${passage.source}/${passage.path}` : owner.id;
      groupOf(groups, passage.source, owner, key).occurrences.push({
        path: passage.path,
        line: passage.line,
        context: passage.context,
      });
    }
    return bounded(groups, bounds);
  }
  for (const link of model.links) {
    if (link.to !== entity.id || link.from === entity.id) continue;
    // A mention is read in the file of the entity that writes it: the source of the link.
    const holder = byId.get(link.from);
    if (holder === undefined) continue;
    for (const provenance of link.provenance) {
      for (const occurrence of occurrencesOf(provenance, holder)) {
        groupOf(groups, holder.source.name, holder, holder.id).occurrences.push(occurrence);
      }
    }
  }
  return bounded(groups, bounds);
}

function methodsOf(link: Link): string[] {
  return [...new Set(link.provenance.map((provenance) => provenance.method))].sort(byCodeUnit);
}

/** What narrows the links listed: the direction they are read in, the relation they carry. */
export interface LinkFilter {
  direction?: "in" | "out";
  relation?: string;
}

/** Every entity linked to the queried one, in either direction unless one is asked, best confidence first. */
export function linkedTo(model: CanonicalModel, entity: Entity, filter: LinkFilter = {}): Linked[] {
  const byId = new Map(model.entities.map((candidate) => [candidate.id, candidate]));
  const entries: Linked[] = [];
  for (const link of model.links) {
    if (link.from !== entity.id && link.to !== entity.id) continue;
    const direction = link.from === entity.id ? "out" : "in";
    if (filter.direction !== undefined && filter.direction !== direction) continue;
    if (filter.relation !== undefined && filter.relation !== link.relation) continue;
    const other = byId.get(direction === "out" ? link.to : link.from);
    if (other === undefined) continue;
    entries.push({
      id: other.id,
      title: other.title,
      type: other.type,
      ...(other.domain === undefined ? {} : { domain: other.domain }),
      relation: link.relation,
      direction,
      confidence: link.confidence,
      methods: methodsOf(link),
    });
  }
  return entries.sort((a, b) => b.confidence - a.confidence || byCodeUnit(a.id, b.id));
}

/** The links listed under the bound, and the decisions and sessions among all of them. */
export function linksOf(
  linked: readonly Linked[],
  bounds: Bounds,
): Pick<Answer, "links" | "related"> {
  return {
    links: {
      entries: linked.slice(0, bounds.limit),
      more: Math.max(0, linked.length - bounds.limit),
    },
    related: linked.filter((entry) => RELATED_TYPES.has(entry.type)),
  };
}

/** The relations the links of a model carry, each once, in code-unit order: what `--relation` may name. */
export function relationsOf(model: CanonicalModel): string[] {
  return [...new Set(model.links.map((link) => link.relation))].sort(byCodeUnit);
}

/** One link between two entities with everything the model recorded about it. */
export interface ExplainedLink {
  relation: string;
  /** `out` when the link goes from the queried entity to the other. */
  direction: "out" | "in";
  confidence: number;
  provenance: Provenance[];
}

/** Every link between two entities, in either direction, as the model records them: the way to see why they are linked. */
export function explainLinks(
  model: CanonicalModel,
  entity: Entity,
  other: Entity,
): ExplainedLink[] {
  return model.links
    .filter(
      (link) =>
        (link.from === entity.id && link.to === other.id) ||
        (link.from === other.id && link.to === entity.id),
    )
    .map((link): ExplainedLink => ({
      relation: link.relation,
      direction: link.from === entity.id ? "out" : "in",
      confidence: link.confidence,
      provenance: link.provenance,
    }))
    .sort((a, b) => b.confidence - a.confidence || byCodeUnit(a.relation, b.relation));
}
