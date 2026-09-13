import source from "../messages/en.json" with { type: "json" };

import type { ArgumentKind } from "./arguments.js";

/** Every identifier of the source catalogue; an unknown identifier does not compile. */
export type MessageId = keyof typeof source;

/** The arguments of the messages that take some; a message absent from this interface takes none. */
export interface MessageArguments {
  "document.pages": { count: number };
  "entity.confidence": { value: number };
  "entity.mentionsCount": { count: number };
  "keyword.documents": { count: number };
  "keyword.occurrences": { count: number };
  "keyword.passages": { count: number };
  "mentions.atLine": { line: number };
  "mentions.inSection": { section: string };
  "search.results": { count: number };
  "site.generatedAt": { date: Date };
  "time.updatedAgo": { when: string };
  "todo.findings": { count: number };
}

/** The ICU kind of every argument of every message, as declared by the source catalogue. */
export const messageArguments = {
  "document.download": {},
  "document.pages": { count: "plural" },
  "document.preview": {},
  "entity.application": {},
  "entity.attributes": {},
  "entity.confidence": { value: "number" },
  "entity.domain": {},
  "entity.mentions": {},
  "entity.mentionsCount": { count: "plural" },
  "entity.neighbours": {},
  "entity.otherAttributes": {},
  "entity.relatedTo": {},
  "entity.showLess": {},
  "entity.showMore": {},
  "entity.sources": {},
  "entity.status": {},
  "entity.type": {},
  "footer.builtWith": {},
  "home.index": {},
  "home.recent": {},
  "home.tree": {},
  "index.empty": {},
  "index.letters": {},
  "keyword.createNote": {},
  "keyword.documents": { count: "plural" },
  "keyword.noteWritten": {},
  "keyword.occurrences": { count: "plural" },
  "keyword.passages": { count: "plural" },
  "keyword.similarLead": {},
  "keyword.title": {},
  "keyword.undefinedExpression": {},
  "mentions.atLine": { line: "number" },
  "mentions.explicit": {},
  "mentions.inSection": { section: "argument" },
  "mentions.inferred": {},
  "nav.applications": {},
  "nav.domains": {},
  "nav.types": {},
  "search.activeFilters": {},
  "search.address": {},
  "search.clear": {},
  "search.copied": {},
  "search.copyAddress": {},
  "search.facet.application": {},
  "search.facet.domain": {},
  "search.facet.noNote": {},
  "search.facet.source": {},
  "search.facet.type": {},
  "search.facets": {},
  "search.noNote.any": {},
  "search.noNote.exclude": {},
  "search.noNote.only": {},
  "search.noResult": {},
  "search.removeFilter": {},
  "search.results": { count: "plural" },
  "site.generatedAt": { date: "date" },
  "site.home": {},
  "site.index": {},
  "site.search": {},
  "site.searchPlaceholder": {},
  "site.skipToContent": {},
  "site.todo": {},
  "site.version": {},
  "time.updatedAgo": { when: "argument" },
  "todo.findings": { count: "plural" },
  "todo.severity.error": {},
  "todo.severity.info": {},
  "todo.severity.warning": {},
  "todo.title": {},
  "trail.earlier": {},
  "trail.empty": {},
  "trail.pin": {},
  "trail.title": {},
  "trail.unpin": {},
  "transcript.duration": {},
  "transcript.speakers": {},
} as const satisfies Record<MessageId, Readonly<Record<string, ArgumentKind>>>;

/** The identifiers of the source catalogue in sorted order. */
export const messageIds: readonly MessageId[] = Object.keys(source)
  .sort()
  // Object.keys returns the keys of the imported catalogue, whose type lists exactly them.
  .map((id) => id as MessageId);

/** A record with one value per identifier of the source catalogue. */
export function byMessageId<T>(value: (id: MessageId) => T): Readonly<Record<MessageId, T>> {
  const record: Partial<Record<MessageId, T>> = {};
  for (const id of messageIds) record[id] = value(id);
  // Every identifier received a value in the loop above.
  return record as Record<MessageId, T>;
}

/** The argument names of every message in sorted order, for checks against the parsed catalogues. */
export const argumentNames: Readonly<Record<MessageId, readonly string[]>> = byMessageId((id) =>
  Object.keys(messageArguments[id]).sort(),
);

/** The TypeScript type a value must have for each ICU kind. */
export interface ArgumentValues {
  argument: string;
  number: number;
  date: Date;
  time: Date;
  select: string;
  plural: number;
  tag: never;
}
