import source from "../messages/en.json" with { type: "json" };

import type { ArgumentKind } from "./arguments.js";

/** Every identifier of the source catalogue; an unknown identifier does not compile. */
export type MessageId = keyof typeof source;

/** The arguments of the messages that take some; a message absent from this interface takes none. */
export interface MessageArguments {
  "api.callers": { count: number };
  "api.imported": { when: string };
  "category.linksNote": { name: string };
  "category.pages": { count: number };
  "category.searchIn": { name: string };
  "category.shown": { shown: string; name: string; total: string };
  "document.pages": { count: number };
  "document.sameDocument": { count: number };
  "entity.changed": { when: string };
  "entity.confidence": { value: number };
  "entity.declaredAtTop": { count: number };
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
  "meeting.durationHours": { hours: string; minutes: string };
  "meeting.durationMinutes": { minutes: string };
  "meeting.filesGrouped": { count: number };
  "meeting.groupingNote": { count: number; reasons: string };
  "meeting.participants": { count: number };
  "mentions.atLine": { line: number };
  "mentions.inSection": { section: string };
  "neighbourhood.hop": { count: number };
  "neighbourhood.list": { count: number };
  "neighbourhood.total": { count: number };
  "results.cited": { count: number };
  "results.usedIn": { count: number };
  "search.results": { count: number };
  "site.generatedAt": { date: Date };
  "space.categoriesLead": { count: number };
  "space.updated": { when: string };
  "spaces.datesNote": { count: number };
  "spaces.lead": { count: number };
  "time.updatedAgo": { when: string };
  "todo.findings": { count: number };
}

/** The ICU kind of every argument of every message, as declared by the source catalogue. */
export const messageArguments = {
  "api.callers": { count: "plural" },
  "api.colCallers": {},
  "api.colMethod": {},
  "api.colOperation": {},
  "api.colPath": {},
  "api.contract": {},
  "api.download": {},
  "api.fiveKeys": {},
  "api.gapsLead": {},
  "api.imported": { when: "argument" },
  "api.noOperation": {},
  "api.notInContract": {},
  "api.operations": {},
  "api.operationsFirst": {},
  "api.operationsLead": {},
  "api.unknownPath": {},
  "api.viewerNote": {},
  "api.withoutPage": {},
  "category.all": {},
  "category.firstLine": {},
  "category.links": {},
  "category.linksNote": { name: "argument" },
  "category.page": {},
  "category.pages": { count: "plural" },
  "category.pagination": {},
  "category.searchIn": { name: "argument" },
  "category.shown": { shown: "argument", name: "argument", total: "argument" },
  "category.sort": {},
  "category.sortLinks": {},
  "category.sortTitle": {},
  "document.author": {},
  "document.convertedNote": {},
  "document.date": {},
  "document.dateNote": {},
  "document.download": {},
  "document.extractedText": {},
  "document.groupedNote": {},
  "document.kind.pdf": {},
  "document.kind.presentation": {},
  "document.kind.spreadsheet": {},
  "document.kind.text": {},
  "document.noNote": {},
  "document.openPdf": {},
  "document.originalNote": {},
  "document.pageCount": {},
  "document.pages": { count: "plural" },
  "document.preview": {},
  "document.relatedNotes": {},
  "document.roleNotes": {},
  "document.roleOriginal": {},
  "document.rolePreview": {},
  "document.sameDocument": { count: "plural" },
  "document.type": {},
  "document.view": {},
  "document.views": {},
  "drawer.menu": {},
  "entity.application": {},
  "entity.attributes": {},
  "entity.breadcrumb": {},
  "entity.changed": { when: "argument" },
  "entity.confidence": { value: "number" },
  "entity.correction": {},
  "entity.declaredAtTop": { count: "plural" },
  "entity.domain": {},
  "entity.edit": {},
  "entity.imageNote": {},
  "entity.legendRecognised": {},
  "entity.legendWritten": {},
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
  "meeting.date": {},
  "meeting.decision": {},
  "meeting.document": {},
  "meeting.durationHours": { hours: "argument", minutes: "argument" },
  "meeting.durationMinutes": { minutes: "argument" },
  "meeting.files": {},
  "meeting.filesGrouped": { count: "plural" },
  "meeting.grouped": {},
  "meeting.groupingNote": { count: "plural", reasons: "argument" },
  "meeting.notes": {},
  "meeting.participants": { count: "plural" },
  "meeting.pseudonymNote": {},
  "meeting.pseudonymised": {},
  "meeting.relatedNote": {},
  "meeting.representations": {},
  "meeting.signal.commit": {},
  "meeting.signal.content": {},
  "meeting.signal.declared": {},
  "meeting.signal.folder": {},
  "meeting.signal.name": {},
  "meeting.signal.similarName": {},
  "meeting.signal.title": {},
  "meeting.slides": {},
  "meeting.space": {},
  "meeting.transcript": {},
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
  "space.browse": {},
  "space.categoriesLead": { count: "plural" },
  "space.categoriesNote": {},
  "space.footer": {},
  "space.mostCited": {},
  "space.repository": {},
  "space.searchPlaceholder": {},
  "space.updated": { when: "argument" },
  "space.wordsNote": {},
  "spaces.content": {},
  "spaces.datesNote": { count: "plural" },
  "spaces.lastUpdate": {},
  "spaces.lead": { count: "plural" },
  "spaces.pages": {},
  "spaces.space": {},
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

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The identifiers of the source catalogue in sorted order. */
export const messageIds: readonly MessageId[] = Object.keys(source)
  .sort(byCodeUnit)
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
  Object.keys(messageArguments[id]).sort(byCodeUnit),
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
