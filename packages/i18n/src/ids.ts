import source from "../messages/en.json" with { type: "json" };

import type { ArgumentKind } from "./arguments.js";

/** Every identifier of the source catalogue; an unknown identifier does not compile. */
export type MessageId = keyof typeof source;

/** The arguments of the messages that take some; a message absent from this interface takes none. */
export interface MessageArguments {
  "document.pages": { count: number };
  "entity.changed": { when: string };
  "entity.confidence": { value: number };
  "entity.mentionsCount": { count: number };
  "entity.neighbourPages": { count: number };
  "entity.otherPages": { count: number };
  "home.documents": { count: number };
  "home.matches": { count: number };
  "home.moreSpaces": { count: number };
  "home.pages": { count: number };
  "home.seeResults": { count: number };
  "home.stale": { count: number };
  "home.staleThreshold": { space: string; count: number };
  "home.usedIn": { count: number };
  "index.lead": { words: number; notes: number };
  "index.lettersWithout": { count: number };
  "index.passage": { passage: string; title: string };
  "index.words": { count: number };
  "keyword.filesSummary": { count: number };
  "keyword.noticeLead": { count: number };
  "keyword.occurrences": { count: number };
  "keyword.pageAt": { number: number };
  "keyword.slideAt": { number: number };
  "keyword.usedSince": { month: string };
  "mentions.atLine": { line: number };
  "mentions.inSection": { section: string };
  "results.cited": { count: number };
  "results.usedIn": { count: number };
  "neighbourhood.hop": { count: number };
  "neighbourhood.list": { count: number };
  "neighbourhood.total": { count: number };
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
  "drawer.menu": {},
  "entity.application": {},
  "entity.attributes": {},
  "entity.breadcrumb": {},
  "entity.changed": { when: "argument" },
  "entity.confidence": { value: "number" },
  "entity.correction": {},
  "entity.declaredAtTop": {},
  "entity.domain": {},
  "entity.edit": {},
  "entity.mentions": {},
  "entity.mentionsCount": { count: "plural" },
  "entity.neighbourPages": { count: "plural" },
  "entity.neighbours": {},
  "entity.onThisPage": {},
  "entity.otherAttributes": {},
  "entity.otherPages": { count: "plural" },
  "entity.relatedTo": {},
  "entity.seeNeighbourhood": {},
  "entity.showLess": {},
  "entity.showMore": {},
  "entity.sources": {},
  "entity.spaceTree": {},
  "entity.status": {},
  "entity.type": {},
  "footer.builtWith": {},
  "home.browse": {},
  "home.datesNote": {},
  "home.documents": { count: "plural" },
  "home.enterKey": {},
  "home.explanation": {},
  "home.matches": { count: "plural" },
  "home.moreSpaces": { count: "plural" },
  "home.mostCited": {},
  "home.open": {},
  "home.pages": { count: "plural" },
  "home.question": {},
  "home.recent": {},
  "home.seeResults": { count: "plural" },
  "home.spacesLead": {},
  "home.stale": { count: "plural" },
  "home.staleThreshold": { space: "argument", count: "plural" },
  "home.usedIn": { count: "plural" },
  "index.bySpace": {},
  "index.byType": {},
  "index.columnDescription": {},
  "index.columnPages": {},
  "index.columnType": {},
  "index.columnWord": {},
  "index.empty": {},
  "index.filters": {},
  "index.lead": { words: "plural", notes: "plural" },
  "index.letters": {},
  "index.lettersWithout": { count: "plural" },
  "index.noDefinition": {},
  "index.note": {},
  "index.passage": { passage: "argument", title: "argument" },
  "index.title": {},
  "index.withoutDefinition": {},
  "index.words": { count: "plural" },
  "keyword.companions": {},
  "keyword.createNote": {},
  "keyword.factFiles": {},
  "keyword.factOccurrences": {},
  "keyword.factSpaces": {},
  "keyword.filesSummary": { count: "plural" },
  "keyword.maybeSame": {},
  "keyword.noCompanion": {},
  "keyword.noDefinition": {},
  "keyword.noProperty": {},
  "keyword.noteWritten": {},
  "keyword.noticeDetail": {},
  "keyword.noticeLead": { count: "plural" },
  "keyword.occurrences": { count: "plural" },
  "keyword.pageAt": { number: "number" },
  "keyword.passagesTitle": {},
  "keyword.relatedNote": {},
  "keyword.similarLead": {},
  "keyword.slideAt": { number: "number" },
  "keyword.terms": {},
  "keyword.title": {},
  "keyword.undefinedExpression": {},
  "keyword.usedSince": { month: "argument" },
  "keyword.whatWeKnow": {},
  "mentions.atLine": { line: "number" },
  "mentions.inSection": { section: "argument" },
  "nav.applications": {},
  "nav.domains": {},
  "nav.index": {},
  "nav.types": {},
  "neighbourhood.capNote": {},
  "neighbourhood.distance": {},
  "neighbourhood.existingPage": {},
  "neighbourhood.hop": { count: "plural" },
  "neighbourhood.list": { count: "plural" },
  "neighbourhood.map": {},
  "neighbourhood.mapCaption": {},
  "neighbourhood.none": {},
  "neighbourhood.noteless": {},
  "neighbourhood.seeMentions": {},
  "neighbourhood.textualEquivalent": {},
  "neighbourhood.total": { count: "plural" },
  "related.cited": {},
  "related.clearAll": {},
  "related.filter": {},
  "related.fullList": {},
  "related.loadingOthers": {},
  "related.noMatch": {},
  "related.none": {},
  "related.orderNote": {},
  "related.other": {},
  "related.others": {},
  "related.othersUnavailable": {},
  "related.pagesOf": {},
  "related.passage": {},
  "related.passages": {},
  "related.showOthers": {},
  "related.title": {},
  "related.types": {},
  "results.alsoCalled": {},
  "results.broader": {},
  "results.cited": { count: "plural" },
  "results.clearQuery": {},
  "results.closestForm": {},
  "results.countersNote": {},
  "results.noResultFor": {},
  "results.notelessNote": {},
  "results.usedIn": { count: "plural" },
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
  "site.recent": {},
  "site.search": {},
  "site.searchPlaceholder": {},
  "site.skipToContent": {},
  "site.spaces": {},
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
